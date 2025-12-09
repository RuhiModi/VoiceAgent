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
  INTERNAL_API_KEY,
  LOG_WEBHOOK_URL
} = process.env;

const twilioClient = twilio(
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN
);

/* =====================
   LANGUAGE DETECTION
===================== */
function detectLanguage(text = "") {
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu"; // Gujarati
  if (/[\u0900-\u097F]/.test(text)) return "hi"; // Hindi
  return "en"; // English
}

function getVoice(lang) {
  // ⚠️ Twilio has NO Gujarati voice
  if (lang === "hi") {
    return { voice: "Polly.Aditi", language: "hi-IN" };
  }
  // English + Gujarati fallback
  return { voice: "alice", language: "en-IN" };
}

function getGatherLanguage(lang) {
  // Twilio speech recognition works best this way
  if (lang === "hi") return "hi-IN";
  return "en-IN"; // Gujarati + English
}

/* =====================
   AI (GROQ)
===================== */
async function askGroq(userText, lang) {
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
You are a Government Scheme Voice Assistant.

Rules:
- Detect the user's language (Gujarati, Hindi, English)
- Reply ONLY in the same language
- Do NOT mix languages
- Keep responses short, clear, and conversational
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
  } catch {
    return "माफ़ कीजिए, अभी तकनीकी समस्या है।";
  }
}

/* =====================
   TWILIO ENTRY (Call Start)
===================== */
app.post("/twilio/voice", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  const gather = twiml.gather({
    input: "speech",
    action: "/twilio/gather",
    method: "POST",
    bargeIn: true,
    speechTimeout: "auto",
    enhanced: true,
    speechModel: "phone_call",
    language: "hi-IN" // neutral start
  });

  gather.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    "नमस्ते। તમે ગુજરાતી, हिंदी या English में बात कर सकते हैं। आप क्या जानना चाहते हैं?"
  );

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   CONTINUOUS CONVERSATION
===================== */
app.post("/twilio/gather", async (req, res) => {
  const userSpeech = req.body.SpeechResult || "";

  // If silence, restart listening
  if (!userSpeech) {
    const vr = new twilio.twiml.VoiceResponse();
    vr.redirect("/twilio/voice");
    return res.type("text/xml").send(vr.toString());
  }

  const lang = detectLanguage(userSpeech);
  const reply = await askGroq(userSpeech, lang);
  const voice = getVoice(lang);
  const gatherLang = getGatherLanguage(lang);

  /* ✅ LOG TO GOOGLE SHEET (optional) */
  if (LOG_WEBHOOK_URL) {
    fetch(LOG_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: req.body.From || "Unknown",
        userSpeech,
        aiReply: reply,
        language: lang,
        time: new Date().toISOString()
      })
    }).catch(() => {});
  }

  const twiml = new twilio.twiml.VoiceResponse();

  const gather = twiml.gather({
    input: "speech",
    action: "/twilio/gather",
    method: "POST",
    bargeIn: true,
    speechTimeout: "auto",
    enhanced: true,
    speechModel: "phone_call",
    language: gatherLang
  });

  gather.say(voice, reply);

  twiml.redirect("/twilio/voice");
  res.type("text/xml").send(twiml.toString());
});

/* =====================
   START OUTBOUND CALL
===================== */
app.post("/start-call", async (req, res) => {
  if (req.headers["x-api-key"] !== INTERNAL_API_KEY) {
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
