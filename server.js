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
  res.json({ status: "ok", service: "VoiceAgent" });
});

/* =====================
   LANGUAGE DETECTION
===================== */
function detectLanguage(text = "") {
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  return "en";
}

function voiceConfig(lang) {
  if (lang === "gu" || lang === "hi") {
    return { voice: "Polly.Amit", language: "hi-IN" };
  }
  return { voice: "alice", language: "en-IN" };
}

/* =====================
   TRANSFER TO HUMAN
===================== */
function transferTwiml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amit" language="hi-IN">
    कृपया प्रतीक्षा करें। मैं आपको अधिकारी से जोड़ रहा हूँ।
  </Say>
  <Dial callerId="${TWILIO_PHONE_NUMBER}">
    <Number>${HUMAN_AGENT_NUMBER}</Number>
  </Dial>
</Response>`;
}

/* =====================
   STEP 1 — CALL START
===================== */
app.post("/twilio/voice", (req, res) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amit" language="hi-IN">
    नमस्ते। मैं आपकी सहायता के लिए कॉल कर रहा हूँ।
    क्या अभी बात करने का समय है?
  </Say>
  <Gather input="speech"
          timeout="5"
          action="${BASE_URL}/twilio/gather?step=1"
          language="hi-IN"/>
</Response>`;

  res.type("text/xml").send(twiml);
});

/* =====================
   STEP 2 — USER RESPONSE
===================== */
app.post("/twilio/gather", (req, res) => {
  const speech = (req.body.SpeechResult || "").toLowerCase();
  const lang = detectLanguage(speech);
  const { voice, language } = voiceConfig(lang);

  // 🔴 Human transfer keywords
  if (
    speech.includes("agent") ||
    speech.includes("officer") ||
    speech.includes("help") ||
    speech.includes("मानव") ||
    speech.includes("અધિકારી")
  ) {
    return res.type("text/xml").send(transferTwiml());
  }

  // 🔴 Silence / unclear
  if (!speech || speech.length < 3) {
    return res.type("text/xml").send(transferTwiml());
  }

  // 🟢 Normal flow
  const reply =
    lang === "gu"
      ? "સમજાયું. તમારી માહિતી નોંધવામાં આવી છે."
      : lang === "hi"
      ? "समझ गया। आपकी जानकारी दर्ज कर ली गई है।"
      : "Understood. Your information has been recorded.";

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">
    ${reply}
  </Say>
  <Say voice="${voice}" language="${language}">
    धन्यवाद। हम जल्द ही आपसे संपर्क करेंगे।
  </Say>
  <Hangup/>
</Response>`;

  res.type("text/xml").send(twiml);
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
      url: `${BASE_URL}/twilio/voice`
    });

    res.json({ success: true, sid: call.sid });
  } catch (e) {
    console.error("Call failed:", e);
    res.status(500).json({ error: "Call failed" });
  }
});

/* =====================
   SERVER START
===================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ AI Voice Agent running on ${PORT}`);
});
