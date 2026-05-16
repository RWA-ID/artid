import { NextRequest, NextResponse } from "next/server";

const CHAIN_SLUG = process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? "ethereum" : "sepolia";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const contract = url.searchParams.get("contract");
  const tokenId = url.searchParams.get("tokenId");
  if (!contract || !tokenId) return NextResponse.json({ error: "missing contract/tokenId" }, { status: 400 });

  const key = process.env.OPENSEA_API_KEY;
  if (!key) return NextResponse.json({ error: "OPENSEA_API_KEY not set" }, { status: 500 });

  try {
    const r = await fetch(
      `https://api.opensea.io/api/v2/chain/${CHAIN_SLUG}/contract/${contract}/nfts/${tokenId}`,
      { headers: { "X-API-KEY": key }, next: { revalidate: 60 } }
    );
    if (!r.ok) return NextResponse.json({ error: `OpenSea ${r.status}` }, { status: 502 });
    const d = await r.json();
    return NextResponse.json({ nft: d.nft });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
