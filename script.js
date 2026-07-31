/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");

/*
  Replace this with your deployed Cloudflare Worker URL.
  The frontend sends messages to the worker, and the worker talks to OpenAI.
*/
const API_URL = "https://summer-base-7fbd.shaikhjn.workers.dev/";
const WELCOME_MESSAGE =
  "Welcome to the L'Oréal Beauty Advisor. Ask me about products, routines, makeup, haircare, skincare, or fragrance.";
const LOADING_MESSAGE = "Thinking about your beauty question...";
const FRIENDLY_ERROR_PREFIX =
  "Sorry, I couldn't reach the beauty assistant right now.";

/*
  Keep the system prompt separate so it always stays at the front of the
  messages array we send to the API.
*/

/* Stores the conversation for the current browser session. */
const chatHistory = [];

/* Show a friendly welcome message when the page loads. */
addAssistantBubble(WELCOME_MESSAGE);

chatForm.addEventListener("submit", handleSendMessage);

function handleSendMessage(event) {
  event.preventDefault();

  const message = userInput.value.trim();

  if (!message) {
    return;
  }

  // Show the user's message immediately.
  addUserBubble(message);
  chatHistory.push({ role: "user", content: message });

  // Clear the input right away so the next question starts fresh.
  userInput.value = "";
  userInput.focus();

  // Show a loading message while we wait for the worker response.
  const loadingBubble = addAssistantBubble(LOADING_MESSAGE, "loading");
  setLoadingState(true);

  sendToAssistant(message, loadingBubble);
}

async function sendToAssistant(latestQuestion, loadingBubble) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: chatHistory }),
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      throw new Error("Worker returned an invalid response.");
    }

    if (!response.ok) {
      const workerError = data?.error || "Worker request failed.";
      throw new Error(workerError);
    }

    // Support either `reply` or OpenAI-like `choices` from the worker.
    const assistantReply =
      data?.reply?.trim() || data?.choices?.[0]?.message?.content?.trim();

    if (!assistantReply) {
      throw new Error("Empty assistant response");
    }

    chatHistory.push({ role: "assistant", content: assistantReply });
    replaceBubbleWithReply(
      loadingBubble,
      latestQuestion,
      assistantReply,
      false,
    );
  } catch (error) {
    const safeErrorText =
      error instanceof Error ? error.message : "Unknown error.";
    const fallbackMessage = `${FRIENDLY_ERROR_PREFIX} ${safeErrorText} Please try again in a moment.`;

    replaceBubbleWithReply(
      loadingBubble,
      latestQuestion,
      fallbackMessage,
      true,
    );
  } finally {
    setLoadingState(false);
    scrollChatToBottom();
  }
}

function addUserBubble(message) {
  const bubble = createMessageBubble("msg user", "You", message);
  chatWindow.appendChild(bubble);
  scrollChatToBottom();

  return bubble;
}

function addAssistantBubble(message, extraClass = "") {
  const bubbleClass = extraClass ? `msg ai ${extraClass}` : "msg ai";
  const bubble = createMessageBubble(bubbleClass, "Assistant", message);
  chatWindow.appendChild(bubble);
  scrollChatToBottom();

  return bubble;
}

function createMessageBubble(className, labelText, messageText) {
  const bubble = document.createElement("div");
  bubble.className = className;

  const label = document.createElement("strong");
  label.textContent = labelText;

  const text = document.createElement("div");
  text.textContent = messageText;

  bubble.append(label, text);
  return bubble;
}

function replaceBubbleWithReply(bubble, latestQuestion, replyText, isError) {
  bubble.innerHTML = "";
  bubble.classList.remove("loading");
  bubble.classList.toggle("error", isError);

  const label = document.createElement("strong");
  label.textContent = "Assistant";

  const questionLine = document.createElement("div");
  questionLine.className = "latest-question";
  questionLine.textContent = `Latest question: ${latestQuestion}`;

  const replyLine = document.createElement("div");
  replyLine.className = "assistant-reply";
  replyLine.textContent = replyText;

  bubble.append(label, questionLine, replyLine);
}

function setLoadingState(isLoading) {
  sendBtn.disabled = isLoading;
  sendBtn.setAttribute("aria-disabled", String(isLoading));
  userInput.disabled = isLoading;
  sendBtn.setAttribute("aria-busy", String(isLoading));
}

function scrollChatToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
