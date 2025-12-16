import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true }));

/* =====================
   HEALTH CHECK
===================== */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* =====================
   TWILIO VOICE WEBHOOK
   (RAW TWIML — NO SDK)
===================== */
app.post("/twilio/voice", (req, res) => {
  const twiml = `
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-IN">
    Hello. This is a test call from your voice agent.
  </Say>
  <Hangup/>
</Response>
  `.trim();

  res.set("Content-Type", "text/xml");
  res.send(twiml);
});

/* =====================
   SERVER START
===================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Test Voice server running on ${PORT}`);
});
