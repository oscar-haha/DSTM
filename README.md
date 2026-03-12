# Group Calendar

A no-login, UK-timezone group calendar with WhatsApp-friendly link previews.

## Local dev
1. Install deps: `npm install`
2. Run dev server: `npm run dev`
3. Visit `http://localhost:3000`

## Environment variables
- `NEXT_PUBLIC_SITE_URL` (optional): Base URL for OG tags (e.g. `https://your-domain.com`)
- `DATA_PATH` (optional): File path for local file persistence (defaults to `.data/group-calendar.json`)
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` (recommended for Vercel): enables persistent storage via Vercel KV
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (optional): Enables Turnstile widget
- `TURNSTILE_SECRET_KEY` (optional): Validates Turnstile on the server

## Vercel notes
- Set `NEXT_PUBLIC_SITE_URL` to your Vercel domain.
- Add Turnstile keys if you want CAPTCHA on event creation.
- Data is file-based by default; for production, swap to a shared store (KV/DB).
