import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import twilioPkg from "twilio";
const twilio = twilioPkg;


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
  RENDER_EXTERNAL_URL
} = process.env;

if (!RENDER_EXTERNAL_URL) {
  console.error("❌ RENDER_EXTERNAL_URL is missing");
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

Rules:
- Reply ONLY in the same language as the user (English, Hindi, Gujarati)
- Max 60 words
- Speak clearly for phone calls
- Ask clarifying questions
- Do NOT promise eligibility or money
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
  } catch (e) {
    console.error("Groq Error:", e.message);
    return "Sorry, I am unable to answer right now.";
  }
}

/* =====================
   WEB VOICE (BROWSER)
===================== */
app.post("/api/talk", async (req, res) => {
  const userText = req.body.text;
  if (!userText) return res.json({ reply: "Please say something." });

  const replyText = await askGroq(userText);

  if (LOG_WEBHOOK_URL) {
    fetch(LOG_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "web",
        user: userText,
        reply: replyText,
        time: new Date().toISOString()
      })
    }).catch(() => {});
  }

  res.json({ reply: replyText });
});

/* =====================
   TWILIO INCOMING CALL
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
    "नमस्ते। यह सरकारी सहायता हेल्पलाइन है। कृपया बताइए मैं आपकी कैसे मदद कर सकता हूँ?"
  );

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   TWILIO SPEECH HANDLER
===================== */
app.post("/twilio/gather", async (req, res) => {
  const speech = req.body.SpeechResult || "";
  const replyText = await askGroq(speech);

  if (LOG_WEBHOOK_URL) {
    fetch(LOG_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "call",
        user: speech,
        reply: replyText,
        time: new Date().toISOString()
      })
    }).catch(() => {});
  }

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ voice: "Polly.Aditi", language: "hi-IN-gu" }, replyText);
  twiml.pause({ length: 1 });
  twiml.redirect(`${RENDER_EXTERNAL_URL}/twilio/voice`);

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   START OUTBOUND CALL
===================== */
app.post("/start-call", async (req, res) => {
  console.log("RAW BODY:", req.body);
  console.log("TYPE OF to:", typeof req.body?.to);

  let { to } = req.body;

  // Force clean string
  to = String(to || "").trim();

  console.log("CLEANED TO:", to);

  const e164Regex = /^\+[1-9]\d{9,14}$/;

  if (!to || !e164Regex.test(to)) {
    return res.status(400).json({
      error: "Phone number must be valid E.164 format (ex: +919XXXXXXXXX)",
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
    console.error("Twilio Call Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


/* =====================
   START SERVER
===================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
