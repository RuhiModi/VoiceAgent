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
   FLOW LOADER (SAFE)
===================== */
const FLOW_DIR = path.join(__dirname, "flows");
const flowCache = {};

function loadFlow(lang) {
  const filePath = path.join(FLOW_DIR, `${lang}.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getFlow(lang) {
  if (!flowCache[lang]) {
    flowCache[lang] = loadFlow(lang);
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

function getVoice(lang) {
  if (lang === "hi") return { voice: "Polly.Aditi", language: "hi-IN" };
  if (lang === "gu") return { voice: "Polly.Aditi", language: "gu-IN" };
  return { voice: "alice", language: "en-IN" };
}

/* =====================
   CALL STATE MEMORY
===================== */
const callState = new Map(); // CallSid → { step, lang, problem }

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

function sayAndGather(twiml, text, lang) {
  const voice = getVoice(lang);

  const gather = twiml.gather({
    input: "speech",
    action: "/twilio/gather",
    method: "POST",
    speechTimeout: "auto",
    bargeIn: true,
    language: voice.language
  });

  gather.say(voice, text);
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
    lang: "gu", // default
    problem: ""
  });

  const flow = getFlow("gu");
  sayAndGather(twiml, getStep(flow, "intro").prompt, "gu");

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   CONVERSATION LOOP
===================== */
app.post("/twilio/gather", async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  const callSid = req.body.CallSid;
  const from = req.body.From;
  const speech = req.body.SpeechResult || "";

  const state = callState.get(callSid) || {
    step: "intro",
    lang: "gu",
    problem: ""
  };

  // Detect language from speech
  const lang = detectLanguage(speech);
  state.lang = lang;

  const flow = getFlow(lang);
  const nextStepId = detectNextStep(state.step, speech);
  const nextStep = getStep(flow, nextStepId);

  // Save problem description
  if (state.step === "task_pending" && speech.length > 10) {
    state.problem = speech;
  }

  state.step = nextStepId;
  callState.set(callSid, state);

  /* =====================
     GOOGLE SHEET LOG
  ===================== */
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

  /* =====================
     HUMAN ESCALATION
  ===================== */
  if (/agent|human|officer|complaint/i.test(speech)) {
    const dial = twiml.dial({
      callerId: TWILIO_PHONE_NUMBER,
      answerOnBridge: true
    });
    dial.number(HUMAN_AGENT_NUMBER);
    return res.type("text/xml").send(twiml.toString());
  }

  /* =====================
     FINAL OR CONTINUE
  ===================== */
  if (!nextStep || !nextStep.options.length) {
    twiml.say(getVoice(lang), nextStep?.prompt || "Thank you.");
    twiml.hangup();
  } else {
    sayAndGather(twiml, nextStep.prompt, lang);
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
  console.log(`✅ Multi-language Voice Agent running on ${PORT}`)
);
