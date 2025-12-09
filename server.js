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
   ENV VARIABLES (HARD CHECK)
===================== */
const {
  GROQ_API_KEY,
  LOG_WEBHOOK_URL,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  RENDER_EXTERNAL_URL,
  INTERNAL_API_KEY
} = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  console.error("❌ Twilio credentials missing");
}

if (!RENDER_EXTERNAL_URL) {
  console.error("❌ RENDER_EXTERNAL_URL missing");
}

if (!INTERNAL_API_KEY) {
  console.error("❌ INTERNAL_API_KEY is missing");
}

/* =====================
   TWILIO CLIENT
===================== */
const twilioClient = twilio(
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN
);

/* =====================
   HEALTH CHECK
===================== */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* =====================
   GROQ AI
===================== */
async function askGroq(userText) {
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
              "You are a Government Scheme Voice Assistant. Respond in the user's language. Keep answers short and clear."
          },
          { role: "user", content: userText }
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
  } catch (err) {
    console.error("Groq Error:", err.message);
    return "माफ़ कीजिए, अभी उत्तर उपलब्ध नहीं है।";
  }
}

/* =====================
   TWILIO VOICE ENTRY
===================== */
app.post("/twilio/voice", (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: "speech",
    action: `${RENDER_EXTERNAL_URL}/twilio/gather`,
    method: "POST",
    speechTimeout: "auto",
    language: "hi-IN",
    enhanced: true,
    speechModel: "phone_call"
  });

  gather.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    "नमस्ते। यह सरकारी सहायता हेल्पलाइन है। आप क्या जानना चाहते हैं?"
  );

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   TWILIO GATHER
===================== */
app.post("/twilio/gather", async (req, res) => {
  const speech = req.body?.SpeechResult || "";
  const replyText = await askGroq(speech);

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, replyText);
  twiml.pause({ length: 0.3 });
  twiml.redirect(`${RENDER_EXTERNAL_URL}/twilio/voice`);

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   START OUTBOUND CALL (PROTECTED)
===================== */
app.post("/start-call", async (req, res) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let to = String(req.body?.to || "").trim();
  const e164 = /^\+[1-9]\d{9,14}$/;

  if (!e164.test(to)) {
    return res.status(400).json({
      error: "Phone number must be E.164 (+91XXXXXXXXXX)",
      received: to
    });
  }

  try {
    const call = await twilioClient.calls.create({
      from: TWILIO_PHONE_NUMBER,
      to,
      url: `${RENDER_EXTERNAL_URL}/twilio/voice`
    });

    res.json({ success: true, sid: call.sid });
  } catch (err) {
    console.error("Twilio Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* =====================
   START SERVER
===================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
