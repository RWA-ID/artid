/**
 * ArtID OpenSea proxy
 * ────────────────────────────────────────────────────────────
 * Proxies OpenSea v2 API requests, holding the API key as a
 * Cloudflare secret. CORS-enabled so the IPFS-hosted dApp can
 * call it from any origin.
 *
 * Secret to set:
 *   wrangler secret put OPENSEA_API_KEY
 *
 * Routes:
 *   GET /nfts/:address                  → wallet NFTs
 *   GET /nft/:contract/:tokenId         → single NFT
 *   GET /collection/:slug/nfts          → first NFT of a collection
 *   GET /health
 */
export interface Env {
  OPENSEA_API_KEY: string;
  ALLOWED_ORIGINS?: string;   // comma-separated; "*" by default
  CHAIN?: string;             // "ethereum" (default) or "sepolia"
}

const CACHE_TTL = 60; // seconds

function corsHeaders(req: Request, env: Env): HeadersInit {
  const origin = req.headers.get("Origin") || "*";
  const allow = env.ALLOWED_ORIGINS;
  const allowed = !allow || allow === "*" || allow.split(",").map(s => s.trim()).includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body: unknown, init: ResponseInit & { req: Request; env: Env }) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      "cache-control": `public, max-age=${CACHE_TTL}`,
      ...corsHeaders(init.req, init.env),
      ...(init.headers || {}),
    },
  });
}

async function osFetch(path: string, env: Env): Promise<{ status: number; body: any }> {
  const url = `https://api.opensea.io/api/v2/${path}`;
  const r = await fetch(url, { headers: { "X-API-KEY": env.OPENSEA_API_KEY, "Accept": "application/json" } });
  let body: any = null;
  try { body = await r.json(); } catch { body = { error: "non-JSON response" }; }
  return { status: r.status, body };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req, env) });
    }
    if (req.method !== "GET") {
      return json({ error: "method not allowed" }, { req, env, status: 405 });
    }

    const url = new URL(req.url);
    const chain = (url.searchParams.get("chain") || env.CHAIN || "ethereum").toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);

    // GET /health
    if (parts[0] === "health" || parts.length === 0) {
      return json({ ok: true, chain }, { req, env });
    }

    // GET /nfts/:address           — wallet NFTs
    if (parts[0] === "nfts" && parts.length === 2) {
      const address = parts[1];
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return json({ error: "invalid address" }, { req, env, status: 400 });
      }
      const limit = url.searchParams.get("limit") || "50";
      const next = url.searchParams.get("next");
      const qs = new URLSearchParams({ limit });
      if (next) qs.set("next", next);
      const { status, body } = await osFetch(`chain/${chain}/account/${address}/nfts?${qs}`, env);
      return json(body, { req, env, status });
    }

    // GET /nft/:contract/:tokenId  — single NFT
    if (parts[0] === "nft" && parts.length === 3) {
      const [, contract, tokenId] = parts;
      if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) {
        return json({ error: "invalid contract" }, { req, env, status: 400 });
      }
      const { status, body } = await osFetch(`chain/${chain}/contract/${contract}/nfts/${tokenId}`, env);
      return json(body, { req, env, status });
    }

    // GET /collection/:slug/nfts   — first NFT of a collection (for trending wall)
    if (parts[0] === "collection" && parts.length === 3 && parts[2] === "nfts") {
      const slug = parts[1];
      const limit = url.searchParams.get("limit") || "1";
      const { status, body } = await osFetch(`collection/${slug}/nfts?limit=${limit}`, env);
      return json(body, { req, env, status });
    }

    return json({ error: "not found" }, { req, env, status: 404 });
  },
};
