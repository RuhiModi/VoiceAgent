import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import twilio from "twilio";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  GROQ_API_KEY,
  RENDER_EXTERNAL_URL,
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/* -------------------------------
   AI REPLY (LANG DETECTION)
-------------------------------- */
async function askAI(userText) {
  const systemPrompt = `
You are a Government Scheme Helpdesk AI.
Reply ONLY in JSON:
{
  "lang": "en" | "hi" | "gu",
  "reply": "short response"
}
Detect language automatically.
Reply politely.
`;

  const res = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const raw = res.data.choices[0].message.content;
  try {
    return JSON.parse(raw);
  } catch {
    return { lang: "en", reply: raw };
  }
}

/* -------------------------------
   TWILIO ENTRY POINT
-------------------------------- */
app.post("/twilio/voice", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  const gather = twiml.gather({
    input: "speech",
    timeout: 4,
    speechTimeout: "auto",
    method: "POST",
    action: "/twilio/process",
  });

  gather.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    "Namaste. Government scheme helpline. How may I help you?"
  );

  res.type("text/xml");
  res.send(twiml.toString());
});

/* -------------------------------
   PROCESS SPEECH
-------------------------------- */
app.post("/twilio/process", async (req, res) => {
  const speech = req.body.SpeechResult || "";

  const { lang, reply } = await askAI(speech);

  let sayOptions = { voice: "Polly.Joanna", language: "en-US" };
  if (lang === "hi") sayOptions = { voice: "Polly.Aditi", language: "hi-IN" };
  if (lang === "gu") sayOptions = { voice: "Polly.Aditi", language: "hi-IN" };

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(sayOptions, reply);
  twiml.pause({ length: 1 });
  twiml.redirect("/twilio/voice");

  res.type("text/xml");
  res.send(twiml.toString());
});

/* -------------------------------
   OUTBOUND CALL (OPTIONAL)
-------------------------------- */
app.post("/start-call", async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: "Missing number" });

  const call = await client.calls.create({
    to,
    from: TWILIO_PHONE_NUMBER,
    url: `${RENDER_EXTERNAL_URL}/twilio/voice`,
  });

  res.json({ success: true, sid: call.sid });
});

/* -------------------------------
   HEALTH
-------------------------------- */
app.get("/health", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`📞 Phone agent running on port ${PORT}`)
);
