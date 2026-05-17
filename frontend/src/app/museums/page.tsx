"use client";
import { useAccount, usePublicClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { REGISTRAR_ADDRESS, REGISTRAR_ABI } from "@/lib/contracts";
import { useEthUsd, formatEthAndUsd } from "@/lib/useEthUsd";

type Museum = { label: string; node: `0x${string}`; nftContract: string; tokenId: bigint };

const DONATE_OPTIONS = [1, 2, 5, 10] as const;

export default function Museums() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const [items, setItems] = useState<Museum[]>([]);
  const [loading, setLoading] = useState(false);
  const ethUsd = useEthUsd();

  const { data: parentExpiry } = useReadContract({
    address: REGISTRAR_ADDRESS, abi: REGISTRAR_ABI, functionName: "parentExpiry",
  });
  const { data: totalSubnames } = useReadContract({
    address: REGISTRAR_ADDRESS, abi: REGISTRAR_ABI, functionName: "totalSubnames",
  });

  useEffect(() => {
    if (!client || !address) return;
    setLoading(true);
    (async () => {
      const logs = await client.getContractEvents({
        address: REGISTRAR_ADDRESS, abi: REGISTRAR_ABI, eventName: "Registered",
        args: { owner: address }, fromBlock: "earliest",
      });
      setItems(logs.map((l: any) => ({
        label: l.args.label as string,
        node: l.args.node as `0x${string}`,
        nftContract: l.args.nftContract as string,
        tokenId: l.args.tokenId as bigint,
      })));
      setLoading(false);
    })();
  }, [client, address]);

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-7 py-32 text-center">
        <p className="text-[11px] tracking-[0.42em] uppercase text-[#c8a35a]/70">— Your museums —</p>
        <h1 className="font-display italic font-light text-[clamp(48px,6vw,72px)] leading-[1.05] text-[#ece4d2] mt-6">Connect to see your gallery.</h1>
      </div>
    );
  }

  const expiryDate = parentExpiry ? new Date(Number(parentExpiry) * 1000) : null;
  const daysLeft = parentExpiry ? Math.floor((Number(parentExpiry) * 1000 - Date.now()) / 86400000) : 0;

  return (
    <div className="relative bg-[#0a0908] text-[#ece4d2] min-h-screen">
      <section className="max-w-[1200px] mx-auto px-7 pt-20 pb-8">
        <p className="text-[11px] tracking-[0.42em] uppercase text-[#c8a35a]/70">— The shared gallery —</p>
        <h1 className="font-display font-normal text-[clamp(48px,6vw,80px)] leading-[0.98] tracking-[-0.025em] mt-5">
          The <span className="italic font-light text-[#d8b977]">museums</span> you've minted.
        </h1>
        <p className="mt-6 max-w-2xl text-[15px] leading-[1.7] text-[#b8aa8e]">
          Every artid.eth subname shares the parent's expiry — one shared clock for the whole gallery.
          Donate to the parent to push the date forward for every passport, yours and everyone else's.
        </p>
        <div className="h-px mt-10" style={{ background: "linear-gradient(90deg, transparent, rgba(200,163,90,0.22) 12%, rgba(200,163,90,0.22) 88%, transparent)" }} />
      </section>

      {/* Shared expiry card */}
      {expiryDate && <SharedExpiryCard expiry={expiryDate} daysLeft={daysLeft} totalSubnames={Number(totalSubnames ?? 0n)} ethUsd={ethUsd} />}

      <section className="max-w-[1200px] mx-auto px-7 pb-32 mt-16">
        <p className="text-[11px] tracking-[0.32em] uppercase text-[#6a6151] mb-6">Your passports</p>

        {loading && <p className="text-[11px] tracking-[0.32em] uppercase text-[#6a6151] italic">Reading on-chain history…</p>}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((m) => (
            <a key={m.node} href={`https://${m.label}.artid.eth.link`} target="_blank" rel="noreferrer"
              className="block border border-[rgba(200,163,90,0.18)] p-6 bg-[#13110f] hover:border-[#c8a35a]/60 transition group">
              <div className="font-display text-2xl tracking-[-0.01em] text-[#d8b977] group-hover:text-[#f0d989] truncate">
                {m.label}<span className="text-[#a89e85]">.artid.eth</span>
              </div>
              <div className="mt-3 flex items-center gap-3 text-[10px] tracking-[0.32em] uppercase text-[#6a6151]">
                <span>Token #{m.tokenId.toString()}</span>
                <span className="font-mono normal-case tracking-normal text-[10px] text-[#5a5141]">{m.nftContract.slice(0, 6)}…{m.nftContract.slice(-4)}</span>
              </div>
            </a>
          ))}
        </div>

        {!loading && items.length === 0 && (
          <div className="text-center py-12">
            <p className="font-display italic text-2xl text-[#8a8068]">No passports yet.</p>
            <Link href="/dashboard" className="mt-6 inline-block text-[11px] tracking-[0.32em] uppercase text-[#c8a35a] hover:text-[#d8b977]">Mint your first →</Link>
          </div>
        )}
      </section>
    </div>
  );
}

function SharedExpiryCard({ expiry, daysLeft, totalSubnames, ethUsd }: { expiry: Date; daysLeft: number; totalSubnames: number; ethUsd: number | null }) {
  const [years, setYears] = useState<number>(1);
  const { data: price } = useReadContract({
    address: REGISTRAR_ADDRESS, abi: REGISTRAR_ABI, functionName: "donationPrice", args: [BigInt(years)],
  });
  const { writeContract, data: hash, error: writeErr, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const newExpiry = new Date(expiry.getTime() + years * 365 * 86400000);
  const urgent = daysLeft <= 60;

  function donate() {
    if (price === undefined) return;
    reset();
    writeContract({
      address: REGISTRAR_ADDRESS, abi: REGISTRAR_ABI, functionName: "donate",
      args: [BigInt(years)], value: price,
    });
  }

  return (
    <section className="max-w-[1200px] mx-auto px-7 mt-8">
      <div className="border border-[rgba(200,163,90,0.22)] p-8 bg-gradient-to-b from-[#16130f] to-[#0a0908]">
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end">
          <div>
            <p className="text-[10px] tracking-[0.32em] uppercase text-[#6a6151]">The gallery is open through</p>
            <div className={`font-display font-light text-[clamp(40px,5vw,64px)] leading-[1] mt-3 ${urgent ? "text-yellow-400" : "text-[#ece4d2]"}`}>
              {expiry.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </div>
            <p className="mt-4 text-[13px] text-[#a89e85]">
              {daysLeft} days remaining · {totalSubnames} museum{totalSubnames === 1 ? "" : "s"} share this date.
            </p>
          </div>

          <div className="flex flex-col gap-3 min-w-[260px]">
            <div className="text-[10px] tracking-[0.32em] uppercase text-[#6a6151]">Donate to push it forward</div>
            <div className="grid grid-cols-4 gap-1.5">
              {DONATE_OPTIONS.map(y => (
                <button key={y} onClick={() => setYears(y)}
                  className={`py-3 border text-sm transition ${years === y ? "border-gilded-300 bg-gilded-500/10 text-gilded-300" : "border-charcoal-700 text-[#a89e85] hover:border-gilded-500/40"}`}>
                  +{y}y
                </button>
              ))}
            </div>
            <button onClick={donate} disabled={confirming || price === undefined}
              className="mt-2 py-3.5 bg-gilded-500 text-charcoal-950 text-[11px] tracking-[0.3em] uppercase hover:bg-gilded-400 disabled:bg-charcoal-700 disabled:text-[#5a5141] transition">
              {confirming ? "Confirming…" : isSuccess ? "✓ Donated" : `Donate · ${price ? formatEthAndUsd(price as bigint, ethUsd) : "…"}`}
            </button>
            <p className="text-[10px] text-[#5a5141] text-center italic">
              extends every museum to {newExpiry.toLocaleDateString()}
            </p>
            {writeErr && <p className="text-[10px] text-red-400/80 break-words">{writeErr.message.split("\n")[0]}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
