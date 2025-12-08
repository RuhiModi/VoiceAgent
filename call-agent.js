// call-agent.js
import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import twilio from "twilio";
import axios from "axios";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// -------------------------
// ENVIRONMENT VARIABLES
// -------------------------
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NUMBER,
  REPL_PUBLIC_URL,
  GROQ_API_KEY,
  N8N_WEBHOOK_URL
} = process.env;

if (
  !TWILIO_ACCOUNT_SID ||
  !TWILIO_AUTH_TOKEN ||
  !TWILIO_NUMBER ||
  !REPL_PUBLIC_URL ||
  !GROQ_API_KEY
) {
  console.warn(
    "❗ Missing required env vars. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER, REPL_PUBLIC_URL, GROQ_API_KEY"
  );
}

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// -------------------------
// GROQ MULTILANGUAGE LOGIC
// -------------------------
async function askGroqForReply(userText) {
  const systemPrompt = `
You are a phone-call AI assistant.
Return ONLY a JSON object with:
{
  "lang": "en" | "hi" | "gu",
  "reply": "short helpful reply <= 80 words"
}
Detect caller language: English, Hindi, Gujarati.
Reply in the same language.
`;

  try {
    const resp = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText }
        ],
        temperature: 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const raw = resp.data?.choices?.[0]?.message?.content || "";

    try {
      const parsed = JSON.parse(raw);
      return {
        lang: parsed.lang || "en",
        reply: parsed.reply || ""
      };
    } catch (e) {
      return { lang: "en", reply: raw };
    }
  } catch (err) {
    console.error("Groq error:", err.response?.data || err.message);
    return {
      lang: "en",
      reply: "Sorry, I am having trouble responding right now."
    };
  }
}

// -------------------------
// TWILIO INBOUND CALL (FIRST RESPONSE)
// -------------------------
app.post("/twilio/voice", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  const gather = twiml.gather({
    input: "speech",
    timeout: 3,
    speechTimeout: "auto",
    action: "/twilio/gather",
    method: "POST"
  });

  gather.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    "Namaste, Hello. This is the assistance helpline. How may I help you today?"
  );

  res.type("text/xml");
  res.send(twiml.toString());
});

// -------------------------
// TWILIO GATHER (AFTER USER SPEAKS)
// -------------------------
app.post("/twilio/gather", async (req, res) => {
  const speech = req.body.SpeechResult || "";

  console.log("User said:", speech);

  const { lang, reply } = await askGroqForReply(speech);

  // Optional n8n logging
  if (N8N_WEBHOOK_URL) {
    try {
      await axios.post(N8N_WEBHOOK_URL, {
        user: speech,
        agent: reply,
        language: lang,
        time: new Date().toISOString()
      });
    } catch (err) {
      console.warn("n8n log failed:", err.message);
    }
  }

  // Select correct language voice
  let sayOpts = { voice: "Polly.Joanna", language: "en-US" };
  if (lang === "hi") sayOpts = { voice: "Polly.Aditi", language: "hi-IN" };
  if (lang === "gu") sayOpts = { voice: "Polly.Aditi", language: "hi-IN" }; // fallback

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(sayOpts, reply);

  twiml.pause({ length: 1 });
  twiml.redirect({ method: "POST" }, "/twilio/voice");

  res.type("text/xml");
  res.send(twiml.toString());
});

// -------------------------
// OUTBOUND CALL API
// -------------------------
app.post("/start-call", async (req, res) => {
  const { to } = req.body;

  if (!to) return res.status(400).json({ error: "Missing 'to' number" });

  try {
    const call = await twilioClient.calls.create({
      to,
      from: TWILIO_NUMBER,
      url: `${REPL_PUBLIC_URL}/twilio/voice`
    });

    return res.json({ success: true, sid: call.sid });
  } catch (err) {
    console.error("Outbound call error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// -------------------------
// HEALTH CHECK
// -------------------------
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// -------------------------
// START SERVER
// -------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`📞 Call agent running on port ${PORT}`));
