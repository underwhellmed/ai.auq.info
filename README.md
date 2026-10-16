# AUQ AI — GitHub Pages + Cloudflare Pages

AUQ's browser UI contains **no provider API keys** and performs no Base64 decoding. Requests go to `/api/chat`, implemented by a Cloudflare Pages Function. Provider credentials are read only from server-side environment secrets.

## Supported secrets

Use exactly these names in GitHub repository **Settings → Secrets and variables → Actions** and/or Cloudflare Pages **Settings → Variables and Secrets**:

- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `EMIS_API_KEY`
- `NOOK_API_KEY`

For `emis` and `nook`, also configure the endpoint as a non-secret Cloudflare Pages variable:

- `EMIS_API_URL` — OpenAI-compatible chat completions endpoint
- `NOOK_API_URL` — OpenAI-compatible chat completions endpoint

Groq and OpenRouter endpoint defaults are built into the server function. Optional override variables are `GROQ_API_URL` and `OPENROUTER_API_URL`.

## One-time GitHub setup

1. Put this folder's contents in the root of your GitHub repository and use the `main` branch (or change the workflow branch filter).
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. Add these GitHub Actions secrets:
   - `AUQ_API_BASE_URL` — your Cloudflare Pages origin, e.g. `https://your-project.pages.dev` (no trailing slash). The GitHub Pages build uses it to call Cloudflare's API.
   - `CLOUDFLARE_API_TOKEN` — token with Cloudflare Pages edit/deploy permissions.
   - `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID.
   - `CLOUDFLARE_PAGES_PROJECT` — the Cloudflare Pages project name.
   - Optional provider secrets listed above. When a provider key is present in GitHub Actions secrets, the workflow copies it into the matching Cloudflare Pages secret on deployment. If a GitHub provider secret is empty, the workflow leaves the Cloudflare secret alone.
4. Add the same provider secret names directly in Cloudflare Pages if you prefer to manage them there. Set `ALLOWED_ORIGINS` as a Cloudflare Pages variable to a comma-separated list of exact site origins that should be allowed to call the API, e.g. `https://your-user.github.io,https://your-real-domain.com`. Origins contain scheme + host only, not a path.
5. Push to `main`. GitHub Actions publishes the UI to GitHub Pages and deploys the API function to Cloudflare Pages. Future pushes update both deployments without editing the HTML.

## Cloudflare custom domain

In Cloudflare Pages, attach your real domain under **Custom domains** and follow Cloudflare's DNS prompts. The Cloudflare-hosted copy uses the relative `/api/chat` route, so it needs no HTML changes when you add the custom domain. The GitHub Pages build continues to call the `AUQ_API_BASE_URL` origin.

## Security notes

- Never put provider keys in `index.html`, a JavaScript file, or any public build artifact.
- GitHub Actions secrets are not available to client-side JavaScript. The workflow can copy them to Cloudflare server-side secrets, while Cloudflare Pages secrets are what the running API function reads.
- CORS origin checks are not full authentication; a public API endpoint can still be called by scripts outside a browser. Configure Cloudflare rate limiting or Turnstile before broad public launch to control abuse and costs.
- This function supports OpenAI-compatible chat-completions endpoints. The Whisper model IDs in the UI are audio transcription models, so ordinary text chat with them is not supported by this endpoint.
