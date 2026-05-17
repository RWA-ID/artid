"use client";
import type { OpenSeaNft } from "@/lib/opensea";

function short(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => vars[k] ?? "");
}
function sanitizeXHandle(raw: string | undefined): string {
  if (!raw) return "";
  const cleaned = raw.trim().replace(/^@+/, "").replace(/^https?:\/\/(x|twitter)\.com\//i, "").replace(/\/$/, "");
  return /^[A-Za-z0-9_]{1,15}$/.test(cleaned) ? cleaned : "";
}
function accessionNumber(year: number, tokenId: string): string {
  const idNum = Number(tokenId);
  const last = isNaN(idNum) ? String(tokenId).slice(-4).padStart(4, "0") : String(idNum % 10000).padStart(4, "0");
  return `ACQ · ${year} · ${last}`;
}

async function getTpl(file: string): Promise<string> {
  const r = await fetch(`/museum-template/${file}`);
  if (!r.ok) throw new Error(`couldn't load ${file}: ${r.status}`);
  return r.text();
}

export async function buildMuseumFiles(opts: {
  nft: OpenSeaNft;
  contract: string;
  tokenId: string;
  subdomain: string;
  owner?: string;
  xHandle?: string;
}): Promise<Record<string, string>> {
  const { nft, contract, tokenId, subdomain, owner, xHandle } = opts;
  const chain = process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? "Ethereum" : "Sepolia";
  const mintYear = new Date().getFullYear();
  const handle = sanitizeXHandle(xHandle);
  const xRow = handle
    ? `<div class="wallcard__row"><span class="wallcard__label">X</span><a class="wallcard__x" href="https://x.com/${handle}" target="_blank" rel="noopener">@${handle}</a></div>`
    : "";

  const traits = (nft.traits || []).map((t: any) => ({
    trait_type: t.trait_type, value: t.value,
    ...(t.trait_count ? { rarity: t.trait_count } : {}),
  }));

  const vars: Record<string, string> = {
    NFT_NAME: nft.name || `#${tokenId}`,
    NFT_DESCRIPTION: (nft.description || "").replace(/</g, "&lt;"),
    NFT_IMAGE_URL: nft.display_image_url || nft.image_url || "",
    COLLECTION_NAME: nft.collection || "",
    TOKEN_ID: String(tokenId),
    BLOCKCHAIN: chain,
    SUBDOMAIN: subdomain,
    CONTRACT_ADDRESS: contract,
    CONTRACT_ADDRESS_SHORT: short(contract),
    OWNER_ADDRESS_SHORT: owner ? short(owner) : "—",
    TOKEN_STANDARD: nft.token_standard || "ERC721",
    MINT_DATE: new Date().toISOString().slice(0, 10),
    ARTID_MINT_YEAR: String(mintYear),
    IPFS_CID_SHORT: "—",
    TRAITS_JSON: JSON.stringify(traits),
    ACCESSION: accessionNumber(mintYear, String(tokenId)),
    HOLDER_X_ROW: xRow,
    HOLDER_X: handle,
  };

  const [idx, css, js] = await Promise.all([
    getTpl("index.html"), getTpl("style.css"), getTpl("script.js"),
  ]);

  return {
    "index.html": fill(idx, vars),
    "style.css": css,
    "script.js": js,
  };
}

export async function buildPreviewHtml(opts: {
  nft: OpenSeaNft;
  contract: string;
  tokenId: string;
  subdomain: string;
  xHandle?: string;
}): Promise<string> {
  const files = await buildMuseumFiles({ ...opts });
  let html = files["index.html"];
  html = html.replace(/<link[^>]*href=["'][^"']*style\.css["'][^>]*\/?>/i, `<style>${files["style.css"]}</style>`);
  html = html.replace(/<script[^>]*src=["'][^"']*script\.js["'][^>]*><\/script>/i, `<script>${files["script.js"]}</script>`);
  return html;
}
