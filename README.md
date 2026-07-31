# Project 8: L'Oréal Chatbot

This project is a vanilla HTML/CSS/JavaScript beauty chatbot for L'Oréal-themed
product and routine guidance.

## What Is Included

- Premium L'Oréal-inspired chat UI
- Conversation bubbles for user and assistant
- Conversation history across turns
- Latest user question shown above each assistant reply
- Frontend requests routed through a Cloudflare Worker
- OpenAI API key stored as a Cloudflare secret

## Run In Codespaces

1. Open this repo in GitHub Codespaces.
2. Open `index.html` with Live Preview.

## Cloudflare Worker Setup

1. Deploy the worker:

```bash
npx wrangler deploy RESOURCE_cloudflare-worker.js --name loreal-chatbot-worker
```

2. Add your OpenAI API key as a secret:

```bash
npx wrangler secret put OPENAI_API_KEY --name loreal-chatbot-worker
```

3. Copy your deployed worker URL (for example,
   `https://loreal-chatbot-worker.<your-subdomain>.workers.dev`) and set it as
   `API_URL` in `script.js`.

## Request/Response Shape

- Frontend sends:

```json
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ]
}
```

- Worker returns JSON with a `reply` field (and `choices` for compatibility).
