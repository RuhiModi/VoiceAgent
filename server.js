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
   ENV VARIABLES
===================== */
const {
  GROQ_API_KEY,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  RENDER_EXTERNAL_URL,
  INTERNAL_API_KEY,
  LOG_WEBHOOK_URL,
  HUMAN_AGENT_NUMBER
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
  if (lang === "hi") return { voice: "Polly.Aditi", language: "hi-IN" };
  return { voice: "alice", language: "en-IN" }; // English + Gujarati fallback
}

/* =====================
   GROQ AI
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
- Keep replies under 60 words
- Speak naturally for phone calls
- Ask a question if more info is needed
- Never promise approval or money
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
    return "Sorry, I’m having trouble right now.";
  }
}

/* =====================
   HEALTH CHECK
===================== */
app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

/* =====================
   CALL ENTRY POINT
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
    language: "en-IN" // ✅ ALWAYS ENGLISH LISTENING
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
 
