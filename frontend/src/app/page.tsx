"use client";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) router.push("/dashboard");
  }, [isConnected, router]);

  return (
    <div className="relative overflow-hidden bg-[#0a0908]">
      {/* Ambient gallery wall lighting */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[120%] h-[60vh] bg-[radial-gradient(ellipse_at_top,rgba(212,168,67,0.18),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gilded-500/30 to-transparent" />
      </div>

      {/* HERO ───────────────────────────────────────────────── */}
      <section className="relative max-w-7xl mx-auto px-6 pt-28 pb-32 grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="font-display italic text-gilded-300 text-sm tracking-[0.3em] uppercase"
          >
            A Private Museum for Every Masterpiece
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.1 }}
            className="font-display text-6xl md:text-8xl mt-6 gilded-text leading-[0.95] tracking-tight"
          >
            Where the<br/>
            <span className="italic font-light">collected</span><br/>
            become <span className="italic font-light">collectible.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="mt-10 max-w-xl text-lg text-[#c8bda4] leading-relaxed"
          >
            ArtID mints an immutable ENS subdomain under{" "}
            <span className="text-gilded-300">artid.eth</span> for any NFT you own —
            paired with a hand-crafted, IPFS-hosted gallery site. Charcoal walls,
            gilded frames, hushed footsteps. Provenance you can visit.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-12 flex flex-wrap gap-4"
          >
            <Link
              href="/dashboard"
              className="px-9 py-4 bg-gilded-500 text-charcoal-950 font-medium tracking-wide hover:bg-gilded-400 transition shadow-gilded"
            >
              Enter the Gallery
            </Link>
            <Link
              href="/integrate"
              className="px-9 py-4 border border-gilded-500/40 text-gilded-300 hover:border-gilded-300 hover:bg-gilded-500/5 transition tracking-wide"
            >
              For Artists & Collections
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1 }}
            className="mt-14 flex items-center gap-8 text-xs text-[#5a5141] uppercase tracking-[0.25em]"
          >
            <span>Ethereum mainnet</span>
            <span className="w-px h-3 bg-[#5a5141]" />
            <span>ENS · IPFS · No middlemen</span>
            <span className="w-px h-3 bg-[#5a5141]" />
            <span>Permanent provenance</span>
          </motion.div>
        </div>

        {/* Floating frames ─────────────────────────────────── */}
        <div className="relative h-[520px] hidden lg:block">
          <GalleryWall />
        </div>
      </section>

      {/* MANIFESTO ─────────────────────────────────────────── */}
      <section className="relative border-y border-charcoal-800 bg-charcoal-900/40 py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="font-display text-3xl md:text-4xl italic text-[#d6cab1] leading-tight">
            “An NFT is not a website. A wallet is not a museum.
            A passport without a country is a token, not a record.”
          </p>
          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-gilded-300/70">
            — the case for a real address on chain
          </p>
        </div>
      </section>

      {/* PROCESS ───────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-28">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-gilded-300/70">
          Three rooms, one ceremony
        </p>
        <h2 className="font-display text-center text-5xl mt-4 gilded-text">
          How a passport is made
        </h2>

        <div className="mt-16 grid md:grid-cols-3 gap-10">
          {[
            {
              n: "I",
              t: "Choose the work",
              d: "Connect your wallet. We pull every NFT you own from OpenSea — Ethereum mainnet, all collections. Pick the piece that deserves its own room.",
            },
            {
              n: "II",
              t: "Mint the passport",
              d: "We auto-name your subdomain from the collection slug, build the museum HTML, pin it to IPFS, and point the ENS record at it — all in one transaction.",
            },
            {
              n: "III",
              t: "Keep it forever",
              d: "Your subname is a wrapped ENS NFT in your wallet — fully transferable, with PARENT_CANNOT_CONTROL burned. The gallery is yours, not ours.",
            },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="gilded-frame p-8 relative"
            >
              <div className="absolute -top-6 left-8 px-3 bg-[#0a0908] font-display text-3xl italic text-gilded-300">
                {s.n}
              </div>
              <h3 className="font-display text-2xl mt-2">{s.t}</h3>
              <p className="text-[15px] text-[#a89e85] mt-4 leading-relaxed">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* TWO AUDIENCES ────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="border border-charcoal-800 p-10 bg-charcoal-900/50"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-gilded-300/70">For collectors</p>
          <h3 className="font-display text-4xl mt-3 leading-tight">Honor what you own.</h3>
          <p className="mt-5 text-[#a89e85] leading-relaxed">
            Most NFTs live in dashboards built for traders. ArtID gives the work
            a real address, a real room, and a real record — visitable from any
            browser, indexed by ENS, hosted by IPFS, owned by you.
          </p>
          <Link href="/dashboard" className="mt-7 inline-block text-gilded-300 hover:text-gilded-400 text-sm tracking-wider">
            Open your gallery →
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="border border-charcoal-800 p-10 bg-charcoal-900/50"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-gilded-300/70">For artists & collections</p>
          <h3 className="font-display text-4xl mt-3 leading-tight">Earn on every passport.</h3>
          <p className="mt-5 text-[#a89e85] leading-relaxed">
            Register your collection's payout terms on-chain in a single tx. The
            forwarder routes a share of every mint to your treasury — automatically,
            with no platform signer to trust. Update or revoke at any time.
          </p>
          <Link href="/integrate" className="mt-7 inline-block text-gilded-300 hover:text-gilded-400 text-sm tracking-wider">
            Onboard your collection →
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-charcoal-800 py-10 mt-10">
        <div className="max-w-6xl mx-auto px-6 text-center text-xs text-[#5a5141] uppercase tracking-[0.3em]">
          artid.eth · ethereum mainnet · 2026
        </div>
      </footer>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Decorative gallery wall — floating gilded frames          */
/* ────────────────────────────────────────────────────────── */
type TrendingNft = { contract: string; identifier: string; name: string; image: string; collection: string };

function GalleryWall() {
  const [nfts, setNfts] = useState<TrendingNft[]>([]);
  useEffect(() => {
    fetch("/api/trending").then(r => r.json()).then(d => setNfts(d.nfts || [])).catch(() => {});
  }, []);

  // Layout positions for up to 4 simultaneously visible frames
  const layouts = [
    { x: 0,   y: 30,  w: 200, h: 280 },
    { x: 230, y: 0,   w: 180, h: 230 },
    { x: 50,  y: 340, w: 160, h: 160 },
    { x: 240, y: 260, w: 200, h: 240 },
  ];
  const picks = nfts.slice(0, 4);

  return (
    <div className="absolute inset-0">
      {layouts.map((f, i) => {
        const nft = picks[i];
        return (
          <motion.a
            key={i}
            href={nft ? `/create/${nft.contract}/${nft.identifier}` : undefined}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: nft ? 1 : 0.25, y: [f.y, f.y - 8, f.y] }}
            transition={{
              opacity: { duration: 1.2, delay: 0.2 + i * 0.2 },
              y: { duration: 6 + i, delay: 0.2 + i * 0.2, repeat: Infinity, ease: "easeInOut" },
            }}
            style={{ left: f.x, width: f.w, height: f.h }}
            className="absolute gilded-frame bg-charcoal-800 shadow-gilded-lg overflow-hidden group cursor-pointer"
          >
            {nft ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 ring-1 ring-inset ring-gilded-300/30" />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-charcoal-950/95 via-charcoal-950/60 to-transparent opacity-0 group-hover:opacity-100 transition">
                  <div className="font-display text-gilded-300 text-sm truncate">{nft.name}</div>
                </div>
              </>
            ) : (
              <div className="w-full h-full bg-charcoal-900" />
            )}
          </motion.a>
        );
      })}
      {/* Floor reflection */}
      <div className="absolute -bottom-10 inset-x-0 h-24 bg-gradient-to-b from-gilded-500/5 to-transparent blur-2xl" />
    </div>
  );
}
