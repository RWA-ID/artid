"use client";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import Link from "next/link";

type Nft = {
  contract: string;
  identifier: string;
  name: string | null;
  display_image_url: string | null;
  collection: string | null;
};

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [nfts, setNfts] = useState<Nft[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setErr(null);
    fetch(`/api/nfts/${address}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setNfts(d.nfts || []);
      })
      .catch((e) => setErr(String(e.message || e)))
      .finally(() => setLoading(false));
  }, [address]);

  if (!isConnected) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-5xl gilded-text">Connect your wallet</h1>
        <p className="mt-4 text-[#a89e85]">Use the button in the top right to sign in.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="font-display text-5xl gilded-text">Your collection</h1>
      <p className="text-[#a89e85] mt-2">Choose any NFT to mint its museum site.</p>

      {loading && <p className="mt-8 text-[#a89e85]">Loading from OpenSea…</p>}
      {err && <p className="mt-8 text-red-400">Error: {err}</p>}

      <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {nfts.map((n) => (
          <Link
            key={`${n.contract}-${n.identifier}`}
            href={`/create/${n.contract}/${n.identifier}`}
            className="gilded-frame p-3 hover:shadow-gilded-lg transition block"
          >
            {n.display_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={n.display_image_url} alt={n.name ?? n.identifier} className="w-full aspect-square object-cover" />
            ) : (
              <div className="w-full aspect-square bg-charcoal-800 flex items-center justify-center text-[#5a5141]">no image</div>
            )}
            <div className="mt-3">
              <div className="font-display text-lg truncate">{n.name || `#${n.identifier}`}</div>
              <div className="text-xs text-[#8a8068] truncate">{n.collection}</div>
            </div>
          </Link>
        ))}
      </div>

      {!loading && nfts.length === 0 && !err && (
        <p className="mt-12 text-[#a89e85]">No NFTs found for this wallet on the active chain.</p>
      )}
    </div>
  );
}
