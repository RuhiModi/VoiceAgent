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
   LANGUAGE DETECTION
===================== */
function detectLanguage(text = "") {
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  return "en";
}

function voiceTag(lang) {
  if (lang === "gu" || lang === "hi") {
    return `voice="Polly.Amit" language="hi-IN"`;
  }
  return `voice="alice" language="en-IN"`;
}

/* =====================
   HUMAN TRANSFER (SAFE)
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
    कृपया प्रतीक्षा करें। मैं आपको अधिकारी से जोड़ रहा हूँ।
  </Say>
  <Dial callerId="${TWILIO_PHONE_NUMBER}">
    <Number>${HUMAN_AGENT_NUMBER}</Number>
  </Dial>
</Response>`;
}

/* =====================
   STEP 1 — CALL ENTRY
===================== */
app.post("/twilio/voice", (req, res) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amit" language="hi-IN">
    नमस्ते। मैं आपकी सहायता के लिए कॉल कर रहा हूँ।
    क्या अभी बात करने का समय है?
  </Say>

  <Gather
    input="speech"
    timeout="5"
    speechTimeout="auto"
    action="${BASE_URL}/twilio/gather"
    method="POST"
    language="hi-IN" />

  <!-- SAFETY: if Gather fails -->
  <Say voice="Polly.Amit" language="hi-IN">
    कोई उत्तर नहीं मिला।
  </Say>
  <Hangup/>
</Response>`;

  res.type("text/xml").status(200).send(twiml);
});

/* =====================
   STEP 2 — USER RESPONSE
===================== */
app.post("/twilio/gather", (req, res) => {
  const speechRaw = req.body.SpeechResult || "";
  const speech = speechRaw.trim().toLowerCase();

  // 🔒 ABSOLUTE SAFETY — silence or empty
  if (!speech || speech.length < 2) {
    return res.type("text/xml").send(humanTransferTwiml());
  }

  const lang = detectLanguage(speech);
  const voice = voiceTag(lang);

  // 🔁 Keywords → human
  if (
    speech.includes("agent") ||
    speech.includes("officer") ||
    speech.includes("help") ||
    speech.includes("मानव") ||
    speech.includes("अधिकारी") ||
    speech.includes("અધિકારી")
  ) {
    return res.type("text/xml").send(humanTransferTwiml());
  }

  // 🟢 Normal AI-like reply
  let reply;
  if (lang === "gu") {
    reply = "સમજાયું. તમારી માહિતી નોંધવામાં આવી છે.";
  } else if (lang === "hi") {
    reply = "समझ गया। आपकी जानकारी दर्ज कर ली गई है।";
  } else {
    reply = "Understood. Your information has been recorded.";
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say ${voice}>
    ${reply}
  </Say>
  <Say ${voice}>
    धन्यवाद। हम जल्द ही आपसे संपर्क करेंगे।
  </Say>
  <Hangup/>
</Response>`;

  res.type("text/xml").status(200).send(twiml);
});

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
  console.log(`✅ AI Voice Agent running safely on ${PORT}`);
});
