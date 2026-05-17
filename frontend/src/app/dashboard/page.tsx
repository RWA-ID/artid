"use client";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

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
      <div className="max-w-2xl mx-auto px-7 py-32 text-center">
        <p className="text-[11px] tracking-[0.42em] uppercase text-[#c8a35a]/70">— The Gallery —</p>
        <h1 className="font-display italic font-light text-[clamp(48px,6vw,72px)] leading-[1.05] tracking-[-0.02em] text-[#ece4d2] mt-6">
          A wallet, please.
        </h1>
        <p className="mt-6 text-[15px] leading-[1.7] text-[#b8aa8e] max-w-md mx-auto">
          Connect to see every piece you own — every collection, every token — laid out in a single hall.
          Choose one, and we'll mint it its own museum.
        </p>
      </div>
    );
  }

  return (
    <div className="relative bg-[#0a0908] text-[#ece4d2] min-h-screen">
      <section className="max-w-[1200px] mx-auto px-7 pt-20 pb-8">
        <p className="text-[11px] tracking-[0.42em] uppercase text-[#c8a35a]/70">— Your acquisitions —</p>
        <h1 className="font-display font-normal text-[clamp(48px,6vw,80px)] leading-[0.98] tracking-[-0.025em] mt-5">
          <span>The </span><span className="italic font-light text-[#d8b977]">collection</span>
        </h1>
        <div className="mt-6 flex items-center gap-5 text-[10px] tracking-[0.32em] uppercase text-[#6a6151]">
          <span>Ethereum mainnet</span>
          <span className="w-px h-3 bg-[#3a342c]" />
          <span className="font-mono normal-case tracking-normal text-[12px] text-[#8a8068]">
            {address?.slice(0, 6)}…{address?.slice(-4)}
          </span>
          {nfts.length > 0 && <>
            <span className="w-px h-3 bg-[#3a342c]" />
            <span>{nfts.length} {nfts.length === 1 ? "piece" : "pieces"}</span>
          </>}
        </div>
        <div
          className="h-px mt-10"
          style={{ background: "linear-gradient(90deg, transparent, rgba(200,163,90,0.22) 12%, rgba(200,163,90,0.22) 88%, transparent)" }}
        />
      </section>

      <section className="max-w-[1200px] mx-auto px-7 pb-32">
        {loading && (
          <p className="text-[11px] tracking-[0.32em] uppercase text-[#6a6151] italic mt-12">
            Curating from OpenSea…
          </p>
        )}
        {err && (
          <div className="mt-12 border border-red-500/20 bg-red-500/5 p-8">
            <p className="text-[11px] tracking-[0.32em] uppercase text-red-400/80 mb-3">Couldn't load collection</p>
            <p className="text-sm text-[#b8aa8e]">{err}</p>
          </div>
        )}
        {!loading && !err && nfts.length === 0 && (
          <div className="mt-20 text-center">
            <p className="font-display italic text-2xl text-[#8a8068]">An empty wall.</p>
            <p className="mt-4 text-[13px] text-[#6a6151] max-w-md mx-auto">
              This wallet holds no NFTs on Ethereum mainnet. Acquire a piece, then return.
            </p>
          </div>
        )}

        <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-7 gap-y-14">
          {nfts.map((n, i) => (
            <NftCard key={`${n.contract}-${n.identifier}`} nft={n} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

function NftCard({ nft, index }: { nft: Nft; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: Math.min(index * 0.04, 0.6) }}
      className="group"
    >
      <Link
        href={`/create/${nft.contract}/${nft.identifier}`}
        className="block"
      >
        {/* Frame */}
        <div
          className="relative aspect-square overflow-hidden bg-[#16130f] transition duration-500"
          style={{
            boxShadow: "inset 0 0 0 1px rgba(200,163,90,0.18)",
          }}
        >
          {nft.display_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={nft.display_image_url}
              alt={nft.name ?? nft.identifier}
              className="w-full h-full object-cover transition duration-700 group-hover:scale-[1.015]"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] tracking-[0.32em] uppercase text-[#3a342c]">
              no image
            </div>
          )}
          {/* Halo on hover — soft, not translated */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500 pointer-events-none"
               style={{
                 boxShadow: "inset 0 0 0 1px rgba(216,185,119,0.55), 0 0 60px rgba(200,163,90,0.25)",
               }}
          />
          {/* CTA reveal */}
          <div className="absolute inset-x-0 bottom-0 px-4 py-3 flex items-center justify-between opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition duration-500"
               style={{
                 background: "linear-gradient(180deg, transparent 0%, rgba(10,9,8,0.92) 60%)",
               }}
          >
            <span className="text-[10px] tracking-[0.32em] uppercase text-[#c8a35a]">Mint museum</span>
            <svg viewBox="0 0 14 14" width="11" height="11" className="text-[#c8a35a]">
              <path d="M3 7h8M7 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
          </div>
        </div>

        {/* Wall card */}
        <div className="mt-4">
          <div className="font-display text-[20px] leading-tight tracking-[-0.01em] text-[#ece4d2] truncate">
            {nft.name || `#${nft.identifier}`}
          </div>
          <div className="mt-1.5 flex items-center gap-2.5 text-[10px] tracking-[0.32em] uppercase text-[#6a6151] truncate">
            <span className="truncate">{nft.collection || "—"}</span>
            <span className="font-mono normal-case tracking-normal text-[11px] text-[#5a5141]">
              #{nft.identifier}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
