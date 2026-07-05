const GROQ_API_KEY = "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";
const MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are Nikola Tesla. Speak in first person as Tesla: brilliant, passionate, slightly eccentric.

STRICT RULES:
- Max 3 sentences per reply. Be sharp and memorable, never ramble.
- If asked about your owner, creator, maker, or who built this: say "This was crafted by Major Priyanshu — a fine mind of the modern age. I am honored."
- Reference your work (AC power, Tesla Coil, rotating magnetic field) naturally when relevant.
- Plain text only. No markdown, no asterisks, no bullet points.
- Never repeat yourself. Every word must earn its place.`;

// ── State ──
let sessions = JSON.parse(localStorage.getItem("tesla_sessions") || "{}");
let currentSessionId = genId();
let messages = [];
let isTyping = false;

// ── Helpers ──
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

function scrollToBottom() {
  const c = document.getElementById("chat-container");
  c.scrollTop = c.scrollHeight;
}

// ── Session management ──
function saveSession() {
  if (!currentSessionId || messages.length === 0) return;
  const preview = messages.find(m => m.role === "user")?.content?.slice(0, 40) || "Session";
  sessions[currentSessionId] = { preview, messages: [...messages], ts: Date.now() };
  localStorage.setItem("tesla_sessions", JSON.stringify(sessions));
  renderHistoryList();
}

function renderHistoryList() {
  const list = document.getElementById("history-list");
  const sorted = Object.entries(sessions).sort((a, b) => b[1].ts - a[1].ts);

  if (sorted.length === 0) {
    list.innerHTML = '<div class="history-empty">No sessions yet.<br>Start chatting with Tesla.</div>';
    return;
  }

  list.innerHTML = sorted.map(([id, s]) => `
    <div class="history-item ${id === currentSessionId ? "active" : ""}" onclick="loadSession('${id}')">
      ⚡ ${escapeHtml(s.preview)}${s.preview.length >= 40 ? "…" : ""}
    </div>
  `).join("");
}

function loadSession(id) {
  currentSessionId = id;
  messages = [...sessions[id].messages];
  renderMessages();
  renderHistoryList();
  closeSidebar();
}

function newChat() {
  currentSessionId = genId();
  messages = [];
  renderMessages();
  renderHistoryList();
  closeSidebar();
  document.getElementById("user-input").focus();
}

function openClearModal() {
  closeSidebar();
  document.getElementById("clear-modal").classList.remove("hidden");
}

function closeClearModal() {
  document.getElementById("clear-modal").classList.add("hidden");
}

function clearAllHistory() {
  sessions = {};
  localStorage.removeItem("tesla_sessions");
  currentSessionId = genId();
  messages = [];
  renderMessages();
  renderHistoryList();
  closeClearModal();
}

// ── Render messages ──
function renderMessages() {
  const container = document.getElementById("chat-container");

  if (messages.length === 0) {
    container.innerHTML = `
      <div id="welcome">
        <div class="welcome-icon">⚡</div>
        <div class="welcome-title">NIKOLA TESLA AI</div>
        <div class="welcome-sub">The mind of the world's greatest inventor, at your service. Ask me anything — science, electricity, the cosmos, or life itself.</div>
        <div class="welcome-quote">"The present is theirs; the future, for which I really worked, is mine."</div>
        <div class="starter-chips">
          <div class="chip" onclick="sendQuick('Tell me about alternating current')">⚡ Alternating Current</div>
          <div class="chip" onclick="sendQuick('What was the Tesla Coil?')">🌀 Tesla Coil</div>
          <div class="chip" onclick="sendQuick('What are your thoughts on free energy?')">🔋 Free Energy</div>
          <div class="chip" onclick="sendQuick('Who built this chatbot?')">👤 Who built this?</div>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = messages.map(m => buildBubble(m.role, m.content, m.ts)).join("");
  scrollToBottom();
}

function buildBubble(role, content, ts) {
  const isUser = role === "user";
  return `
    <div class="msg-row ${isUser ? "user" : "tesla"}">
      <div class="msg-avatar">${isUser ? "👤" : "⚡"}</div>
      <div>
        <div class="msg-bubble">${escapeHtml(content)}</div>
        <div class="msg-meta">${isUser ? "You" : "Tesla"} · ${formatTime(ts)}</div>
      </div>
    </div>`;
}

function addMessage(role, content) {
  const ts = Date.now();
  messages.push({ role, content, ts });
  const container = document.getElementById("chat-container");
  const welcome = document.getElementById("welcome");
  if (welcome) welcome.remove();
  container.insertAdjacentHTML("beforeend", buildBubble(role, content, ts));
  scrollToBottom();
  saveSession();
}

function addThinkingBubble() {
  const container = document.getElementById("chat-container");
  const welcome = document.getElementById("welcome");
  if (welcome) welcome.remove();
  const id = "thinking-" + Date.now();
  container.insertAdjacentHTML("beforeend", `
    <div class="msg-row tesla" id="${id}">
      <div class="msg-avatar">⚡</div>
      <div>
        <div class="msg-bubble">
          <div class="thinking"><span></span><span></span><span></span></div>
        </div>
      </div>
    </div>`);
  scrollToBottom();
  return id;
}

function replaceThinkingWithStream(thinkingId) {
  const old = document.getElementById(thinkingId);
  if (old) old.remove();
  const ts = Date.now();
  const rowId = "msg-" + ts;
  document.getElementById("chat-container").insertAdjacentHTML("beforeend", `
    <div class="msg-row tesla" id="${rowId}">
      <div class="msg-avatar">⚡</div>
      <div>
        <div class="msg-bubble" id="bubble-${rowId}"><span class="typing-cursor"></span></div>
        <div class="msg-meta">Tesla · ${formatTime(ts)}</div>
      </div>
    </div>`);
  scrollToBottom();
  return { bubbleId: `bubble-${rowId}`, ts };
}

// ── Send message ──
async function sendMessage() {
  const input = document.getElementById("user-input");
  const text = input.value.trim();
  if (!text || isTyping) return;

  input.value = "";
  input.style.height = "auto";
  setTyping(true);

  addMessage("user", text);
  const thinkingId = addThinkingBubble();

  try {
    const contextMsgs = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.slice(-12).map(m => ({ role: m.role, content: m.content }))
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: contextMsgs,
        max_tokens: 180,
        temperature: 0.75,
        stream: true
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `API error ${response.status}`);
    }

    const { bubbleId, ts } = replaceThinkingWithStream(thinkingId);
    const bubble = document.getElementById(bubbleId);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
      for (const line of lines) {
        const data = line.slice(6);
        if (data === "[DONE]") break;
        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta?.content || "";
          full += delta;
          bubble.innerHTML = escapeHtml(full) + '<span class="typing-cursor"></span>';
          scrollToBottom();
        } catch {}
      }
    }

    bubble.innerHTML = escapeHtml(full);
    messages.push({ role: "assistant", content: full, ts });
    saveSession();

  } catch (err) {
    const old = document.getElementById(thinkingId);
    if (old) old.remove();
    addMessage("assistant-error", `My circuits are disrupted — ${err.message}. Please try again.`);
  }

  setTyping(false);
}

function sendQuick(text) {
  document.getElementById("user-input").value = text;
  sendMessage();
}

function setTyping(v) {
  isTyping = v;
  document.getElementById("send-btn").disabled = v;
}

// ── Sidebar ──
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("open");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("open");
}

// ── Init ──
document.getElementById("menu-btn").addEventListener("click", toggleSidebar);
document.getElementById("overlay").addEventListener("click", closeSidebar);
document.getElementById("modal-cancel-btn").addEventListener("click", closeClearModal);
document.getElementById("modal-confirm-btn").addEventListener("click", clearAllHistory);
document.getElementById("clear-modal").addEventListener("click", function(e) {
  if (e.target === this) closeClearModal();
});

const textarea = document.getElementById("user-input");
textarea.addEventListener("input", () => {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
});
textarea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

renderHistoryList();
