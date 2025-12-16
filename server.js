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
   ENV
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
   LOAD FLOW (SAFE)
===================== */
const FLOW_DIR = path.join(__dirname, "flows");

function loadFlow(lang = "gu") {
  const filePath = path.join(FLOW_DIR, `${lang}.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const flowData = loadFlow("gu");

/* =====================
   CALL STATE MEMORY
===================== */
const callState = new Map();

/* =====================
   HELPERS
===================== */
function getStep(id) {
  return flowData.flow.find(f => f.id === id);
}

function detectNextStep(step, speech = "") {
  const s = speech.toLowerCase();

  if (step === "intro") {
    if (s.includes("હા")) return "task_check";
    if (s.includes("ના")) return "fallback";
  }

  if (step === "task_check") {
    if (s.includes("પૂર્ણ")) return "task_done";
    if (s.includes("બાકી")) return "task_pending";
  }

  if (step === "task_pending") {
    if (speech.length > 10) return "problem_recorded";
    return "no_details";
  }

  return "fallback";
}

function sayAndGather(twiml, text) {
  const gather = twiml.gather({
    input: "speech",
    action: "/twilio/gather",
    method: "POST",
    speechTimeout: "auto",
    bargeIn: true,
    language: "gu-IN"
  });

  gather.say({ voice: "Polly.Aditi", language: "gu-IN" }, text);
}

/* =====================
   HEALTH
===================== */
app.get("/health", (_, res) => res.json({ status: "ok" }));

/* =====================
   CALL ENTRY
===================== */
app.post("/twilio/voice", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = req.body.CallSid;

  callState.set(callSid, { step: "intro", problem: "" });

  sayAndGather(twiml, getStep("intro").prompt);
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

  const state = callState.get(callSid) || { step: "intro", problem: "" };
  const nextStepId = detectNextStep(state.step, speech);
  const nextStep = getStep(nextStepId);

  if (state.step === "task_pending" && speech.length > 10) {
    state.problem = speech;
  }

  state.step = nextStepId;
  callState.set(callSid, state);

  /* LOG STRUCTURED DATA */
  if (LOG_WEBHOOK_URL) {
    fetch(LOG_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: from,
        step: nextStepId,
        speech,
        problem: state.problem,
        time: new Date().toISOString()
      })
    }).catch(() => {});
  }

  /* HUMAN ESCALATION */
  if (/agent|human|officer|complaint/i.test(speech)) {
    const dial = twiml.dial({
      callerId: TWILIO_PHONE_NUMBER,
      answerOnBridge: true
    });
    dial.number(HUMAN_AGENT_NUMBER);
    return res.type("text/xml").send(twiml.toString());
  }

  if (!nextStep.options.length) {
    twiml.say({ voice: "Polly.Aditi", language: "gu-IN" }, nextStep.prompt);
    twiml.hangup();
  } else {
    sayAndGather(twiml, nextStep.prompt);
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
  console.log(`✅ Flow-based Voice Agent running on ${PORT}`)
);
