import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const CHAIN_SLUG = process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? "ethereum" : "sepolia";

function short(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => vars[k] ?? "");
}

async function readTpl(file: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), "museum-template", file), "utf8");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const contract = url.searchParams.get("contract");
  const tokenId = url.searchParams.get("tokenId");
  const subdomain = url.searchParams.get("subdomain") || "preview";

  // If no NFT context, fall back to the static sample preview
  if (!contract || !tokenId) {
    try {
      const html = await readTpl("preview.html");
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    } catch (e: any) {
      return new Response(`Preview unavailable: ${e.message}`, { status: 500 });
    }
  }

  const key = process.env.OPENSEA_API_KEY;
  try {
    let nft: any = { name: `#${tokenId}`, description: "", display_image_url: "", collection: "", token_standard: "ERC721", traits: [], owners: [] };
    if (key) {
      const r = await fetch(
        `https://api.opensea.io/api/v2/chain/${CHAIN_SLUG}/contract/${contract}/nfts/${tokenId}`,
        { headers: { "X-API-KEY": key } }
      );
      if (r.ok) {
        const d = await r.json();
        nft = d.nft || nft;
      }
    }
    const ownerAddr: string | undefined = nft.owners?.[0]?.address;

    const traits = (nft.traits || []).map((t: any) => ({
      trait_type: t.trait_type,
      value: t.value,
      ...(t.trait_count ? { rarity: t.trait_count } : {}),
    }));

    const vars: Record<string, string> = {
      NFT_NAME: nft.name || `#${tokenId}`,
      NFT_DESCRIPTION: (nft.description || "").replace(/</g, "&lt;"),
      NFT_IMAGE_URL: nft.display_image_url || nft.image_url || "",
      COLLECTION_NAME: nft.collection || "",
      TOKEN_ID: String(tokenId),
      BLOCKCHAIN: CHAIN_SLUG === "ethereum" ? "Ethereum" : "Sepolia",
      SUBDOMAIN: `${subdomain}.artid.eth`,
      CONTRACT_ADDRESS: contract,
      CONTRACT_ADDRESS_SHORT: short(contract),
      OWNER_ADDRESS_SHORT: ownerAddr ? short(ownerAddr) : "—",
      TOKEN_STANDARD: nft.token_standard || "ERC721",
      MINT_DATE: new Date().toISOString().slice(0, 10),
      ARTID_MINT_YEAR: String(new Date().getFullYear()),
      IPFS_CID_SHORT: "—",
      TRAITS_JSON: JSON.stringify(traits),
    };

    // Read template, fill placeholders, inline CSS + JS so the iframe is self-contained
    let html = await readTpl("index.html");
    html = fill(html, vars);
    const css = await readTpl("style.css");
    const js  = await readTpl("script.js");

    // Inline assets (replace <link> + <script src>) so the iframe renders without separate routes.
    html = html.replace(/<link[^>]*href=["'][^"']*style\.css["'][^>]*\/?>/i, `<style>${css}</style>`);
    html = html.replace(/<script[^>]*src=["'][^"']*script\.js["'][^>]*><\/script>/i, `<script>${js}</script>`);

    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (e: any) {
    return new Response(`Preview error: ${e.message}`, { status: 500 });
  }
}
