const PROVIDER_CONFIG = {
  groq: {
    keyName: "GROQ_API_KEY",
    endpoint: env => env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions"
  },
  openrouter: {
    keyName: "OPENROUTER_API_KEY",
    endpoint: env => env.OPENROUTER_API_URL || "https://openrouter.ai/api/v1/chat/completions"
  },
  emis: {
    keyName: "EMIS_API_KEY",
    endpoint: env => env.EMIS_API_URL || ""
  },
  nook: {
    keyName: "NOOK_API_KEY",
    endpoint: env => env.NOOK_API_URL || ""
  }
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return ""; // non-browser clients do not need CORS headers
  const requestOrigin = new URL(request.url).origin;
  if (origin === requestOrigin) return origin;
  const allowlist = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  return allowlist.includes(origin) ? origin : null;
}

// Health check: opening /api/chat in a browser should return JSON, not HTTP 405.
export async function onRequestGet({ request, env }) {
  const origin = allowedOrigin(request, env);
  if (origin === null) return json({ error: { message: "This website origin is not allowed. Configure ALLOWED_ORIGINS in Cloudflare." } }, 403);
  return json({ ok: true, service: "AUQ API", methods: ["POST", "OPTIONS"] }, 200, origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {});
}

export async function onRequestOptions({ request, env }) {
  const origin = allowedOrigin(request, env);
  if (origin === null) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin || "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    }
  });
}

export async function onRequestPost({ request, env }) {
  const origin = allowedOrigin(request, env);
  if (origin === null) return json({ error: { message: "This website origin is not allowed. Configure ALLOWED_ORIGINS in Cloudflare." } }, 403);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: { message: "Request body must be valid JSON." } }, 400); }

  const provider = String(body.provider || "").toLowerCase();
  const model = String(body.model || "");
  const messages = body.messages;
  if (!PROVIDER_CONFIG[provider]) return json({ error: { message: "Unsupported provider." } }, 400);
  if (!model || model.length > 200) return json({ error: { message: "A valid model ID is required." } }, 400);
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 100) return json({ error: { message: "Messages must be an array containing 1–100 entries." } }, 400);
  if (JSON.stringify(body).length > 1_000_000) return json({ error: { message: "Request is too large (maximum 1 MB)." } }, 413);

  const config = PROVIDER_CONFIG[provider];
  const key = env[config.keyName];
  const endpoint = config.endpoint(env);
  if (!key) return json({ error: { message: `The ${config.keyName} Cloudflare secret is not configured.` } }, 503);
  if (!endpoint) return json({ error: { message: `The ${provider} endpoint is not configured. Set ${provider.toUpperCase()}_API_URL in Cloudflare Pages variables.` } }, 503);

  const upstreamHeaders = {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json"
  };
  if (provider === "openrouter") {
    upstreamHeaders["HTTP-Referer"] = origin || new URL(request.url).origin;
    upstreamHeaders["X-Title"] = "AUQ AI";
  }

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify({ model, messages, stream: false })
    });
    const payload = await upstream.text();
    return new Response(payload, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...(origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {})
      }
    });
  } catch {
    return json({ error: { message: "Could not connect to the selected AI provider." } }, 502, origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {});
  }
}
