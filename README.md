# Mirage

**Custom link previews that open as a 404.**
Pick a title and description, get a short link on `mrg.qd.je`, and paste it anywhere. Chat apps show your preview card. Anyone who opens the link sees a plain 404 page.

Live: **https://mirage.cupx.in** · A [CupX Corporation](https://cupx.in) project

<!-- Replace docs/preview.png with a real screenshot of a Mirage link in an Instagram DM. -->
![Mirage link preview in an Instagram DM](https://i.ibb.co/p6SjQksW/preview.png)

## Why it exists

Chat apps read a link's `<title>` and Open Graph tags and turn them into a preview card. Mirage makes that card fully customizable without building a website. The page behind the link has no content, scripts or trackers, so a 404 look is the honest design: the preview is all it is for.

Good for testing how previews look, design mockups and demos, short-lived teasers, and learning how Open Graph works. Not for impersonation, scams or adult content.

## How it works

```
mirage.cupx.in  (Vercel: this repo)
      │  POST title + description + Turnstile token
      ▼
Cloudflare Worker  (worker/)
      │  captcha, rate limit, content filter, escape, random slug
      ▼
GitHub API → hqfm/mrg  →  <slug>/index.html
      ▼
mrg.qd.je/<slug>  (GitHub Pages: 200 status, 404-looking page + preview meta tags)
      ▲
Daily GitHub Action in hqfm/mrg deletes slugs older than 3 days
```

The link page returns HTTP 200 on purpose. A real 404 status would make crawlers skip the preview. The root and unknown paths return a true 404.

## Repo layout

| Path | Purpose |
|---|---|
| `index.html`, `style.css`, `app.js` | The form site |
| `404.html` | Branded 404 for unknown pages on mirage.cupx.in |
| `CNAME` | Custom domain for GitHub Pages |
| `worker/index.js`, `worker/wrangler.toml` | Cloudflare Worker API |
| `docs/preview.png` | README screenshot |

Link storage lives in a separate repo: `hqfm/mrg`.

## Setup

1. **Pages:** Settings → Pages → Deploy from branch `main`, folder `/`, custom domain `mirage.cupx.in`, enforce HTTPS. DNS: CNAME `mirage` → `faisalimap.github.io`.
2. **Turnstile:** Create a widget for `mirage.cupx.in`. Put the site key in `CONFIG.SITEKEY` in `app.js`.
3. **Worker:**
   ```bash
   cd worker
   wrangler login
   wrangler secret put GH_TOKEN          # fine-grained PAT, Contents: read/write on hqfm/mrg only
   wrangler secret put TURNSTILE_SECRET
   wrangler deploy
   ```
   Put the Worker URL plus `/create` in `CONFIG.API` in `app.js`.
4. **Links repo:** In `hqfm/mrg`, set Pages source to GitHub Actions and the custom domain to `mrg.qd.je`.

## Security

- All user text is HTML-escaped. Control and bidi characters are stripped.
- Link pages contain no JavaScript and carry a strict CSP meta tag.
- The GitHub token is scoped to one repo and stored as a Worker secret, never in the browser.
- Turnstile, per-IP rate limiting, an Origin check and locked-down CORS protect the API.
- Slugs are 6 to 7 characters from a CSPRNG. Collisions are caught atomically by GitHub (422).
- A content filter rejects links, emails, phone numbers, brand impersonation and scam phrases.
- Pages are `noindex` and expire after 3 days.

## Limits

- Previews are text only (title up to 70 characters, description up to 200).
- Chat apps cache previews, so edits do not show. Create a new link instead.
- Links are deleted 3 to 4 days after creation, because cleanup runs once a day.

## Abuse

Report misuse to **abuse@cupx.in** with the link.

## License

© 2026 CupX Corporation. All rights reserved.
