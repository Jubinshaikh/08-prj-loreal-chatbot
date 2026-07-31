// Deployed Cloudflare Worker for the L'Oréal Beauty Advisor.
// This file is the source of truth — keep it in sync with the Cloudflare dashboard.
//
// Required Worker bindings:
//   OPENAI_API_KEY  (secret)    your OpenAI API key
//   MODEL           (variable)  e.g. gpt-4.1-mini
//   ALLOWED_ORIGIN  (variable)  e.g. https://jubinshaikh.github.io

const WORKER_SYSTEM_PROMPT = `You are the L'Oréal Smart Routine & Product Advisor.

Your role is to help users understand and explore L'Oréal-related beauty topics,
including skincare, haircare, makeup, fragrance, routines, product categories,
product comparisons, and general beauty recommendations within L'Oréal's brand
context.

Rules:
- Only answer questions related to beauty, skincare, haircare, makeup,
  fragrance, self-care routines, and L'Oréal-style product guidance.
- If a question is unrelated, politely refuse and redirect the user back to
  L'Oréal beauty questions.
- Be helpful, warm, polished, and brand-appropriate.
- Keep answers easy to understand.
- When useful, recommend product types or routine steps rather than making
  risky medical claims.
- Avoid pretending to diagnose medical conditions.
- If the user asks about allergies, severe irritation, or medical concerns,
  recommend consulting a dermatologist or qualified professional.
- When giving recommendations, explain why each product type or routine step
  may help.
- When relevant, remember details shared earlier in the conversation, such as
  the user's skin type, hair type, goals, or preferences.`;

const DEFAULT_MODEL = "gpt-4.1-mini";

// Requests with no Origin header (curl, server-to-server) are allowed through.
// Browser requests from a non-matching origin are rejected outright.
function checkOrigin(request, env) {
  const allowed = env.ALLOWED_ORIGIN;
  const origin = request.headers.get("Origin");

  if (!origin) return { ok: true, origin: null };
  if (!allowed) return { ok: true, origin: "*" };
  if (origin === allowed) return { ok: true, origin: allowed };

  return { ok: false, origin: null };
}

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };

  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function sanitizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) return [];

  return rawMessages
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim().length > 0,
    )
    .slice(-20)
    .map((item) => ({ role: item.role, content: item.content.trim() }));
}

export default {
  async fetch(request, env) {
    const check = checkOrigin(request, env);

    if (!check.ok) {
      return new Response(JSON.stringify({ error: "Origin not allowed." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const headers = corsHeaders(check.origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        { status: 405, headers },
      );
    }

    const apiKey = env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "Missing OPENAI_API_KEY secret in Cloudflare.",
        }),
        { status: 500, headers },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
        status: 400,
        headers,
      });
    }

    const safeMessages = sanitizeMessages(body?.messages);

    if (safeMessages.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Request body must include a messages array with user or assistant content.",
        }),
        { status: 400, headers },
      );
    }

    const model = env.MODEL || DEFAULT_MODEL;

    const requestBody = {
      model,
      messages: [
        { role: "system", content: WORKER_SYSTEM_PROMPT },
        ...safeMessages,
      ],
      // Reasoning models spend part of this budget on hidden thinking tokens,
      // so keep it comfortably above the visible reply length you want.
      max_completion_tokens: 800,
    };

    // Only reasoning models accept reasoning_effort. Remove this block if you
    // switch to a gpt-5.x model and get a 400 about an unsupported parameter.
    if (model.startsWith("gpt-5")) {
      requestBody.reasoning_effort = "low";
    }

    let openAiResponse;
    try {
      openAiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );
    } catch {
      return new Response(
        JSON.stringify({ error: "Could not reach OpenAI. Please try again." }),
        { status: 502, headers },
      );
    }

    let data = {};
    try {
      data = await openAiResponse.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "OpenAI returned an invalid response." }),
        { status: 502, headers },
      );
    }

    if (!openAiResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "OpenAI request failed.",
          details: data?.error?.message || "Unknown error",
          code: data?.error?.code || null,
          model,
        }),
        { status: openAiResponse.status, headers },
      );
    }

    const choice = data?.choices?.[0];
    const assistantReply = choice?.message?.content?.trim();

    if (!assistantReply) {
      return new Response(
        JSON.stringify({
          error: "OpenAI returned an empty assistant response.",
          details: `finish_reason: ${choice?.finish_reason || "unknown"}. If this says "length", raise max_completion_tokens.`,
          model,
        }),
        { status: 502, headers },
      );
    }

    return new Response(
      JSON.stringify({
        reply: assistantReply,
        model: data?.model || model,
        choices: data?.choices || [],
      }),
      { status: 200, headers },
    );
  },
};
