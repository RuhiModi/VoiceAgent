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
  LOG_WEBHOOK_URL,
  INTERNAL_API_KEY,
  RENDER_EXTERNAL_URL
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/* =====================
   FLOW LOADER
===================== */
const FLOW_DIR = path.join(__dirname, "flows");
const flowCache = {};

function getFlow(lang) {
  if (!flowCache[lang]) {
    const filePath = path.join(FLOW_DIR, `${lang}.json`);
    flowCache[lang] = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
  return flowCache[lang];
}

/* =====================
   LANGUAGE DETECTION
===================== */
function detectLanguage(text = "") {
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu"; // Gujarati
  if (/[\u0900-\u097F]/.test(text)) return "hi"; // Hindi
  return "en";
}

/* =====================
   VOICE SELECTION
   Gujarati → Hindi (Male)
===================== */
function getVoice(lang) {
  if (lang === "gu" || lang === "hi") {
    return { voice: "Polly.Amit", language: "hi-IN" }; // Male Indian
  }
  return { voice: "alice", language: "en-IN" };
}

/* =====================
   CALL STATE
===================== */
const callState = new Map();

/* =====================
   FLOW HELPERS
===================== */
function getStep(flow, id) {
  return flow.flow.find(s => s.id === id);
}

function detectNextStep(step, speech = "") {
  const s = speech.toLowerCase();

  if (step === "intro") {
    if (s.includes("હા") || s.includes("हाँ") || s.includes("yes")) return "task_check";
    if (s.includes("ના") || s.includes("नहीं") || s.includes("no")) return "fallback";
  }

  if (step === "task_check") {
    if (s.includes("પૂર્ણ") || s.includes("पूरा") || s.includes("complete")) return "task_done";
    if (s.includes("બાકી") || s.includes("बाकी") || s.includes("pending")) return "task_pending";
  }

  if (step === "task_pending") {
    if (speech.length > 10) return "problem_recorded";
    return "no_details";
  }

  return "fallback";
}

/* =====================
   SPEAK FIRST (CRITICAL)
===================== */
function sayPrompt(twiml, text, lang) {
  twiml.say(getVoice(lang), text);
}

function gatherSpeech(twiml, lang) {
  twiml.gather({
    input: "speech",
    action: "/twilio/gather",
    method: "POST",
    speechTimeout: "auto",
    bargeIn: true,
    language: getVoice(lang).language
  });
}

/* =====================
   SAFE HUMAN TRANSFER
===================== */
function transferToHuman(twiml) {
  if (!HUMAN_AGENT_NUMBER) {
    twiml.say(
      { voice: "alice", language: "en-IN" },
      "All our agents are currently busy. We will call you back."
    );
    twiml.hangup();
    return;
  }

  const dial = twiml.dial({
    callerId: TWILIO_PHONE_NUMBER,
    answerOnBridge: true,
    ringTone: "none"
  });

  dial.number(HUMAN_AGENT_NUMBER);
}

/* =====================
   HEALTH CHECK
===================== */
app.get("/health", (_, res) => res.json({ status: "ok" }));

/* =====================
   CALL ENTRY (INBOUND / OUTBOUND)
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

  // ✅ ALWAYS SPEAK FIRST
  sayPrompt(twiml, getStep(flow, "intro").prompt, "gu");
  gatherSpeech(twiml, "gu");

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   CONVERSATION LOOP
===================== */
app.post("/twilio/gather", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  const callSid = req.body.CallSid;
  const from = req.body.From;
  const speech = req.body.SpeechResult || "";

  const state = callState.get(callSid) || {
    step: "intro",
    lang: "gu",
    problem: ""
  };

  const lang = detectLanguage(speech);
  state.lang = lang;

  const flow = getFlow(lang);
  const nextStepId = detectNextStep(state.step, speech);
  const nextStep = getStep(flow, nextStepId);

  if (state.step === "task_pending" && speech.length > 10) {
    state.problem = speech;
  }

  state.step = nextStepId;
  callState.set(callSid, state);

  /* LOG */
  if (LOG_WEBHOOK_URL) {
    fetch(LOG_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: from,
        language: lang,
        step: nextStepId,
        speech,
        problem: state.problem,
        time: new Date().toISOString()
      })
    }).catch(() => {});
  }

  /* FALLBACK → HUMAN */
  if (nextStepId === "fallback") {
    transferToHuman(twiml);
    return res.type("text/xml").send(twiml.toString());
  }

  /* MANUAL HUMAN REQUEST */
  if (/agent|human|officer|complaint/i.test(speech)) {
    transferToHuman(twiml);
    return res.type("text/xml").send(twiml.toString());
  }

  /* CONTINUE OR END */
  if (!nextStep || !nextStep.options.length) {
    twiml.say(getVoice(lang), nextStep?.prompt || "धन्यवाद।");
    twiml.hangup();
  } else {
    sayPrompt(twiml, nextStep.prompt, lang);
    gatherSpeech(twiml, lang);
  }

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   START OUTBOUND CALL
===================== */
app.post("/start-call", async (req, res) => {
  if (req.headers["x-api-key"] !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const call = await client.calls.create({
      from: TWILIO_PHONE_NUMBER,
      to: req.body.to,
      url: `${RENDER_EXTERNAL_URL}/twilio/voice`
    });

    res.json({ success: true, sid: call.sid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =====================
   SERVER START
===================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`✅ Voice Agent running (stable, speak-first, error-free) on ${PORT}`)
);
