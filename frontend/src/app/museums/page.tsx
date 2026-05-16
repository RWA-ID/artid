"use client";
import { useAccount, usePublicClient } from "wagmi";
import { useEffect, useState } from "react";
import { keccak256, toBytes, parseEther, formatEther } from "viem";
import { REGISTRAR_ADDRESS, REGISTRAR_ABI } from "@/lib/contracts";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";

type Museum = { label: string; node: `0x${string}`; expiry: bigint; nftContract: string; tokenId: bigint };

export default function Museums() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const [items, setItems] = useState<Museum[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!client || !address) return;
    setLoading(true);
    (async () => {
      const logs = await client.getContractEvents({
        address: REGISTRAR_ADDRESS,
        abi: REGISTRAR_ABI,
        eventName: "Registered",
        args: { owner: address },
        fromBlock: "earliest",
      });
      setItems(
        logs.map((l: any) => ({
          label: l.args.label as string,
          node: l.args.node as `0x${string}`,
          expiry: l.args.expiry as bigint,
          nftContract: l.args.nftContract as string,
          tokenId: l.args.tokenId as bigint,
        }))
      );
      setLoading(false);
    })();
  }, [client, address]);

  if (!isConnected) {
    return <div className="p-24 text-center"><p className="text-[#a89e85]">Connect your wallet.</p></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="font-display text-5xl gilded-text">Your museums</h1>
      <p className="text-[#a89e85] mt-2">Names you've minted. Renew anytime, transfer anywhere.</p>

      {loading && <p className="mt-8 text-[#a89e85]">Loading events…</p>}
      <div className="mt-10 space-y-4">
        {items.map((m) => <Card key={m.node} m={m} />)}
        {!loading && items.length === 0 && (
          <p className="text-[#a89e85]">No museums yet. <a href="/dashboard" className="text-gilded-300 underline">Mint your first.</a></p>
        )}
      </div>
    </div>
  );
}

function Card({ m }: { m: Museum }) {
  const [years, setYears] = useState(1);
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const expiryDate = new Date(Number(m.expiry) * 1000);
  const renewCost = parseEther("0.008") * BigInt(years);

  return (
    <div className="gilded-frame p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <a className="font-display text-2xl gilded-text" href={`https://${m.label}.artid.eth.limo`} target="_blank" rel="noreferrer">
          {m.label}.artid.eth
        </a>
        <div className="text-xs text-[#8a8068] mt-1">Expires {expiryDate.toLocaleDateString()}</div>
      </div>
      <div className="flex items-center gap-3">
        <select value={years} onChange={(e) => setYears(Number(e.target.value))}
          className="bg-charcoal-900 border border-charcoal-700 px-3 py-2">
          {[1, 2, 5, 10].map(y => <option key={y} value={y}>{y}y</option>)}
        </select>
        <button
          onClick={() => writeContract({
            address: REGISTRAR_ADDRESS, abi: REGISTRAR_ABI, functionName: "renew",
            args: [m.label, BigInt(years)], value: renewCost,
          })}
          className="px-5 py-2 border border-gilded-500/40 hover:border-gilded-300"
        >
          {confirming ? "Renewing…" : isSuccess ? "✓ Renewed" : `Renew (${formatEther(renewCost)} ETH)`}
        </button>
      </div>
    </div>
  );
}
