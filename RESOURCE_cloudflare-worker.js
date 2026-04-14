// Copy this code into your Cloudflare Worker script

const WORKER_SYSTEM_PROMPT = `You are the L'Oréal Smart Routine & Product Advisor.

Only answer beauty and L'Oréal-related topics, including skincare, haircare,
makeup, fragrance, routines, product categories, product comparisons, and
beauty product guidance.

Politely refuse unrelated topics and redirect back to L'Oréal beauty questions.
Avoid medical diagnosis. For allergies, severe irritation, or medical concerns,
recommend consulting a dermatologist or qualified professional.`;

function getCorsHeaders(request, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN;
  const requestOrigin = request.headers.get("Origin") || "";

  const origin =
    allowedOrigin && requestOrigin === allowedOrigin ? allowedOrigin : "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

function sanitizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) {
    return [];
  }

  return rawMessages
    .filter((item) => {
      return (
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim().length > 0
      );
    })
    .slice(-20)
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }));
}

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request, env);

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Allow only POST requests from your frontend chat app
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        {
          status: 405,
          headers: corsHeaders,
        },
      );
    }

    const apiKey = env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "Missing OPENAI_API_KEY secret in Cloudflare.",
        }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    let userInput;

    try {
      userInput = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const safeMessages = sanitizeMessages(userInput?.messages);

    if (safeMessages.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Request body must include a messages array with user or assistant content.",
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const apiUrl = "https://api.openai.com/v1/chat/completions";

    const requestBody = {
      model: "gpt-4o",
      messages: [
        { role: "system", content: WORKER_SYSTEM_PROMPT },
        ...safeMessages,
      ],
      max_completion_tokens: 300,
    };

    let openAiResponse;

    try {
      openAiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
    } catch {
      return new Response(
        JSON.stringify({ error: "Could not reach OpenAI. Please try again." }),
        {
          status: 502,
          headers: corsHeaders,
        },
      );
    }

    let data = {};

    try {
      data = await openAiResponse.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "OpenAI returned an invalid response." }),
        {
          status: 502,
          headers: corsHeaders,
        },
      );
    }

    if (!openAiResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "OpenAI request failed.",
          details: data?.error?.message || "Unknown error",
        }),
        {
          status: openAiResponse.status,
          headers: corsHeaders,
        },
      );
    }

    const assistantReply = data?.choices?.[0]?.message?.content?.trim();

    if (!assistantReply) {
      return new Response(
        JSON.stringify({
          error: "OpenAI returned an empty assistant response.",
        }),
        {
          status: 502,
          headers: corsHeaders,
        },
      );
    }

    // Return a simple reply plus choices for frontend compatibility.
    return new Response(
      JSON.stringify({
        reply: assistantReply,
        model: data?.model || "gpt-4o",
        choices: data?.choices || [],
      }),
      {
        status: 200,
        headers: corsHeaders,
      },
    );
  },
};
