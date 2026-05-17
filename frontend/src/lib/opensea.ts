"use client";

const PROXY = (process.env.NEXT_PUBLIC_OPENSEA_PROXY || "").replace(/\/$/, "");
const CHAIN = process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? "ethereum" : "sepolia";

if (!PROXY && typeof window !== "undefined") {
  console.warn("NEXT_PUBLIC_OPENSEA_PROXY not set — OpenSea calls will fail. Deploy opensea-worker/ and set the URL.");
}

export type OpenSeaNft = {
  contract: string;
  identifier: string;
  name: string | null;
  description: string | null;
  display_image_url: string | null;
  image_url: string | null;
  collection: string | null;
  token_standard?: string;
  owners?: Array<{ address: string; quantity?: number }>;
  traits?: Array<{ trait_type: string; value: string | number; trait_count?: number }>;
};

const TRENDING_COLLECTIONS = [
  "boredapeyachtclub",
  "cryptopunks",
  "pudgypenguins",
  "azuki",
  "moonbirds",
  "doodles-official",
  "artblocks",
  "world-of-women-nft",
];

async function proxyFetch(path: string): Promise<any> {
  if (!PROXY) throw new Error("OpenSea proxy not configured");
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${PROXY}${path}${sep}chain=${CHAIN}`);
  if (!r.ok) throw new Error(`OpenSea proxy ${r.status}`);
  return r.json();
}

function normalize(n: any): OpenSeaNft {
  return {
    contract: n.contract,
    identifier: n.identifier,
    name: n.name ?? null,
    description: n.description ?? null,
    display_image_url: n.display_image_url ?? null,
    image_url: n.image_url ?? null,
    collection: n.collection ?? null,
    token_standard: n.token_standard,
    owners: n.owners,
    traits: n.traits,
  };
}

export async function fetchWalletNfts(address: string, limit = 50): Promise<OpenSeaNft[]> {
  const d = await proxyFetch(`/nfts/${address}?limit=${limit}`);
  return (d.nfts || []).map(normalize);
}

export async function fetchNft(contract: string, tokenId: string): Promise<OpenSeaNft | null> {
  try {
    const d = await proxyFetch(`/nft/${contract}/${tokenId}`);
    return d.nft ? normalize(d.nft) : null;
  } catch (e) {
    console.warn("OpenSea single fetch failed:", e);
    return null;
  }
}

export async function fetchTrendingFrames(): Promise<Array<{ contract: string; identifier: string; name: string; image: string; collection: string }>> {
  const results = await Promise.all(
    TRENDING_COLLECTIONS.map(async (slug) => {
      try {
        const d = await proxyFetch(`/collection/${slug}/nfts?limit=1`);
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
  return results.filter(Boolean) as any;
}
