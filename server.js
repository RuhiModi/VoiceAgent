import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import twilioPkg from "twilio";

/* =====================
   LOAD ENV FIRST ✅
===================== */
dotenv.config();

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
   ENV VARIABLES
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

if (!INTERNAL_API_KEY) {
  console.error("❌ INTERNAL_API_KEY is missing");
}

/* =====================
   TWILIO CLIENT
===================== */
const twilio = twilioPkg;
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/* =====================
   HEALTH CHECK
===================== */
app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

/* =====================
   GROQ FUNCTION
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
            content: `
You are an OFFICIAL Government Scheme Voice Assistant.
Reply in the user's language. Keep answers short and natural.
`
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
    return "Sorry, I am unable to answer right now.";
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
    action: "/twilio/gather",
    method: "POST",
    speechTimeout: "auto",
    language: "hi-IN"
  });

  gather.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    "नमस्ते। कृपया अपनी समस्या बताइए।"
  );

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   TWILIO SPEECH HANDLER
===================== */
app.post("/twilio/gather", async (req, res) => {
  const speech = req.body.SpeechResult || "";
  const replyText = await askGroq(speech);

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, replyText);
  twiml.redirect("/twilio/voice");

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   START OUTBOUND CALL ✅ PROTECTED
===================== */
app.post("/start-call", async (req, res) => {
  const apiKey = req.headers["x-api-key"];

  if (!INTERNAL_API_KEY || apiKey !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const to = String(req.body?.to || "").trim();
  const e164Regex = /^\+[1-9]\d{9,14}$/;

  if (!e164Regex.test(to)) {
    return res.status(400).json({
      error: "Phone number must be E.164 format",
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
