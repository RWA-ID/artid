import { NextRequest, NextResponse } from "next/server";

const CHAIN_SLUG = process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? "ethereum" : "sepolia";

export async function GET(_req: NextRequest, { params }: { params: { address: string } }) {
  const key = process.env.OPENSEA_API_KEY;
  if (!key) return NextResponse.json({ error: "OPENSEA_API_KEY not set" }, { status: 500 });
  try {
    const r = await fetch(
      `https://api.opensea.io/api/v2/chain/${CHAIN_SLUG}/account/${params.address}/nfts?limit=50`,
      { headers: { "X-API-KEY": key }, next: { revalidate: 30 } }
    );
    if (!r.ok) return NextResponse.json({ error: `OpenSea ${r.status}` }, { status: 502 });
    const d = await r.json();
    const nfts = (d.nfts || []).map((n: any) => ({
      contract: n.contract,
      identifier: n.identifier,
      name: n.name,
      display_image_url: n.display_image_url,
      collection: n.collection,
    }));
    return NextResponse.json({ nfts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
