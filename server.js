<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>PM Sahay – Government Scheme Voice Assistant</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">

  <style>
    :root {
      --saffron: #ff8c1a;
      --deep-saffron: #e86b00;
      --green: #138808;
      --white: #ffffff;
      --navy: #102a43;
      --blue: #0a66c2;
      --bg: #f4f6fb;
      --card: #ffffff;
      --shadow-soft: 0 18px 45px rgba(15, 37, 71, 0.18);
      --radius-xl: 24px;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: "Poppins", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      background: radial-gradient(circle at top left, #fff7e6 0, #f5fbff 38%, #edf4ff 75%);
      color: var(--navy);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 20px 40px;
      flex: 1;
    }

    /* Top Nav */
    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 32px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .chakra-logo {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 3px solid #0f3d91;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle, #ffffff 40%, #dbe8ff 100%);
      box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
      position: relative;
      overflow: hidden;
    }

    .chakra-logo span {
      width: 70%;
      height: 70%;
      border-radius: 50%;
      border: 2px dashed #0f3d91;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
      line-height: 1.1;
    }

    .brand-text .title {
      font-size: 18px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: linear-gradient(90deg, var(--saffron), #ffb347, var(--green));
      -webkit-background-clip: text;
      color: transparent;
    }

    .brand-text .subtitle {
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: #5f7287;
    }

    .nav-pill {
      padding: 8px 16px;
      border-radius: 999px;
      background: rgba(10, 102, 194, 0.08);
      border: 1px solid rgba(10, 102, 194, 0.35);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #0a3d7c;
    }

    .nav-pill-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #00c853;
      box-shadow: 0 0 0 6px rgba(0, 200, 83, 0.18);
    }

    /* Hero Section */
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
      gap: 30px;
      align-items: center;
    }

    @media (max-width: 840px) {
      .hero {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .hero-left {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    .flag-pill {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      padding: 6px 14px;
      border-radius: 999px;
      background: rgba(255, 140, 26, 0.06);
      border: 1px solid rgba(255, 140, 26, 0.4);
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      gap: 8px;
      color: #8a4a08;
    }

    .flag-pill span.flag {
      width: 18px;
      height: 12px;
      border-radius: 3px;
      overflow: hidden;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: column;
    }

    .flag-part {
      flex: 1;
    }

    .flag-part.saffron {
      background: #ff9933;
    }

    .flag-part.white {
      background: #ffffff;
      position: relative;
    }

    .flag-part.green {
      background: #138808;
    }

    .hero-title {
      font-size: clamp(28px, 4vw, 38px);
      font-weight: 700;
      line-height: 1.14;
      color: var(--navy);
    }

    .hero-title span.accent {
      background: linear-gradient(90deg, var(--saffron), var(--deep-saffron));
      -webkit-background-clip: text;
      color: transparent;
    }

    .hero-tagline {
      font-size: 15px;
      line-height: 1.6;
      color: #4a5c71;
      max-width: 520px;
    }

    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
    }

    .soft-badge {
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(16, 42, 67, 0.04);
      border: 1px dashed rgba(16, 42, 67, 0.18);
      color: #334e68;
    }

    .cta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-top: 6px;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--saffron), var(--deep-saffron));
      border: none;
      border-radius: 999px;
      padding: 11px 22px;
      font-size: 14px;
      font-weight: 600;
      color: #ffffff;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 14px 32px rgba(232, 107, 0, 0.45);
      transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      filter: brightness(1.03);
      box-shadow: 0 18px 40px rgba(232, 107, 0, 0.55);
    }

    .btn-primary span.dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.18);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
    }

    .btn-secondary {
      background: transparent;
      border-radius: 999px;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 500;
      color: #0a4f91;
      border: 1px solid rgba(10, 102, 194, 0.38);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      backdrop-filter: blur(9px);
      background: rgba(255, 255, 255, 0.5);
    }

    .btn-secondary span.icon {
      font-size: 16px;
    }

    .meta-row {
      margin-top: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      font-size: 11px;
      color: #6b7b8f;
    }

    .meta-item strong {
      display: block;
      font-size: 13px;
      color: #1f3b57;
    }

    /* Right: Call Card */
    .hero-right {
      display: flex;
      justify-content: flex-end;
    }

    .card {
      width: 100%;
      max-width: 380px;
      background: linear-gradient(145deg, #ffffff, #f2f7ff);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-soft);
      padding: 20px 18px 18px;
      position: relative;
      overflow: hidden;
    }

    .card::before {
      content: "";
      position: absolute;
      inset: -80px -60px auto auto;
      background: radial-gradient(circle at top right, rgba(255, 153, 51, 0.26), transparent 55%);
      opacity: 0.8;
      pointer-events: none;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }

    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: #102a43;
    }

    .card-subtitle {
      font-size: 11px;
      color: #627a96;
    }

    .status-chip {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(19, 136, 8, 0.08);
      color: #0f7a06;
      border: 1px solid rgba(19, 136, 8, 0.3);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #00c853;
      box-shadow: 0 0 0 4px rgba(0, 200, 83, 0.18);
    }

    .card-body {
      margin-top: 4px;
    }

    .label {
      font-size: 11px;
      font-weight: 500;
      color: #5c6c80;
      margin-bottom: 4px;
    }

    .input-shell {
      border-radius: 999px;
      border: 1px solid rgba(15, 37, 71, 0.12);
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      padding: 4px 4px 4px 10px;
      gap: 6px;
      margin-bottom: 10px;
    }

    .input-shell span.prefix {
      font-size: 12px;
      font-weight: 500;
      color: #41556f;
      padding-right: 6px;
      border-right: 1px solid rgba(65, 85, 111, 0.3);
    }

    .input-shell input {
      border: none;
      outline: none;
      flex: 1;
      font-family: inherit;
      font-size: 13px;
      padding: 8px 8px 8px 4px;
      background: transparent;
      color: #102a43;
    }

    .hint {
      font-size: 11px;
      color: #7f90a7;
      margin-bottom: 8px;
    }

    .small-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 10px;
      margin-bottom: 10px;
    }

    .pill-stat {
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(15, 37, 71, 0.08);
      padding: 8px 10px;
      font-size: 11px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .pill-stat span.label {
      font-size: 10px;
      color: #7a8a9f;
      text-transform: uppercase;
      letter-spacing: 0.09em;
    }

    .pill-stat span.value {
      font-size: 13px;
      font-weight: 600;
      color: #102a43;
    }

    .divider {
      margin: 10px 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(15, 37, 71, 0.12), transparent);
    }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 8px;
    }

    .btn-call {
      flex: 1;
      border-radius: 999px;
      border: none;
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 600;
      color: white;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, var(--blue), #0081ff);
      box-shadow: 0 12px 30px rgba(10, 102, 194, 0.45);
      transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
    }

    .btn-call:hover {
      transform: translateY(-1px);
      filter: brightness(1.03);
      box-shadow: 0 16px 40px rgba(10, 102, 194, 0.55);
    }

    .btn-call span.icon {
      font-size: 16px;
    }

    .card-mini-text {
      width: 40%;
      font-size: 10px;
      color: #7f90a7;
      text-align: right;
    }

    .status-bar {
      margin-top: 8px;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #60718a;
    }

    .status-bar span.dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #00c853;
    }

    .status-bar span.error {
      color: #c62828;
    }

    /* Toast */
    .toast {
      position: fixed;
      right: 16px;
      bottom: 18px;
      padding: 10px 14px;
      font-size: 12px;
      border-radius: 999px;
      background: rgba(16, 42, 67, 0.96);
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 16px 40px rgba(15, 37, 71, 0.6);
      opacity: 0;
      pointer-events: none;
      transform: translateY(12px);
      transition: opacity 0.18s ease, transform 0.18s ease;
      z-index: 20;
    }

    .toast.show {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    .toast span.icon {
      font-size: 16px;
    }

    .footer {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px 22px;
      font-size: 11px;
      color: #6c7c8e;
      display: flex;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .footer span strong {
      color: #34475c;
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- NAV -->
    <header class="nav">
      <div class="brand">
        <div class="chakra-logo">
          <span></span>
        </div>
        <div class="brand-text">
          <span class="title">PM SAHAY</span>
          <span class="subtitle">DIGITAL SARKARI SAHAYAK</span>
        </div>
      </div>
      <div class="nav-pill">
        <span class="nav-pill-dot"></span>
        24×7 AI Phone हेल्पलाइन (Beta)
      </div>
    </header>

    <!-- HERO -->
    <main class="hero">
      <!-- Left copy -->
      <section class="hero-left">
        <div class="flag-pill">
          <span class="flag">
            <span class="flag-part saffron"></span>
            <span class="flag-part white"></span>
            <span class="flag-part green"></span>
          </span>
          Bharat Sarkar Yojana Assist
        </div>

        <h1 class="hero-title">
          One phone call to understand
          <span class="accent">Government Schemes</span>
          in Gujarati, Hindi, or English.
        </h1>

        <p class="hero-tagline">
          PM Sahay is an AI phone assistant tuned for Indian Government schemes. 
          Ask about eligibility, benefits, or required documents — in your own language — 
          and get simple, human-style answers.
        </p>

        <div class="badge-row">
          <span class="soft-badge">🇮🇳 Multi-lingual: Gujarati / Hindi / English</span>
          <span class="soft-badge">🔊 Voice call based — no app needed</span>
          <span class="soft-badge">🪪 Focus on Sarkari Yojanas only</span>
        </div>

        <div class="cta-row">
          <button class="btn-primary" onclick="scrollToCard()">
            <span class="dot">📞</span>
            Start an AI Call
          </button>
          <button class="btn-secondary" onclick="alert('Later: open call history / cron dashboard UI')">
            <span class="icon">📊</span>
            View call analytics (coming soon)
          </button>
        </div>

        <div class="meta-row">
          <div class="meta-item">
            <strong>Designed for citizens</strong>
            Village, town, or city — everyone can call and ask.
          </div>
          <div class="meta-item">
            <strong>Backed by AI workflow</strong>
            Twilio + Groq + Google Sheet logging setup ready.
          </div>
        </div>
      </section>

      <!-- Right card -->
      <aside class="hero-right" id="call-card">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Start a test call</div>
              <div class="card-subtitle">Use your verified mobile number with +91</div>
            </div>
            <div class="status-chip">
              <span class="status-dot"></span>
              Live on Render
            </div>
          </div>

          <div class="card-body">
            <div class="label">Phone number</div>
            <form id="call-form">
              <div class="input-shell">
                <span class="prefix">+91</span>
                <input
                  type="tel"
                  id="phone-input"
                  placeholder="Enter 10-digit mobile (no 0 / +91)"
                  maxlength="10"
                  required
                />
              </div>
              <p class="hint">
                Example: 9876543210 → will call <strong>+919876543210</strong>.
              </p>

              <div class="small-grid">
                <div class="pill-stat">
                  <span class="label">Languages</span>
                  <span class="value">ગુજરાતી · हिंदी · English</span>
                </div>
                <div class="pill-stat">
                  <span class="label">Mode</span>
                  <span class="value">AI first, Human fallback</span>
                </div>
              </div>

              <div class="divider"></div>

              <div class="card-footer">
                <button type="submit" class="btn-call" id="call-btn">
                  <span class="icon">📞</span>
                  Call me now
                </button>
                <div class="card-mini-text">
                  Your number is used only to place this demo call. No OTP or app install needed.
                </div>
              </div>

              <div class="status-bar" id="status-bar">
                <span class="dot"></span>
                <span id="status-text">Ready. Enter your mobile number to receive a call.</span>
              </div>
            </form>
          </div>
        </div>
      </aside>
    </main>
  </div>

  <!-- Footer -->
  <footer class="footer">
    <span>Made for demo purposes — not an official government website.</span>
    <span><strong>Stack:</strong> Twilio · Node · Groq · Render · Google Sheets</span>
  </footer>

  <!-- Toast -->
  <div class="toast" id="toast">
    <span class="icon" id="toast-icon">✅</span>
    <span id="toast-text">Call triggered successfully.</span>
  </div>

  <script>
    // Change this to your real backend URL if testing outside Render
    const API_BASE = ""; 
    // "" means same origin: https://your-app.onrender.com/start-call

    function scrollToCard() {
      const el = document.getElementById("call-card");
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function showToast(message, variant = "success") {
      const toast = document.getElementById("toast");
      const icon = document.getElementById("toast-icon");
      const text = document.getElementById("toast-text");

      text.textContent = message;
      if (variant === "error") {
        toast.style.background = "rgba(183, 28, 28, 0.96)";
        icon.textContent = "⚠️";
      } else {
        toast.style.background = "rgba(16, 42, 67, 0.96)";
        icon.textContent = "✅";
      }

      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 3200);
    }

    document.getElementById("call-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("phone-input");
      const statusText = document.getElementById("status-text");
      const statusBar = document.getElementById("status-bar");
      const btn = document.getElementById("call-btn");

      const raw = (input.value || "").trim();
      const phone10 = raw.replace(/\D/g, "");

      if (phone10.length !== 10) {
        showToast("Please enter a valid 10-digit mobile number.", "error");
        statusText.textContent = "Invalid mobile number. Example: 9876543210.";
        statusBar.querySelector(".dot").style.background = "#c62828";
        return;
      }

      const fullE164 = "+91" + phone10;

      btn.disabled = true;
      btn.textContent = "Calling...";
      statusText.textContent = `Trying to call ${fullE164}...`;
      statusBar.querySelector(".dot").style.background = "#ff9800";

      try {
        const response = await fetch(API_BASE + "/start-call", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "your-secret-key-123" // MUST match INTERNAL_API_KEY
          },
          body: JSON.stringify({ to: fullE164 })
        });

        const data = await response.json();

        if (!response.ok) {
          console.error("Error from server:", data);
          showToast(data.error || "Failed to trigger call.", "error");
          statusText.textContent = data.error || "Call failed. Check Render logs.";
          statusBar.querySelector(".dot").style.background = "#c62828";
        } else {
          showToast("Call triggered successfully. Answer your phone!", "success");
          statusText.textContent = `Call in progress to ${fullE164}.`;
          statusBar.querySelector(".dot").style.background = "#00c853";
        }
      } catch (err) {
        console.error(err);
        showToast("Network error calling backend.", "error");
        statusText.textContent = "Unable to reach backend. Check URL / Render.";
        statusBar.querySelector(".dot").style.background = "#c62828";
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="icon">📞</span> Call me now';
      }
    });
  </script>
</body>
</html>
