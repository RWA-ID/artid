import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const CHAIN_SLUG = process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? "ethereum" : "sepolia";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function readTemplate(file: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), "museum-template", file), "utf8");
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => vars[k] ?? "");
}

function sanitizeXHandle(raw: string | undefined): string {
  if (!raw) return "";
  const cleaned = raw.trim().replace(/^@+/, "").replace(/^https?:\/\/(x|twitter)\.com\//i, "").replace(/\/$/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(cleaned)) return "";
  return cleaned;
}

function accessionNumber(mintYear: number, tokenId: string): string {
  const idNum = Number(tokenId);
  const last = isNaN(idNum) ? String(tokenId).slice(-4).padStart(4, "0") : String(idNum % 10000).padStart(4, "0");
  return `ACQ · ${mintYear} · ${last}`;
}

export async function POST(req: NextRequest) {
  const { contract, tokenId, subdomain, owner, xHandle, nft: clientNft } = await req.json();
  if (!contract || !tokenId || !subdomain) {
    return NextResponse.json({ error: "missing contract/tokenId/subdomain" }, { status: 400 });
  }

  try {
    let nft = clientNft;
    // Only hit OpenSea if the client didn't already pass the NFT data.
    if (!nft) {
      const key = process.env.OPENSEA_API_KEY;
      if (!key) return NextResponse.json({ error: "OPENSEA_API_KEY not set" }, { status: 500 });
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 15000);
      try {
        const r = await fetch(
          `https://api.opensea.io/api/v2/chain/${CHAIN_SLUG}/contract/${contract}/nfts/${tokenId}`,
          { headers: { "X-API-KEY": key }, signal: ctrl.signal }
        );
        clearTimeout(timeout);
        if (!r.ok) return NextResponse.json({ error: `OpenSea ${r.status}` }, { status: 502 });
        const d = await r.json();
        nft = d.nft;
      } catch (e: any) {
        clearTimeout(timeout);
        return NextResponse.json({ error: e.name === "AbortError" ? "OpenSea timed out (>15s)" : e.message }, { status: 504 });
      }
    }

    const traits = (nft.traits || []).map((t: any) => ({
      trait_type: t.trait_type,
      value: t.value,
      ...(t.trait_count ? { rarity: t.trait_count } : {}),
    }));

    const mintYear = new Date().getFullYear();
    const handle = sanitizeXHandle(xHandle);
    const xRow = handle
      ? `<div class="wallcard__row"><span class="wallcard__label">X</span><a class="wallcard__x" href="https://x.com/${handle}" target="_blank" rel="noopener">@${handle}</a></div>`
      : "";

    const vars: Record<string, string> = {
      NFT_NAME: nft.name || `#${tokenId}`,
      NFT_DESCRIPTION: (nft.description || "").replace(/</g, "&lt;"),
      NFT_IMAGE_URL: nft.display_image_url || nft.image_url || "",
      COLLECTION_NAME: nft.collection || "",
      TOKEN_ID: String(tokenId),
      BLOCKCHAIN: CHAIN_SLUG === "ethereum" ? "Ethereum" : "Sepolia",
      SUBDOMAIN: subdomain,
      CONTRACT_ADDRESS: contract,
      CONTRACT_ADDRESS_SHORT: short(contract),
      OWNER_ADDRESS_SHORT: owner ? short(owner) : "",
      TOKEN_STANDARD: nft.token_standard || "ERC721",
      MINT_DATE: new Date().toISOString().slice(0, 10),
      ARTID_MINT_YEAR: String(mintYear),
      IPFS_CID_SHORT: "—",
      TRAITS_JSON: JSON.stringify(traits),
      ACCESSION: accessionNumber(mintYear, String(tokenId)),
      HOLDER_X_ROW: xRow,
      HOLDER_X: handle,
    };

    const indexHtml = fill(await readTemplate("index.html"), vars);
    const styleCss = await readTemplate("style.css");
    const scriptJs = await readTemplate("script.js");

    return NextResponse.json({
      files: {
        "index.html": indexHtml,
        "style.css": styleCss,
        "script.js": scriptJs,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
