/* ---------------------------------------------------------
   L'Oréal Smart Routine & Product Advisor — frontend
   Talks to your Cloudflare Worker. No API key lives here.
--------------------------------------------------------- */

// Your deployed Worker URL (from the Cloudflare dashboard)
const WORKER_URL = "https://summer-base-7fbd.shaikhjn.workers.dev/";

/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

/* Conversation history sent to the Worker on every request.
   The system prompt lives in the Worker, not here. */
const messages = [];

/* Initial greeting */
addMessage("ai", "👋 Hello! Ask me about L'Oréal products or routines.");

/* Add one message bubble to the chat window */
function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`; // .msg.user / .msg.ai are styled in style.css
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight; // keep newest message visible
  return div;
}

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = userInput.value.trim();
  if (!text) return;

  // Show the user's message and clear the input
  addMessage("user", text);
  messages.push({ role: "user", content: text });
  userInput.value = "";

  // Disable the form while waiting so the user can't double-send
  userInput.disabled = true;
  const thinking = addMessage("ai", "Thinking…");

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    const data = await response.json();

    if (!response.ok) {
      // The Worker sends { error, details } when something goes wrong
      thinking.textContent = `⚠️ ${data.details || data.error || "Request failed."}`;
      return;
    }

    // Worker returns { reply }, but fall back to the raw OpenAI shape
    const reply =
      data.reply || data?.choices?.[0]?.message?.content || "(empty response)";

    thinking.textContent = reply;
    messages.push({ role: "assistant", content: reply });
  } catch (err) {
    thinking.textContent =
      "⚠️ Could not reach the server. Check your connection and try again.";
    console.error(err);
  } finally {
    userInput.disabled = false;
    userInput.focus();
  }
});
