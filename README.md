# Project 8: L'Oréal Chatbot

A vanilla HTML/CSS/JavaScript beauty chatbot that answers questions about
L'Oréal products, routines, skincare, haircare, makeup, and fragrance.

**Live demo:** https://jubinshaikh.github.io/08-prj-loreal-chatbot/

## Features

- L'Oréal-inspired chat interface with user and assistant bubbles
- Conversation history maintained across turns within a session
- Latest user question displayed above each assistant reply
- Loading and error states with accessible live-region announcements
- OpenAI API key never touches the browser — all requests proxy through a
  Cloudflare Worker

## Architecture

```
Browser (GitHub Pages)
  → POST { messages } → Cloudflare Worker (summer-base-7fbd)
      → prepends system prompt, injects API key
      → POST → OpenAI /v1/chat/completions
      ← { reply }
```

The system prompt lives in the Worker, not in `script.js`. Anything in the
frontend is readable and editable by anyone visiting the site.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and chat markup |
| `style.css` | Design system, layout, chat bubble styling |
| `script.js` | Chat logic, conversation history, Worker requests |
| `RESOURCE_cloudflare-worker.js` | Source of truth for the deployed Worker |

## Run locally

1. Open this repo in GitHub Codespaces.
2. Open `index.html` with Live Preview.

The frontend calls the deployed Worker directly, so no local backend is needed.

## Cloudflare Worker setup

The Worker is deployed through the Cloudflare dashboard. To reproduce it:

1. Create a Worker and paste in the contents of
   `RESOURCE_cloudflare-worker.js`.
2. Under **Settings → Variables and Secrets**, add:

   | Name | Type | Value |
   | --- | --- | --- |
   | `OPENAI_API_KEY` | Secret | Your OpenAI API key |
   | `MODEL` | Variable | `gpt-4.1-mini` |
   | `ALLOWED_ORIGIN` | Variable | `https://jubinshaikh.github.io` |

   `ALLOWED_ORIGIN` must have no trailing slash and no repository path.

3. Click **Deploy**. Saving alone does not publish changes.
4. Set `API_URL` at the top of `script.js` to the deployed Worker URL.

Whenever the Worker changes, update both the Cloudflare dashboard and
`RESOURCE_cloudflare-worker.js` so the repo stays accurate.

### Cost controls

The Worker runs under a dedicated OpenAI project with a spend limit and a
model allowlist, so a leaked Worker URL cannot run up an unbounded bill.

## Request and response shape

Frontend sends:

```json
{
  "messages": [
    { "role": "user", "content": "What cleanser suits oily skin?" },
    { "role": "assistant", "content": "..." }
  ]
}
```

Only `user` and `assistant` roles are accepted; the Worker discards anything
else and keeps the 20 most recent messages.

Worker returns:

```json
{
  "reply": "...",
  "model": "gpt-4.1-mini",
  "choices": []
}
```

On failure it returns a non-2xx status with `{ error, details }`, which the
frontend surfaces in the chat window.

## Testing the Worker

```bash
# Should return a reply
curl -s -X POST https://summer-base-7fbd.shaikhjn.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"recommend a face wash"}]}'

# Should return 403 Origin not allowed
curl -s -X POST https://summer-base-7fbd.shaikhjn.workers.dev/ \
  -H "Content-Type: application/json" \
  -H "Origin: https://example.com" \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
```

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `invalid_api_key` | Wrong or rotated key in the Worker secret |
| `insufficient_quota` | No credits on the OpenAI account |
| `model_not_found` | `MODEL` not available to your account |
| `403 Origin not allowed` | `ALLOWED_ORIGIN` does not match the site origin |
| Empty reply, `finish_reason: length` | Raise `max_completion_tokens` |
| Site shows old code | GitHub Pages cache — hard refresh with Ctrl+Shift+R |
