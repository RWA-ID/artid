import { NextResponse } from "next/server";

const CHAIN_SLUG = process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? "ethereum" : "sepolia";

// Hand-picked blue-chip / high-art collection slugs for the landing page wall.
// Trending endpoints exist on OpenSea v2 but require special auth tiers; this is reliable.
const COLLECTIONS = [
  "boredapeyachtclub",
  "cryptopunks",
  "pudgypenguins",
  "azuki",
  "moonbirds",
  "doodles-official",
  "artblocks",
  "world-of-women-nft",
];

export async function GET() {
  const key = process.env.OPENSEA_API_KEY;
  if (!key) return NextResponse.json({ nfts: [] });
  try {
    // Pull one representative NFT from each collection
    const results = await Promise.all(
      COLLECTIONS.map(async (slug) => {
        try {
          const r = await fetch(
            `https://api.opensea.io/api/v2/collection/${slug}/nfts?limit=1`,
            { headers: { "X-API-KEY": key }, next: { revalidate: 3600 } }
          );
          if (!r.ok) return null;
          const d = await r.json();
          const n = d.nfts?.[0];
          if (!n || !(n.display_image_url || n.image_url)) return null;
          return {
            contract: n.contract,
            identifier: n.identifier,
            name: n.name || `${slug} #${n.identifier}`,
            image: n.display_image_url || n.image_url,
            collection: slug,
          };
        } catch { return null; }
      })
    );
    return NextResponse.json({ nfts: results.filter(Boolean) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, nfts: [] }, { status: 500 });
  }
}
