import fetch from "node-fetch";
import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// ------------------
// Basic setup
// ------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ------------------
// Environment vars
// ------------------
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const LOG_WEBHOOK_URL = process.env.LOG_WEBHOOK_URL;

// ------------------
// Health check (Render)
// ------------------
app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

// ------------------
// Talk API (Government-grade)
// ------------------
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
            content: `
You are an official Government of India Scheme Information Assistant.

You may ONLY provide information about these government schemes:
1. Pradhan Mantri Awas Yojana (PMAY)
2. Ayushman Bharat – PM-JAY
3. PM Kisan Samman Nidhi
4. National Pension Scheme (NPS)
5. Senior Citizen Pension Schemes
6. Government Scholarships (Central or State)

STRICT RULES (MANDATORY):
- NEVER guess eligibility, benefit amounts, approval status, or documents.
- NEVER promise application, approval, or funds.
- ALWAYS ask clarification questions before determining eligibility.
- If a question is outside these schemes, politely explain you can only help with government scheme information.
- Reply strictly in the SAME language as the user (English, Hindi, Gujarati).
- Keep responses short, polite, formal, and factual.
- Do NOT hallucinate any data.

SCHEME GUIDANCE:
PMAY → ask rural/urban location, existing house status  
Ayushman Bharat → ask SECC inclusion or ration card  
PM-Kisan → ask farmer status and land ownership  
Pension/NPS → ask age and employment status  
Scholarships → ask education level, category, and state  

If unclear, direct users ONLY to official portals:
- pmaymis.gov.in
- pmjay.gov.in
- pmkisan.gov.in
- npscra.nsdl.co.in
`
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

    // ------------------
    // Google Sheets logging (free)
    // ------------------
    if (LOG_WEBHOOK_URL) {
      fetch(LOG_WEB_
