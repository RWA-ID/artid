"use client";
import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, isAddress, getAddress } from "viem";
import Link from "next/link";
import { generateSlug } from "@/lib/slug";
import { FORWARDER_ADDRESS, FORWARDER_ABI, REGISTRAR_ADDRESS, REGISTRAR_ABI } from "@/lib/contracts";

type Nft = {
  contract: string;
  identifier: string;
  name?: string | null;
  description?: string | null;
  display_image_url?: string | null;
  image_url?: string | null;
  collection?: string | null;
};

const YEARS_OPTIONS = [1, 2, 5, 10] as const;

export default function CreatePage({ params }: { params: { contract: string; tokenId: string } }) {
  const { contract: rawContract, tokenId } = params;
  const contract = isAddress(rawContract) ? getAddress(rawContract) : rawContract;
  const { address, isConnected } = useAccount();

  const [nft, setNft] = useState<Nft | null>(null);
  const [nftErr, setNftErr] = useState<string | null>(null);
  const [slug, setSlug] = useState<string>("");
  const [years, setYears] = useState<number>(1);
  const [deploying, setDeploying] = useState(false);
  const [step, setStep] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [cid, setCid] = useState<string>("");

  // Fetch NFT
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/nfts/single?contract=${contract}&tokenId=${tokenId}`);
        const d = await r.json();
        if (cancelled) return;
        if (d.error) throw new Error(d.error);
        if (!d.nft) throw new Error("No NFT data returned");
        setNft(d.nft);
        // Generate slug client-side first
        const base = generateSlug({
          contract,
          identifier: tokenId,
          name: d.nft.name ?? undefined,
          collection: d.nft.collection ?? undefined,
        });
        // Then check availability on-chain
        try {
          const s = await fetch(`/api/slug?base=${encodeURIComponent(base)}`);
          const j = await s.json();
          setSlug(j.slug || base);
        } catch {
          setSlug(base);
        }
      } catch (e: any) {
        if (!cancelled) setNftErr(e.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [contract, tokenId]);

  const { data: price } = useReadContract({
    address: REGISTRAR_ADDRESS,
    abi: REGISTRAR_ABI,
    functionName: "priceFor",
    args: [BigInt(years)],
  });

  const { writeContract, data: txHash, error: writeErr } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (writeErr) { setErr(writeErr.message); setDeploying(false); }
  }, [writeErr]);

  async function deploy() {
    if (!nft || !slug || !address || price === undefined) return;
    setDeploying(true);
    setErr(null);
    try {
      setStep("Generating museum site…");
      const gen = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contract, tokenId, subdomain: slug, owner: address }),
      }).then(r => r.json());
      if (gen.error) throw new Error(gen.error);

      setStep("Pinning to IPFS…");
      const pin = await fetch("/api/pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files: gen.files, name: `${slug}.artid.eth` }),
      }).then(r => r.json());
      if (pin.error) throw new Error(pin.error);
      setCid(pin.cid);

      setStep("Confirm in your wallet…");
      writeContract({
        address: FORWARDER_ADDRESS,
        abi: FORWARDER_ABI,
        functionName: "register",
        args: [slug, BigInt(years), contract as `0x${string}`, BigInt(tokenId), pin.contenthash],
        value: price as bigint,
      });
    } catch (e: any) {
      setErr(e.message || String(e));
      setDeploying(false);
    }
  }

  // ─── Render states ─────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-4xl gilded-text">Please connect your wallet</h1>
        <p className="mt-4 text-[#a89e85]">Use the button in the top-right.</p>
      </div>
    );
  }
  if (nftErr) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-3xl text-red-400">Couldn't load NFT</h1>
        <p className="mt-4 font-mono text-sm text-[#a89e85] break-all">{nftErr}</p>
        <Link href="/dashboard" className="mt-8 inline-block text-gilded-300 underline">← Back to dashboard</Link>
      </div>
    );
  }
  if (!nft) {
    return (
      <div className="p-24 text-center text-[#a89e85] font-display italic">Curating your selection…</div>
    );
  }
  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-gilded-300/70">Acquired</p>
        <h1 className="font-display text-6xl gilded-text mt-4">Your museum is open.</h1>
        <p className="mt-8 text-lg">
          Visit it at{" "}
          <a className="text-gilded-300 underline" href={`https://${slug}.artid.eth.limo`} target="_blank" rel="noreferrer">
            {slug}.artid.eth.limo
          </a>
        </p>
        <p className="mt-2 text-xs text-[#5a5141] font-mono">IPFS · {cid}</p>
        <Link href="/museums" className="mt-12 inline-block px-6 py-3 border border-gilded-500/40 hover:border-gilded-300">
          View all your museums
        </Link>
      </div>
    );
  }

  const imageUrl = nft.display_image_url || nft.image_url || "";

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 grid lg:grid-cols-[1fr_1.1fr] gap-14">
      {/* LEFT: form */}
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-gilded-300/70">Selected work</p>
        <h1 className="font-display text-5xl gilded-text mt-2 leading-tight">{nft.name || `#${tokenId}`}</h1>
        <p className="text-sm text-[#8a8068] mt-2 italic">{nft.collection || "—"}</p>

        <div className="mt-8 gilded-frame p-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#8a8068]">Your subdomain</div>
          <div className="font-display text-3xl text-gilded-300 mt-2 break-all">
            {slug || <span className="text-[#5a5141]">…</span>}<span className="text-[#a89e85]">.artid.eth</span>
          </div>
          <p className="text-[11px] text-[#5a5141] mt-3 italic">Auto-generated, permanent, yours.</p>
        </div>

        <div className="mt-8">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#8a8068] mb-3">Duration</div>
          <div className="flex gap-3">
            {YEARS_OPTIONS.map(y => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className={`flex-1 py-4 border font-display text-xl transition ${
                  years === y
                    ? "border-gilded-300 bg-gilded-500/10 text-gilded-300"
                    : "border-charcoal-700 text-[#a89e85] hover:border-gilded-500/40"
                }`}
              >
                {y}<span className="text-sm ml-1">yr{y > 1 ? "s" : ""}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 border border-charcoal-700 p-6 bg-charcoal-900/40">
          <div className="flex justify-between text-sm text-[#a89e85]">
            <span>Platform fee</span>
            <span className="font-mono">{price !== undefined ? "—" : ""}{/* computed below */}</span>
          </div>
          <PriceBreakdown years={years} total={price as bigint | undefined} />
        </div>

        <button
          onClick={deploy}
          disabled={deploying || !slug || price === undefined}
          className="mt-8 w-full py-5 bg-gilded-500 text-charcoal-950 font-medium tracking-wide hover:bg-gilded-400 disabled:bg-charcoal-700 disabled:text-[#5a5141] transition shadow-gilded"
        >
          {confirming ? "Confirming on-chain…" : deploying ? step : "Mint passport"}
        </button>
        {err && <p className="mt-4 text-sm text-red-400 break-words">{err}</p>}
      </div>

      {/* RIGHT: preview */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#8a8068] mb-3">Live museum preview</div>
        <div className="gilded-frame overflow-hidden bg-charcoal-900" style={{ aspectRatio: "9/14" }}>
          {slug ? (
            <iframe
              key={`${contract}-${tokenId}-${slug}`}
              src={`/api/preview?contract=${contract}&tokenId=${tokenId}&subdomain=${slug}`}
              className="w-full h-full"
              title={`${slug} museum preview`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#5a5141] italic">
              loading preview…
            </div>
          )}
        </div>
        {imageUrl && (
          <div className="mt-4 flex items-center gap-3 text-xs text-[#5a5141]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="w-10 h-10 object-cover border border-gilded-500/30" />
            <span className="font-mono">Source NFT — Ethereum mainnet</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PriceBreakdown({ years, total }: { years: number; total?: bigint }) {
  const totalEth = total !== undefined ? formatEther(total) : "—";
  return (
    <>
      <div className="flex justify-between text-sm text-[#a89e85] mt-2">
        <span>{years} year{years > 1 ? "s" : ""}</span>
        <span className="font-mono">included</span>
      </div>
      <div className="flex justify-between mt-4 pt-4 border-t border-charcoal-700 font-display text-2xl">
        <span>Total</span>
        <span className="gilded-text font-mono">{totalEth} ETH</span>
      </div>
    </>
  );
}
