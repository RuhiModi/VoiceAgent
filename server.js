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

/* =====================
   TWILIO CLIENT
===================== */
const twilioClient = twilio(
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN
);

/* =====================
   LANGUAGE DETECTION
===================== */
function detectLanguage(text = "") {
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  return "en";
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
- Reply ONLY in ${lang === "hi" ? "Hindi" : lang === "gu" ? "Gujarati" : "English"}
- Keep replies under 60 words
- Speak naturally for phone calls
- Ask clarifying questions if needed
- Do NOT promise approval or money
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
  } catch {
    return lang === "hi"
      ? "माफ़ कीजिए, अभी तकनीकी समस्या है।"
      : lang === "gu"
      ? "માફ કરશો, હાલમાં તકનીકી સમસ્યા છે."
      : "Sorry, I’m having a technical issue right now.";
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
    "नमस्ते। તમે ગુજરાતી, हिंदी या English में बात कर सकते हैं। कृपया अपना सवाल पूछिए।"
  );

  res.type("text/xml").send(twiml.toString());
});

/* =====================
   CONVERSATION LOOP
===================== */
app.post("/twilio/gather", async (req, res) => {
  const userSpeech = req.body.SpeechResult || "";
  const from = req.body.From;
  const twiml = new twilio.twiml.VoiceResponse();

  if (!userSpeech) {
    twiml.redirect("/twilio/voice");
    return res.type("text/xml").send(twiml.toString());
  }

  /* ✅ SILENT HUMAN TRANSFER */
  const wantsHuman = /(human|agent|officer|operator|manager|complaint)/i.test(
    userSpeech
  );

  if (wantsHuman && HUMAN_AGENT_NUMBER) {
    twiml.dial(
      { callerId: TWILIO_PHONE_NUMBER },
      HUMAN_AGENT_NUMBER
    );
    return res.type("text/xml").send(twiml.toString());
  }

  const lang = detectLanguage(userSpeech);
  const reply = await askGroq(userSpeech, lang);
  const voice = getVoice(lang);

  /* ✅ LOG TO GOOGLE SHEET */
  if (LOG_WEBHOOK_URL) {
    fetch(LOG_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: from || "Unknown",
        userSpeech,
        aiReply: reply,
        language: lang,
        time: new Date().toISOString()
      })
    }).catch(() => {});
  }

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

  gather.say(voice, reply);
  res.type("text/xml").send(twiml.toString());
});

/* =====================
   START OUTBOUND CALL
===================== */
app.post("/start-call", async (req, res) => {
  if (req.headers["x-api-key"] !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const to = String(req.body?.to || "").trim();
  if (!/^\+[1-9]\d{9,14}$/.test(to)) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  try {
    const call = await twilioClient.calls.create({
      from: TWILIO_PHONE_NUMBER,
      to,
      url: `${RENDER_EXTERNAL_URL}/twilio/voice`
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
  console.log(`✅ Server running on port ${PORT}`);
});
