async function sendTextToAI(text) {
  try {
    const response = await fetch("/api/talk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const data = await response.json();

    document.getElementById("userSpeech").innerText = transcript;
    sendTextToAI(transcript);

    // Speak reply
    const utterance = new SpeechSynthesisUtterance(data.reply);

    // Hindi / English auto
    utterance.lang = /[ऀ-ॿ]/.test(data.reply) ? "hi-IN" : "en-IN";

    speechSynthesis.speak(utterance);

  } catch (err) {
    console.error(err);
    document.getElementById("aiReply").innerText =
      "Something went wrong.";
  }
}

