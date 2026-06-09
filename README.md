# JR Property Cleanup Quote Tool

A mobile-first PWA for field technicians to create comprehensive property cleanup quotes. The AI assistant guides technicians through a systematic property inspection (front, sides, back, garage, outbuildings) and generates a structured quote with line-item pricing.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, Tailwind CSS v4
- **AI**: OpenRouter → `anthropic/claude-3-5-sonnet`
- **Voice input**: Groq Whisper STT
- **Package manager**: pnpm
- **Deploy**: Vercel

## Environment Variables

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API key for Claude |
| `GROQ_API_KEY` | Groq API key for voice transcription |
| `N8N_JR_AUTH_WEBHOOK_URL` | n8n webhook for login/signup auth |
| `N8N_JR_QUOTE_WEBHOOK_URL` | n8n webhook to receive submitted quotes |
| `N8N_JR_UPLOAD_WEBHOOK_URL` | n8n webhook for photo uploads (optional) |
| `ADMIN_SECRET` | Secret for admin URL bypass (`?admin=SECRET`) |

## Running Locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** Voice input and photo capture require HTTPS. Use the Vercel preview deployment for device testing.

## Deploying to Vercel

```bash
vercel --prod
```

Or push to the `main` branch if Vercel GitHub integration is configured. Set all env vars in the Vercel project settings.

## Key Features

- Systematic 8-phase property inspection flow
- Photo upload per inspection area (compressed, sent to n8n)
- Voice input via Groq Whisper
- Auto-pricing engine with condition-based adjustments
- Bundle discount suggestions
- Quote submitted as structured JSON to n8n webhook
- PWA installable on iOS and Android
- Draft auto-save with 30-minute TTL

---

Built by [Samurai Solutions](https://www.samuraisolutions.co.uk/)
