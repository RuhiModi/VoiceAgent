import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import twilio from "twilio";
import fetch from "node-fetch";

dotenv.config();

// --------------------
// BASIC SETUP
// --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// --------------------
// ENV VARIABLES
// --------------------
const {
  GROQ_API_KEY,
  LOG_WEBHOOK_URL,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  RENDER_EXTERNAL_URL
} = process.env;

// Basic safety check
if (!GROQ_API_KEY) {
  console.warn("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");
}

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  console.warn("AC09e67d9fcfe079cbdc34a6ed9c74e06f, 3759d7518e36da920879d49c387a6d0c, +18444826702");
}

// Twilio client
const twilioClient = twilio(
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN
);

// --------------------
// HEALTH CHECK
// --------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// --------------------
// GROQ CALL FUNCTION
// --------------------
async function askGroq(userText) {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `
You are an OFFICIAL Government Scheme Voice Assistant.

Rules:
- Reply ONLY in the same language as the user (English, Hindi, Gujarati)
- Keep answers short (max 60 words)
- Ask clarifying questions when needed
- Never promise approval, money, or eligibility
- Only explain government schemes
          `
          },
          { role: "user", content: userText }
        ],
        temperature: 0.3
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
    console.error("Groq Error:", err?.response?.data || err.message);
    return "Sorry, I am unable to answer right now.";
  }
}

// --------------------
// WEB VOICE API (Browser)
// --------------------
app.post("/api/talk", async (req, res) => {
  const userText = req.body.text;
  if (!userText) {
    return res.json({ reply: "Please say something." });
  }

  const replyText = await askGroq(userText);

  // Google Sheet logging
  if (LOG_WEBHOOK_URL) {
    fetch(LOG_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: userText,
        reply: replyText,
        time: new Date().toISOString()
      })
    }).catch(() => {});
  }

  res.json({ reply: replyText });
});

// --------------------
// TWILIO INCOMING CALL
// --------------------
app.post("/twilio/voice", (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: "speech",
    action: "/twilio/gather",
    method: "POST",
    speechTimeout: "auto"
  });

  gather.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    "Namaste. This is the government assistance helpline. How can I help you?"
  );

  res.type("text/xml");
  res.send(twiml.toString());
});

// --------------------
// TWILIO SPEECH RESPONSE
// --------------------
app.post("/twilio/gather", async (req, res) => {
  const speech = req.body.SpeechResult || "";

  const replyText = await askGroq(speech);

  // Log call
  if (LOG_WEBHOOK_URL) {
    fetch(LOG_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: speech,
        reply: replyText,
        channel: "call",
        time: new Date().toISOString()
      })
    }).catch(() => {});
  }

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    replyText
  );
  twiml.pause({ length: 1 });
  twiml.redirect("/twilio/voice");

  res.type("text/xml");
  res.send(twiml.toString());
});

// --------------------
// OUTBOUND CALL API
// --------------------
app.post("/start-call", async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: "Missing number" });

  try {
    const call = await twilioClient.calls.create({
      from: TWILIO_PHONE_NUMBER,
      to,
      url: `${RENDER_EXTERNAL_URL}/twilio/voice`
    });

    res.json({ success: true, sid: call.sid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// START SERVER
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
