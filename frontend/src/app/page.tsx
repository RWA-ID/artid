"use client";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { fetchRecentRegistered } from "@/lib/registry-events";
import { fetchNft } from "@/lib/opensea";

/* ═══════════════════════════════════════════════════════════════
   ArtID Landing — v2

   Aesthetic: museum at twilight. Editorial monumental typography,
   restrained motion, generous whitespace.
   References: Guggenheim Bilbao, Linear, Cosmos.so, Refik Anadol.

   Motion rules followed:
   - Type reveals as if exposed by a slowly-moving light (CSS mask sweep)
   - Frames in the gallery wall DRIFT, not bounce
   - Hover triggers halo + slight scale, NOT translation
   - Manifesto becomes a slow gold-ruled marquee
   - One parallax accent only (the gallery wall column)
   - All animation guarded by useReducedMotion()
   ═══════════════════════════════════════════════════════════════ */

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (isConnected) router.push("/dashboard");
  }, [isConnected, router]);

  return (
    <div className="relative overflow-hidden bg-[#0a0908] text-[#ece4d2]">
      {/* Inline styles for the moving-light reveal — kept here so the file is drop-in */}
      <style jsx global>{`
        @keyframes lightSweep {
          0%   { mask-position: -130% 0; -webkit-mask-position: -130% 0; }
          60%  { mask-position: 110% 0;  -webkit-mask-position: 110% 0; }
          100% { mask-position: 110% 0;  -webkit-mask-position: 110% 0; }
        }
        @keyframes lightSweepBg {
          0%   { background-position: -130% 0; opacity: 0; }
          20%  { opacity: 1; }
          60%  { background-position: 110% 0; opacity: 1; }
          70%  { opacity: 0; }
          100% { background-position: 110% 0; opacity: 0; }
        }
        @keyframes frameDriftA { 0%,100% { transform: translate(0,0); } 50% { transform: translate(0, -10px); } }
        @keyframes frameDriftB { 0%,100% { transform: translate(0,0); } 50% { transform: translate(2px, -7px); } }
        @keyframes frameDriftC { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-2px, -12px); } }
        @keyframes frameDriftD { 0%,100% { transform: translate(0,0); } 50% { transform: translate(1px, -8px); } }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

        /* Initial fade-up; the moving light is provided by the bloom layer below
           so the text itself is never partially masked (Cormorant's thin strokes
           vanish at low opacity). */
        .hero-title {
          opacity: 0;
          transform: translateY(8px);
          animation: heroIn 1.4s cubic-bezier(0.2,0.7,0.2,1) 0.2s forwards;
        }
        @keyframes heroIn {
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-title-bloom::before {
          content: ""; position: absolute; inset: -20px -10% -20px -10%;
          background: linear-gradient(110deg,
            transparent 30%, rgba(255,224,162,0.18) 45%,
            rgba(255,224,162,0.32) 50%, rgba(255,224,162,0.18) 55%, transparent 70%);
          background-size: 240% 100%; background-position: -130% 0;
          filter: blur(20px); mix-blend-mode: screen;
          pointer-events: none; z-index: -1;
          animation: lightSweepBg 4.2s cubic-bezier(0.5,0,0.3,1) 0.2s forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-title { animation: none; opacity: 1; transform: none; }
          .hero-title-bloom::before { display: none; }
        }
      `}</style>

      <Hero reduced={!!reduced} />
      <Manifesto reduced={!!reduced} />
      <Process />
      <Audiences />
      <RecentlyInaugurated />
      <Trending />
      <Footer />
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   HERO
   ════════════════════════════════════════════════════════════════ */

function Hero({ reduced }: { reduced: boolean }) {
  const wallRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: wallRef, offset: ["start end", "end start"] });
  // Lagged parallax — the only parallax on the page
  const y = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [60, -60]);

  return (
    <section className="relative isolate overflow-hidden"
      style={{ background:
        "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(200,163,90,0.10) 0%, transparent 60%), radial-gradient(ellipse at 50% 100%, #16130f 0%, #0a0908 70%)" }}>
      <div className="max-w-[1200px] mx-auto px-7 pt-[120px] pb-[140px] grid lg:grid-cols-[1.05fr_0.95fr] gap-20 items-center">
        <div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2 }}
            className="font-display italic text-[#c8a35a] text-[13px] tracking-[0.42em] uppercase mb-8">
            — A Private Museum for Every Masterpiece —
          </motion.div>

          <div className="hero-title-bloom relative isolate">
            <h1 className="hero-title font-display font-normal text-[clamp(56px,8.6vw,124px)] leading-[0.96] tracking-[-0.025em] text-[#ece4d2]"
              style={{ textWrap: "balance" as any }}>
              Every NFT<br/>
              deserves its own<br/>
              <span className="italic font-light text-[#d8b977]">private museum.</span>
            </h1>
          </div>

          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 0.8 }}
            className="mt-10 max-w-[540px] text-[17px] leading-[1.7] text-[#b8aa8e]">
            ArtID mints an immutable ENS subdomain under{" "}
            <span className="italic text-[#d8b977]">artid.eth</span> for any NFT you own —
            paired with a hand-crafted, IPFS-hosted gallery site. Charcoal walls, gilded frames,
            hushed footsteps. Provenance you can visit.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 1.1 }}
            className="mt-12 flex flex-wrap gap-3.5">
            <Link href="/dashboard"
              className="inline-flex items-center gap-2.5 px-[30px] py-4 text-[11px] tracking-[0.3em] uppercase bg-[#c8a35a] text-[#0a0908] hover:bg-[#d8b977] transition shadow-[0_8px_24px_rgba(200,163,90,0.18)]">
              Enter the Gallery
              <svg viewBox="0 0 14 14" width="11" height="11"><path d="M3 7h8M7 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4"/></svg>
            </Link>
            <Link href="/integrate"
              className="inline-flex items-center gap-2.5 px-[30px] py-4 text-[11px] tracking-[0.3em] uppercase border border-[rgba(200,163,90,0.18)] text-[#c8a35a] hover:border-[#c8a35a] hover:bg-[rgba(200,163,90,0.04)] hover:text-[#d8b977] transition">
              For Artists &amp; Collections
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4, delay: 1.4 }}
            className="mt-16 flex flex-wrap items-center gap-5 text-[10px] tracking-[0.32em] uppercase text-[#6a6151]">
            <span>Ethereum mainnet</span>
            <span className="w-[3px] h-[3px] bg-[#6a6151] rounded-full" />
            <span>ENS · IPFS · No middlemen</span>
            <span className="w-[3px] h-[3px] bg-[#6a6151] rounded-full" />
            <span>Permanent provenance</span>
          </motion.div>
        </div>

        {/* Gallery wall — the one parallax accent on the page */}
        <motion.div ref={wallRef} style={{ y }} className="relative h-[580px] hidden lg:block">
          <GalleryWall />
        </motion.div>
      </div>
    </section>
  );
}


/* ════════════════════════════════════════════════════════════════
   GALLERY WALL — drifting gilded frames, halo + scale on hover
   ════════════════════════════════════════════════════════════════ */

type TrendingNft = { contract: string; identifier: string; name: string; image: string; collection: string };

function GalleryWall() {
  const [nfts, setNfts] = useState<TrendingNft[]>([]);
  useEffect(() => {
    import("@/lib/opensea").then(m => m.fetchTrendingFrames()).then(setNfts).catch(() => {});
  }, []);

  const slots = [
    { className: "fc-1", style: { left: "4%",  top: "6%",  width: 220, height: 290, animation: "frameDriftA 9s ease-in-out 2s infinite" } },
    { className: "fc-2", style: { left: "48%", top: "0",   width: 200, height: 250, animation: "frameDriftB 11s ease-in-out 2.5s infinite" } },
    { className: "fc-3", style: { left: "12%", top: "60%", width: 180, height: 180, animation: "frameDriftC 13s ease-in-out 3s infinite" } },
    { className: "fc-4", style: { left: "56%", top: "50%", width: 220, height: 260, animation: "frameDriftD 10s ease-in-out 3.5s infinite" } },
  ];
  const picks = nfts.slice(0, 4);

  return (
    <div className="absolute inset-0">
      {slots.map((s, i) => {
        const nft = picks[i];
        return (
          <motion.a key={i}
            href={nft ? `/create?c=${nft.contract}&t=${nft.identifier}` : undefined}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: nft ? 1 : 0.28, y: 0, scale: 1 }}
            transition={{ duration: 1.4, delay: 0.5 + i * 0.2, ease: [0.2, 0.7, 0.2, 1] }}
            style={{
              ...s.style, position: "absolute", padding: 7, cursor: "pointer", overflow: "hidden",
              backgroundImage: "linear-gradient(135deg, #c8a35a 0%, #8e6f37 22%, #e0c181 50%, #6e5424 78%, #c8a35a 100%)",
              boxShadow: "0 30px 60px rgba(0,0,0,0.6), 0 8px 16px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,220,150,0.55), inset 0 0 0 4px rgba(0,0,0,0.45)",
            }}
            className="group transition-[transform,filter] duration-700 will-change-transform hover:scale-[1.035] hover:brightness-110"
          >
            <div className="relative w-full h-full overflow-hidden bg-[#0a0908]">
              {nft ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={nft.image} alt={nft.name} className="w-full h-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.04]" />
              ) : (
                <div className="w-full h-full" />
              )}
              {/* Halo behind */}
              <div aria-hidden className="pointer-events-none absolute -inset-5 -z-10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{ background: "radial-gradient(closest-side, rgba(255,224,162,0.35), transparent 70%)" }} />
              {/* Label slides up on hover */}
              {nft && (
                <div className="absolute left-2 right-2 bottom-2 px-3 py-2.5 opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 pointer-events-none"
                  style={{ background: "linear-gradient(to top, rgba(5,5,5,0.96), rgba(5,5,5,0.6) 70%, transparent)" }}>
                  <div className="font-display italic text-[13px] text-[#d8b977] truncate">{nft.name}</div>
                </div>
              )}
            </div>
          </motion.a>
        );
      })}
      {/* Floor halo */}
      <div aria-hidden className="absolute -left-[10%] -right-[10%] -bottom-10 h-20 blur-2xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center top, rgba(200,163,90,0.10), transparent 70%)" }} />
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   MANIFESTO — slow marquee, gold rules above and below
   ════════════════════════════════════════════════════════════════ */

function Manifesto({ reduced }: { reduced: boolean }) {
  const phrases = [
    "An NFT is not a website.",
    "A wallet is not a museum.",
    "A passport without a country is a token, not a record.",
  ];
  const full = [...phrases, ...phrases]; // duplicate for seamless loop

  return (
    <section aria-label="Manifesto" className="relative py-[100px] overflow-hidden isolate"
      style={{ background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 50%, transparent 100%), #100e0c" }}>
      {/* Gold rule top */}
      <div aria-hidden className="absolute top-0 left-0 right-0 h-px opacity-50"
        style={{ background: "linear-gradient(90deg, transparent 5%, #c8a35a 25%, #d8b977 50%, #c8a35a 75%, transparent 95%)" }} />
      {/* Gold rule bottom */}
      <div aria-hidden className="absolute bottom-0 left-0 right-0 h-px opacity-50"
        style={{ background: "linear-gradient(90deg, transparent 5%, #c8a35a 25%, #d8b977 50%, #c8a35a 75%, transparent 95%)" }} />

      <div className="overflow-hidden w-full whitespace-nowrap"
        style={{
          maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
        }}
        onMouseEnter={e => { (e.currentTarget.firstChild as HTMLElement).style.animationPlayState = "paused"; }}
        onMouseLeave={e => { (e.currentTarget.firstChild as HTMLElement).style.animationPlayState = "running"; }}
      >
        <div className="inline-flex items-center gap-[90px] pr-[90px]"
          style={{ animation: reduced ? "none" : "marquee 80s linear infinite" }}>
          {full.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-[90px] flex-shrink-0">
              <span className="font-display italic font-light text-[clamp(48px,6.4vw,88px)] leading-none tracking-[-0.02em] text-[#ece4d2] whitespace-nowrap">
                {p.includes("museum") ? (
                  <>A wallet is not <span className="text-[#d8b977]">a museum</span>.</>
                ) : p}
              </span>
              <span aria-hidden className="w-2 h-2 rounded-full bg-[#c8a35a] opacity-70 flex-shrink-0" />
            </span>
          ))}
        </div>
      </div>
      <div className="text-center mt-14 text-[11px] tracking-[0.42em] uppercase text-[#6a6151]">
        — the case for a real address on chain —
      </div>
    </section>
  );
}


/* ════════════════════════════════════════════════════════════════
   PROCESS — three rooms, one ceremony
   ════════════════════════════════════════════════════════════════ */

function Process() {
  const steps = [
    { n: "I",   t: "Choose the work",   d: "Connect your wallet. We pull every NFT you own from OpenSea — Ethereum mainnet, all collections. Pick the piece that deserves its own room." },
    { n: "II",  t: "Mint the passport", d: "We auto-name your subdomain from the collection slug, build the museum HTML, pin it to IPFS, and point the ENS record at it — all in one transaction." },
    { n: "III", t: "Keep it forever",   d: "Your subname is a wrapped ENS NFT in your wallet — fully transferable, with PARENT_CANNOT_CONTROL burned. The gallery is yours, not ours." },
  ];

  return (
    <section id="process" className="max-w-[1200px] mx-auto px-7 py-[140px]">
      <div className="text-center mb-20">
        <div className="inline-block text-[11px] tracking-[0.46em] uppercase text-[#c8a35a] mb-6">— Three rooms, one ceremony —</div>
        <h2 className="font-display italic font-normal text-[clamp(40px,5.8vw,72px)] leading-[1.05] tracking-[-0.015em]"
          style={{ textWrap: "balance" as any }}>
          How a passport is made.
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-8 relative">
        {/* connecting line */}
        <div aria-hidden className="hidden md:block absolute top-9 left-[12%] right-[12%] h-px pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, rgba(200,163,90,0.18) 20%, rgba(200,163,90,0.18) 80%, transparent)" }} />
        {steps.map((s, i) => (
          <motion.div key={s.n}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1, delay: i * 0.16, ease: [0.2, 0.7, 0.2, 1] }}
            className="relative px-7 py-8 pb-10 text-center"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.012), transparent)" }}
          >
            <div className="font-display italic font-light text-[80px] leading-none text-[#c8a35a] tracking-[-0.02em] mb-8 inline-block px-6 relative z-10"
              style={{ background: "#0a0908", textShadow: "0 0 30px rgba(200,163,90,0.22)" }}>
              {s.n}
            </div>
            <h3 className="font-display italic font-normal text-[28px] text-[#ece4d2] mb-4 tracking-[-0.01em]">{s.t}</h3>
            <p className="text-[14.5px] leading-[1.75] text-[#b8aa8e] max-w-[320px] mx-auto" style={{ textWrap: "pretty" as any }}>
              {s.d}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}


/* ════════════════════════════════════════════════════════════════
   AUDIENCES
   ════════════════════════════════════════════════════════════════ */

function Audiences() {
  const items = [
    {
      eyebrow: "— For Collectors —",
      title: "Honor what you own.",
      body: "Most NFTs live in dashboards built for traders. ArtID gives the work a real address, a real room, and a real record — visitable from any browser, indexed by ENS, hosted by IPFS, owned by you.",
      cta: "Open your gallery", href: "/dashboard",
    },
    {
      eyebrow: "— For Artists & Collections —",
      title: "Earn on every passport.",
      body: "Register your collection's payout terms on-chain in a single tx. The forwarder routes a share of every mint to your treasury — automatically, with no platform signer to trust. Update or revoke at any time.",
      cta: "Onboard your collection", href: "/integrate",
    },
  ];

  return (
    <section id="audiences" className="max-w-[1200px] mx-auto px-7 pt-14 pb-[120px] grid md:grid-cols-2 gap-px border"
      style={{ background: "rgba(200,163,90,0.18)", borderColor: "rgba(200,163,90,0.18)" }}>
      {items.map((it, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.9, delay: i * 0.1 }}
          className="relative px-14 py-16 bg-[#0a0908] hover:bg-[#100e0c] transition-colors duration-500"
        >
          <span className="block text-[10px] tracking-[0.4em] uppercase text-[#c8a35a] mb-7">{it.eyebrow}</span>
          <h3 className="font-display italic font-normal text-[44px] leading-[1.05] text-[#ece4d2] mb-6 tracking-[-0.015em]"
            style={{ textWrap: "balance" as any }}>
            {it.title}
          </h3>
          <p className="text-[15px] leading-[1.8] text-[#b8aa8e] mb-9 max-w-[460px]">{it.body}</p>
          <Link href={it.href}
            className="group inline-flex items-center gap-2.5 text-[#c8a35a] text-[11px] tracking-[0.32em] uppercase border-b border-[rgba(200,163,90,0.18)] pb-2.5 hover:text-[#d8b977] hover:border-[#c8a35a] transition-colors">
            {it.cta}
            <svg viewBox="0 0 14 14" width="11" height="11" className="transition-transform group-hover:translate-x-1">
              <path d="M3 7h8M7 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
          </Link>
        </motion.div>
      ))}
    </section>
  );
}


/* ════════════════════════════════════════════════════════════════
   RECENTLY INAUGURATED — real on-chain mints, image from OpenSea
   ════════════════════════════════════════════════════════════════ */

type Inaugural = {
  label: string;
  nftContract: string;
  tokenId: string;
  image: string | null;
  name: string | null;
};

function RecentlyInaugurated() {
  const [items, setItems] = useState<Inaugural[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const events = await fetchRecentRegistered(8);
        const enriched = await Promise.all(
          events.map(async (e) => {
            const nft = await fetchNft(e.nftContract, e.tokenId.toString()).catch(() => null);
            return {
              label: e.label,
              nftContract: e.nftContract,
              tokenId: e.tokenId.toString(),
              image: nft?.display_image_url || nft?.image_url || null,
              name: nft?.name ?? null,
            };
          })
        );
        if (!cancelled) {
          setItems(enriched);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loaded && items.length === 0) return null;

  const tiles: (Inaugural | null)[] = items.length
    ? items
    : Array.from({ length: 4 }, () => null);

  return (
    <section id="inaugurated" className="py-[100px] px-7 border-t"
      style={{ background: "#0a0908", borderColor: "rgba(200,163,90,0.10)" }}>
      <div className="max-w-[1280px] mx-auto">
        <div className="text-center mb-16">
          <div className="inline-block text-[11px] tracking-[0.46em] uppercase text-[#c8a35a] mb-6">— Recently Inaugurated —</div>
          <h2 className="font-display italic font-normal text-[clamp(40px,5.8vw,72px)] leading-[1.05] tracking-[-0.015em]"
            style={{ textWrap: "balance" as any }}>
            Now on the wall.
          </h2>
          <p className="mt-5 text-[13px] tracking-[0.04em] text-[#8a8068] italic">
            Live museums minted under artid.eth.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[18px]">
          {tiles.map((m, i) => (
            <InauguralTile key={m ? m.label : `skel-${i}`} item={m} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function InauguralTile({ item, index }: { item: Inaugural | null; index: number }) {
  if (!item) {
    return (
      <div className="relative overflow-hidden bg-[#100e0c] border border-[rgba(200,163,90,0.10)]"
        style={{ aspectRatio: "4 / 5" }}>
        <div className="absolute inset-0 flex items-center justify-center font-display italic text-[#5a5141] text-sm">
          curating…
        </div>
      </div>
    );
  }
  const href = `https://${item.label}.artid.eth.link`;
  return (
    <motion.a href={href} target="_blank" rel="noreferrer"
      initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ duration: 0.7, delay: index * 0.04, ease: [0.2, 0.7, 0.2, 1] }}
      className="group relative overflow-hidden cursor-pointer block bg-[#100e0c] border border-[rgba(200,163,90,0.18)]"
      style={{ aspectRatio: "4 / 5" }}
    >
      {item.image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={item.image} alt={item.name ?? item.label}
          className="w-full h-full object-cover transition-[transform,filter] duration-[900ms] group-hover:scale-[1.05]"
          style={{ filter: "saturate(0.9) contrast(1.02)" }} />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[#5a5141] font-display italic">no image</div>
      )}
      <div className="absolute inset-0 opacity-100 transition-opacity duration-500"
        style={{ background: "linear-gradient(180deg, transparent 55%, rgba(5,5,5,0.92) 100%)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 transition-shadow duration-500 group-hover:shadow-[inset_0_0_0_1px_rgba(200,163,90,0.5),0_0_60px_rgba(200,163,90,0.22)]" />
      <div className="absolute left-[18px] right-[18px] bottom-[16px]">
        <div className="font-display italic text-[16px] text-[#ece4d2] tracking-[-0.005em] truncate">
          {item.label}<span className="text-[#a89e85]">.artid.eth</span>
        </div>
        {item.name && (
          <div className="text-[10px] tracking-[0.28em] uppercase text-[#c8a35a] truncate mt-1">{item.name}</div>
        )}
      </div>
    </motion.a>
  );
}


/* ════════════════════════════════════════════════════════════════
   TRENDING — Cosmos.so-style gallery wall
   ════════════════════════════════════════════════════════════════ */

function Trending() {
  const [nfts, setNfts] = useState<TrendingNft[]>([]);
  useEffect(() => {
    import("@/lib/opensea").then(m => m.fetchTrendingFrames()).then(setNfts).catch(() => {});
  }, []);

  const tiles = nfts.length ? nfts.slice(0, 8) : Array.from({ length: 8 }, () => null);

  return (
    <section id="trending" className="py-[100px] px-7 pb-[140px] border-t"
      style={{ background: "linear-gradient(180deg, #0a0908 0%, #100e0c 100%)", borderColor: "rgba(200,163,90,0.10)" }}>
      <div className="max-w-[1280px] mx-auto">
        <div className="text-center mb-20">
          <div className="inline-block text-[11px] tracking-[0.46em] uppercase text-[#c8a35a] mb-6">— Awaiting Acquisition —</div>
          <h2 className="font-display italic font-normal text-[clamp(40px,5.8vw,72px)] leading-[1.05] tracking-[-0.015em]"
            style={{ textWrap: "balance" as any }}>
            Blue-chip pieces, ready for the wall.
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[18px]">
          {tiles.map((nft, i) => (
            <Tile key={i} nft={nft} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Tile({ nft, index }: { nft: TrendingNft | null; index: number }) {
  if (!nft) {
    return (
      <div className="relative overflow-hidden bg-[#100e0c] border border-[rgba(200,163,90,0.10)]"
        style={{ aspectRatio: "4 / 5" }}>
        <div className="absolute inset-0 flex items-center justify-center font-display italic text-[#6a6151] text-sm">
          awaiting acquisition
        </div>
      </div>
    );
  }
  return (
    <motion.a href={`/create?c=${nft.contract}&t=${nft.identifier}`}
      initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ duration: 0.7, delay: index * 0.04, ease: [0.2, 0.7, 0.2, 1] }}
      className="group relative overflow-hidden cursor-pointer block"
      style={{ aspectRatio: "4 / 5" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={nft.image} alt={nft.name}
        className="w-full h-full object-cover transition-[transform,filter] duration-[900ms] group-hover:scale-[1.05]"
        style={{ filter: "saturate(0.85) contrast(1.02)" }} />
      {/* overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: "linear-gradient(180deg, transparent 50%, rgba(5,5,5,0.92) 100%)" }} />
      {/* halo + inner ring on hover */}
      <div aria-hidden className="pointer-events-none absolute inset-0 transition-shadow duration-500 group-hover:shadow-[inset_0_0_0_1px_rgba(200,163,90,0.5),0_0_60px_rgba(200,163,90,0.22)]" />
      {/* meta */}
      <div className="absolute left-[18px] right-[18px] bottom-[18px] opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
        <div className="font-display italic text-[18px] text-[#ece4d2] mb-1 tracking-[-0.005em] truncate">{nft.name}</div>
        <div className="text-[10px] tracking-[0.28em] uppercase text-[#c8a35a] truncate">{nft.collection}</div>
      </div>
    </motion.a>
  );
}


/* ════════════════════════════════════════════════════════════════
   FOOTER
   ════════════════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="border-t px-7 py-14 pb-10" style={{ background: "#050505", borderColor: "rgba(200,163,90,0.18)" }}>
      <div className="max-w-[1200px] mx-auto flex flex-wrap justify-between items-end gap-6">
        <div>
          <div className="font-display text-2xl tracking-[0.4em] text-[#c8a35a]">ArtID</div>
          <div className="mt-2 text-[11px] tracking-[0.32em] uppercase text-[#6a6151]">
            artid.eth · ethereum mainnet · 2026
          </div>
        </div>
        <div className="text-[11px] tracking-[0.32em] uppercase text-[#6a6151]">
          ENS · IPFS · No middlemen
        </div>
      </div>
    </footer>
  );
}
