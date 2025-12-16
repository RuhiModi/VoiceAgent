import express from "express";
import dotenv from "dotenv";
import twilioPkg from "twilio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const twilio = twilioPkg;

/* =====================
   BASIC SETUP
===================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* =====================
   ENV VARIABLES
===================== */
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  HUMAN_AGENT_NUMBER,
  INTERNAL_API_KEY,
  RENDER_EXTERNAL_URL
} = process.env;

const BASE_URL = RENDER_EXTERNAL_URL.replace(/\/$/, "");
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/* =====================
   HEALTH CHECK
===================== */
app.get("/health", (_, res) => {
  res.json({ status: "ok", service: "VoiceAgent" });
});

/* =====================
   CONSTANT SAFE INTRO
===================== */
const SAFE_INTRO_PROMPT =
  "नमस्ते। मैं आपकी सहायता के लिए कॉल कर रहा हूँ। कृपया हाँ या ना में उत्तर दें।";

/* =====================
   LANGUAGE + VOICE
===================== */
function detectLanguage(text = "") {
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  return "en";
}

function getVoice(lang) {
  if (lang === "gu" || lang === "hi") {
    return { voice: "Polly.Amit", language: "hi-IN" };
  }
  return { voice: "alice", language: "en-IN" };
}

/* =====================
   CALL STATE
===================== */
const callState = new Map();

/* =====================
   TWILIO HELPERS
===================== */
function safeSay(twiml, text, lang) {
  twiml.say(getVoice(lang), text); // ALWAYS non-empty
}

function gatherSpeech(twiml, lang) {
  twiml.gather({
    input: "speech",
    action: `${BASE_URL}/twilio/gather`,
    method: "POST",
    speechTimeout: "auto",
    language: getVoice(lang).language
  });
}

function transferToHuman(twiml) {
  if (!HUMAN_AGENT_NUMBER) {
    twiml.hangup();
    return;
  }
  const dial = twiml.dial({ callerId: TWILIO_PHONE_NUMBER });
  dial.number(HUMAN_AGENT_NUMBER);
}

/* =====================
   CALL ENTRY (FIXED)
===================== */
app.post("/twilio/voice", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = req.body.CallSid;

  callState.set(callSid, { step: "intro" });

  // ✅ HARD SAFE INTRO (NO JSON)
  safeSay(twiml, SAFE_INTRO_PROMPT, "hi");
  gatherSpeech(twiml, "hi");

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   CONVERSATION LOOP
===================== */
app.post("/twilio/gather", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const speech = (req.body.SpeechResult || "").toLowerCase();

  if (speech.includes("agent") || speech.includes("officer")) {
    transferToHuman(twiml);
    return res.type("text/xml").send(twiml.toString());
  }

  // simple demo flow
  safeSay(
    twiml,
    "धन्यवाद। हम जल्द ही आपसे संपर्क करेंगे।",
    detectLanguage(speech)
  );
  twiml.hangup();

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   OUTBOUND CALL
===================== */
app.post("/start-call", async (req, res) => {
  if (req.headers["x-api-key"] !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const call = await client.calls.create({
    from: TWILIO_PHONE_NUMBER,
    to: req.body.to,
    url: `${BASE_URL}/twilio/voice`
  });

  res.json({ success: true, sid: call.sid });
});

/* =====================
   SERVER START
===================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Voice Agent running without application error on ${PORT}`);
});
