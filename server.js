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

if (!RENDER_EXTERNAL_URL) {
  console.error("❌ RENDER_EXTERNAL_URL is missing");
  process.exit(1);
}

const BASE_URL = RENDER_EXTERNAL_URL.replace(/\/$/, "");
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/* =====================
   HEALTH CHECK
===================== */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "VoiceAgent",
    time: new Date().toISOString()
  });
});

/* =====================
   FLOW LOADER (SAFE)
===================== */
const FLOW_DIR = path.join(__dirname, "flows");
const flowCache = {};

function getFlow(lang) {
  try {
    if (!flowCache[lang]) {
      const filePath = path.join(FLOW_DIR, `${lang}.json`);
      flowCache[lang] = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    return flowCache[lang];
  } catch (err) {
    console.error("❌ Flow load error:", err.message);
    return { flow: [] };
  }
}

/* =====================
   LANGUAGE + VOICE
===================== */
function detectLanguage(text = "") {
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu"; // Gujarati
  if (/[\u0900-\u097F]/.test(text)) return "hi"; // Hindi
  return "en";
}

// Gujarati → Hindi (Male), Hindi → Hindi (Male), English → English
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
   FLOW HELPERS (SAFE)
===================== */
function getSafeStep(flow, id) {
  const step = flow?.flow?.find(s => s.id === id);
  if (!step || !step.prompt || !step.prompt.trim()) {
    return {
      id: "fallback",
      prompt: "कृपया प्रतीक्षा करें, हम आपको एक अधिकारी से जोड़ रहे हैं।",
      options: []
    };
  }
  return step;
}

function detectNextStep(step, speech = "") {
  const s = speech.toLowerCase();

  if (step === "intro") {
    if (s.includes("હા") || s.includes("हाँ") || s.includes("yes")) return "task_check";
    return "fallback";
  }

  if (step === "task_check") {
    if (s.includes("પૂર્ણ") || s.includes("पूरा") || s.includes("complete")) return "task_done";
    if (s.includes("બાકી") || s.includes("बाकी") || s.includes("pending")) return "task_pending";
  }

  if (step === "task_pending") {
    return speech.length > 10 ? "problem_recorded" : "no_details";
  }

  return "fallback";
}

/* =====================
   TWILIO HELPERS (SAFE)
===================== */
function sayPrompt(twiml, text, lang) {
  const safeText =
    typeof text === "string" && text.trim().length > 0
      ? text
      : "कृपया थोड़ी देर प्रतीक्षा करें।";

  twiml.say(getVoice(lang), safeText);
}

function gatherSpeech(twiml, lang) {
  twiml.gather({
    input: "speech",
    action: `${BASE_URL}/twilio/gather`,
    method: "POST",
    speechTimeout: "auto",
    bargeIn: true,
    language: getVoice(lang).language
  });
}

function transferToHuman(twiml) {
  if (!HUMAN_AGENT_NUMBER) {
    twiml.say(
      { voice: "alice", language: "en-IN" },
      "All our agents are busy. We will call you back."
    );
    twiml.hangup();
    return;
  }

  const dial = twiml.dial({
    callerId: TWILIO_PHONE_NUMBER,
    answerOnBridge: true
  });

  dial.number(HUMAN_AGENT_NUMBER);
}

/* =====================
   CALL ENTRY
===================== */
app.post("/twilio/voice", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = req.body.CallSid;

  callState.set(callSid, {
    step: "intro",
    lang: "gu",
    problem: ""
  });

  const flow = getFlow("gu");
  const introStep = getSafeStep(flow, "intro");

  // ✅ SPEAK FIRST (critical)
  sayPrompt(twiml, introStep.prompt, "gu");
  gatherSpeech(twiml, "gu");

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   CONVERSATION LOOP
===================== */
app.post("/twilio/gather", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = req.body.CallSid;
  const speech = req.body.SpeechResult || "";

  const state = callState.get(callSid);
  if (!state) {
    transferToHuman(twiml);
    return res.type("text/xml").send(twiml.toString());
  }

  const lang = detectLanguage(speech);
  state.lang = lang;

  const flow = getFlow(lang);
  const nextStepId = detectNextStep(state.step, speech);
  const nextStep = getSafeStep(flow, nextStepId);
  state.step = nextStepId;

  // Fallback → human
  if (nextStepId === "fallback") {
    transferToHuman(twiml);
    return res.type("text/xml").send(twiml.toString());
  }

  if (!nextStep.options.length) {
    sayPrompt(twiml, nextStep.prompt, lang);
    twiml.hangup();
  } else {
    sayPrompt(twiml, nextStep.prompt, lang);
    gatherSpeech(twiml, lang);
  }

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   OUTBOUND CALL
===================== */
app.post("/start-call", async (req, res) => {
  if (req.headers["x-api-key"] !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const call = await client.calls.create({
      from: TWILIO_PHONE_NUMBER,
      to: req.body.to,
      url: `${BASE_URL}/twilio/voice`
    });

    res.json({ success: true, sid: call.sid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =====================
   SERVER START
===================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Voice Agent running without application error on ${PORT}`);
});
