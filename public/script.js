const startBtn = document.getElementById("startBtn");
const userSpeech = document.getElementById("userSpeech");
const aiReply = document.getElementById("aiReply");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const recognition = new SpeechRecognition();
recognition.lang = "en-IN";
recognition.interimResults = false;
recognition.continuous = false;

startBtn.onclick = () => {
  userSpeech.value = "";
  aiReply.value = "Listening...";
  recognition.start();
};

recognition.onresult = async (event) => {
  const text = event.results[0][0].transcript;
  userSpeech.value = text;
  aiReply.value = "Thinking...";

  try {
    const res = await fetch("/api/talk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    const data = await res.json();
    aiReply.value = data.reply;

    speak(data.reply);
  } catch (err) {
    aiReply.value = "Error contacting server.";
  }
};

function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = detectLang(text);
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function detectLang(text) {
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN";
  return "en-IN";
}
