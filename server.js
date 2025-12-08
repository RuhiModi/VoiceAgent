import express from "express";
import axios from "axios";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "";

// -------------------------
//     GROQ LLM FUNCTION
// -------------------------

async function askGroq(message) {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are a helpful and friendly voice assistant." },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 200,
        top_p: 0.9
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices[0].message.content.trim();

  } catch (err) {
    console.error("🔥 Groq API Error:", err.response?.data || err.message);
    return "Sorry, I am having trouble responding right now.";
  }
}


// -------------------------
//     MAIN VOICE ROUTE
// -------------------------
app.post("/api/voice", async (req, res) => {
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.json({ reply: "I didn't hear anything. Please speak again." });
  }

  console.log("User said:", text);

  const reply = await askGroq(text);

  // Optional: Send logs to n8n (Google Sheets)
  if (N8N_WEBHOOK_URL) {
    try {
      await axios.post(N8N_WEBHOOK_URL, {
        user: text,
        agent: reply,
        time: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("⚠️ Failed to send data to n8n:", err.message);
    }
  }

  return res.json({ reply });
});

// -------------------------
//     START SERVER
// -------------------------
const port = 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
