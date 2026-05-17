# ArtID OpenSea Worker

A tiny Cloudflare Worker that proxies OpenSea v2 API requests so the API key never ships in browser code. CORS-enabled for any origin (lock down via `ALLOWED_ORIGINS` in `wrangler.toml` after launch).

## Setup

```bash
cd opensea-worker
npm install
npx wrangler login                       # first time only
npx wrangler secret put OPENSEA_API_KEY  # paste your key when prompted
npm run deploy                           # → https://artid-opensea.<your-subdomain>.workers.dev
```

Copy the deployed URL into the dApp's `.env`:

```
NEXT_PUBLIC_OPENSEA_PROXY=https://artid-opensea.<your-subdomain>.workers.dev
```

## Routes

| Method | Path | Returns |
|---|---|---|
| `GET` | `/health` | `{ ok: true, chain }` |
| `GET` | `/nfts/:address?limit=50` | Wallet's NFTs (OpenSea v2 shape) |
| `GET` | `/nft/:contract/:tokenId` | Single NFT |
| `GET` | `/collection/:slug/nfts?limit=1` | NFTs from a named collection |

All routes accept an optional `?chain=ethereum|sepolia` (default: env `CHAIN` or `ethereum`).

Responses include `cache-control: public, max-age=60`.
