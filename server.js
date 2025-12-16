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
   SAFE HUMAN TRANSFER
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
  <Say voice="Polly.Amit" language="hi-IN">
    कृपया प्रतीक्षा करें। हम आपको अधिकारी से जोड़ रहे हैं।
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
    <Say voice="Polly.Amit" language="hi-IN">
      नमस्ते। भाषा चुनें।
      हिंदी के लिए 1 दबाएँ।
      ગુજરાતી માટે 2 દબાવો.
      English ke liye 3 dabaye.
    </Say>
  </Gather>
  <Say>We did not receive any input.</Say>
  <Hangup/>
</Response>`;
  res.type("text/xml").send(twiml);
});

/* =====================
   STEP 2 — LANGUAGE ROUTER
===================== */
app.post("/twilio/language", (req, res) => {
  const digit = req.body.Digits;

  if (digit === "1") return res.type("text/xml").send(taskCheckHindi());
  if (digit === "2") return res.type("text/xml").send(taskCheckGujarati());
  if (digit === "3") return res.type("text/xml").send(taskCheckEnglish());

  return res.type("text/xml").send(humanTransferTwiml());
});

/* =====================
   STEP 3 — TASK CHECK (HI)
===================== */
function taskCheckHindi() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" timeout="5" action="${BASE_URL}/twilio/result/hi" method="POST">
    <Say voice="Polly.Amit" language="hi-IN">
      क्या आपका काम पूरा हो गया है?
      हाँ के लिए 1 दबाएँ।
      नहीं के लिए 2 दबाएँ।
    </Say>
  </Gather>
  <Hangup/>
</Response>`;
}

/* =====================
   STEP 3 — TASK CHECK (GU)
===================== */
function taskCheckGujarati() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" timeout="5" action="${BASE_URL}/twilio/result/gu" method="POST">
    <Say voice="Polly.Amit" language="hi-IN">
      શું આપનું કામ પૂર્ણ થયું છે?
      હા માટે 1 દબાવો.
      ના માટે 2 દબાવો.
    </Say>
  </Gather>
  <Hangup/>
</Response>`;
}

/* =====================
   STEP 3 — TASK CHECK (EN)
===================== */
function taskCheckEnglish() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" timeout="5" action="${BASE_URL}/twilio/result/en" method="POST">
    <Say voice="alice">
      Has your work been completed?
      Press 1 for yes.
      Press 2 for no.
    </Say>
  </Gather>
  <Hangup/>
</Response>`;
}

/* =====================
   STEP 4 — RESULT HANDLER
===================== */
app.post("/twilio/result/:lang", (req, res) => {
  const digit = req.body.Digits;

  if (digit === "1") {
    return res.type("text/xml").send(successMessage(req.params.lang));
  }

  if (digit === "2") {
    return res.type("text/xml").send(humanTransferTwiml());
  }

  return res.type("text/xml").send(humanTransferTwiml());
});

/* =====================
   SUCCESS MESSAGE
===================== */
function successMessage(lang) {
  if (lang === "hi") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amit" language="hi-IN">
    धन्यवाद। आपकी जानकारी दर्ज कर ली गई है।
  </Say>
  <Hangup/>
</Response>`;
  }

  if (lang === "gu") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amit" language="hi-IN">
    આભાર. તમારી માહિતી નોંધાઈ ગઈ છે.
  </Say>
  <Hangup/>
</Response>`;
  }

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

  if (!req.body.to) {
    return res.status(400).json({ error: "Missing 'to' number" });
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
  console.log(`✅ Voice Agent running safely on ${PORT}`);
});
