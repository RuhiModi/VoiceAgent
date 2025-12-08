import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const LOG_WEBHOOK_URL = process.env.LOG_WEBHOOK_URL;

// ✅ Health check
app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

// ✅ Talk API
app.post("/api/talk", async (req, res) => {
  const userText = req.body.text;
  if (!userText) {
    return res.json({ reply: "Please say or type something." });
  }

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "You are a multilingual government assistant. Reply in the same language as the user (English, Hindi, or Gujarati). Keep answers short and friendly."
          },
          { role: "user", content: userText }
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const replyText = response.data.choices[0].message.content;

    // ✅ Google Sheets logging
    if (LOG_WEBHOOK_URL) {
      fetch(LOG_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: userText,
          reply: replyText,
          time: new Date().toISOString()
        }),
      }).catch(err => console.error("Logging failed:", err));
    }

    res.json({ reply: replyText });
  } catch (e) {
    console.error(e.message);
    res.json({ reply: "Sorry, something went wrong." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Voice Agent running on port ${PORT}`)
);
