import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";

dotenv.config();

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
  INTERNAL_API_KEY,
  RENDER_EXTERNAL_URL
} = process.env;

const BASE_URL = RENDER_EXTERNAL_URL.replace(/\/$/, "");
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/* =====================
   HEALTH CHECK
===================== */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "VoiceAgent",
    time: new Date().toISOString()
  });
});

/* =====================
   HUMAN TRANSFER
===================== */
function humanTransferTwiml() {
  if (!HUMAN_AGENT_NUMBER) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you. Goodbye.</Say>
  <Hangup/>
</Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">
    Please wait while I connect you to a human agent.
  </Say>
  <Dial callerId="${TWILIO_PHONE_NUMBER}">
    <Number>${HUMAN_AGENT_NUMBER}</Number>
  </Dial>
</Response>`;
}

/* =====================
   STEP 1 — LANGUAGE MENU
===================== */
app.post("/twilio/voice", (req, res) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" timeout="5" action="${BASE_URL}/twilio/language" method="POST">
    <Say voice="alice">
      Hello. Please choose your language.
      Press 1 for Hindi.
      Press 2 for Gujarati.
      Press 3 for English.
    </Say>
  </Gather>
  <Say voice="alice">No input received.</Say>
  <Hangup/>
</Response>`;
  res.type("text/xml").send(twiml);
});

/* =====================
   STEP 2 — LANGUAGE ROUTER
===================== */
app.post("/twilio/language", (req, res) => {
  const digit = req.body.Digits;

  if (digit === "1") return res.type("text/xml").send(taskCheck("hi"));
  if (digit === "2") return res.type("text/xml").send(taskCheck("gu"));
  if (digit === "3") return res.type("text/xml").send(taskCheck("en"));

  return res.type("text/xml").send(humanTransferTwiml());
});

/* =====================
   TASK CHECK
===================== */
function taskCheck(lang) {
  let message;

  if (lang === "hi") {
    message = "Has your work been completed? Press 1 for yes. Press 2 for no.";
  } else if (lang === "gu") {
    message = "Has your work been completed? Press 1 for yes. Press 2 for no.";
  } else {
    message = "Has your work been completed? Press 1 for yes. Press 2 for no.";
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" timeout="5" action="${BASE_URL}/twilio/result/${lang}" method="POST">
    <Say voice="alice">${message}</Say>
  </Gather>
  <Hangup/>
</Response>`;
}

/* =====================
   RESULT HANDLER
===================== */
app.post("/twilio/result/:lang", (req, res) => {
  const digit = req.body.Digits;

  if (digit === "1") {
    return res.type("text/xml").send(successMessage());
  }

  if (digit === "2") {
    return res.type("text/xml").send(humanTransferTwiml());
  }

  return res.type("text/xml").send(humanTransferTwiml());
});

/* =====================
   SUCCESS MESSAGE
===================== */
function successMessage() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">
    Thank you. Your information has been recorded.
  </Say>
  <Hangup/>
</Response>`;
}

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
      url: `${BASE_URL}/twilio/voice`
    });

    res.json({ success: true, sid: call.sid });
  } catch (err) {
    console.error("Twilio error:", err);
    res.status(500).json({ error: "Call failed" });
  }
});

/* =====================
   SERVER START
===================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Voice Agent running (DTMF, trial-safe) on ${PORT}`);
});
