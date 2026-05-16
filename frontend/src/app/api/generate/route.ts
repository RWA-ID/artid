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

export async function POST(req: NextRequest) {
  const { contract, tokenId, subdomain, owner } = await req.json();
  if (!contract || !tokenId || !subdomain) {
    return NextResponse.json({ error: "missing contract/tokenId/subdomain" }, { status: 400 });
  }

  const key = process.env.OPENSEA_API_KEY;
  if (!key) return NextResponse.json({ error: "OPENSEA_API_KEY not set" }, { status: 500 });

  try {
    const r = await fetch(
      `https://api.opensea.io/api/v2/chain/${CHAIN_SLUG}/contract/${contract}/nfts/${tokenId}`,
      { headers: { "X-API-KEY": key } }
    );
    if (!r.ok) return NextResponse.json({ error: `OpenSea ${r.status}` }, { status: 502 });
    const d = await r.json();
    const nft = d.nft;

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
      OWNER_ADDRESS_SHORT: owner ? short(owner) : "",
      TOKEN_STANDARD: nft.token_standard || "ERC721",
      MINT_DATE: new Date().toISOString().slice(0, 10),
      ARTID_MINT_YEAR: String(new Date().getFullYear()),
      IPFS_CID_SHORT: "—",
      TRAITS_JSON: JSON.stringify(traits),
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
