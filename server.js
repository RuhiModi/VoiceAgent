import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import twilioPkg from "twilio";

dotenv.config();
const twilio = twilioPkg;

/* =====================
   BASIC SETUP
===================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/* =====================
   ENVIRONMENT
===================== */
const {
  GROQ_API_KEY,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  RENDER_EXTERNAL_URL,
  INTERNAL_API_KEY
} = process.env;

const twilioClient = twilio(
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN
);

/* =====================
   HEALTH
===================== */
app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

/* =====================
   AI (GROQ)
===================== */
async function askGroq(text) {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are a Government Scheme Voice Assistant. Reply in the same language as the user. Keep replies short and conversational."
          },
          { role: "user", content: text }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch {
    return "माफ़ कीजिए, अभी मैं जवाब नहीं दे पा रहा हूँ।";
  }
}

/* =====================
   TWILIO ENTRY POINT
===================== */
app.post("/twilio/voice", (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: "speech",
    action: "/twilio/gather",
    method: "POST",
    speechTimeout: "auto",
    enhanced: true,
    speechModel: "phone_call",
    language: "hi-IN"
  });

  gather.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    "नमस्ते। यह सरकारी योजनाओं की हेल्पलाइन है। आप अपना सवाल पूछिए।"
  );

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   CONTINUOUS CONVERSATION
===================== */
app.post("/twilio/gather", async (req, res) => {
  const userSpeech = req.body.SpeechResult || "";
  const reply = await askGroq(userSpeech);

  const twiml = new twilio.twiml.VoiceResponse();

  // ✅ Speak AND listen again
  const gather = twiml.gather({
    input: "speech",
    action: "/twilio/gather",
    method: "POST",
    speechTimeout: "auto",
    enhanced: true,
    speechModel: "phone_call",
    language: "hi-IN"
  });

  gather.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    reply
  );

  // ✅ If user stays silent, restart listening
  twiml.redirect("/twilio/voice");

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   START OUTBOUND CALL
===================== */
app.post("/start-call", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const to = String(req.body?.to || "").trim();
  const e164 = /^\+[1-9]\d{9,14}$/;

  if (!e164.test(to)) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  try {
    const call = await twilioClient.calls.create({
      from: TWILIO_PHONE_NUMBER,
      to,
      url: `${RENDER_EXTERNAL_URL}/twilio/voice`
    });

    res.json({ success: true, sid: call.sid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =====================
   SERVER
===================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
