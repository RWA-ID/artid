"use client";
import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { isAddress, parseEther, formatEther, getAddress } from "viem";
import { FORWARDER_ADDRESS, FORWARDER_ABI } from "@/lib/contracts";

const OWNABLE_ABI = [{
  name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }],
}] as const;

const ACCESS_ABI = [{
  name: "hasRole", type: "function", stateMutability: "view",
  inputs: [{ type: "bytes32" }, { type: "address" }],
  outputs: [{ type: "bool" }],
}] as const;

const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export default function Integrate() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();

  const [collection, setCollection] = useState("");
  const [verified, setVerified] = useState<null | "ok" | "manual">(null);
  const [verifyErr, setVerifyErr] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [treasury, setTreasury] = useState("");
  const [feeEth, setFeeEth] = useState("0.0025");

  const { writeContract, data: txHash, error: writeErr, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Read existing terms for this collection (so artist sees what's already on-chain)
  const { data: existing, refetch: refetchTerms } = useReadContract({
    address: FORWARDER_ADDRESS,
    abi: FORWARDER_ABI,
    functionName: "getArtistTerms",
    args: [isAddress(collection) ? (getAddress(collection) as `0x${string}`) : "0x0000000000000000000000000000000000000000"],
    query: { enabled: isAddress(collection) },
  });

  useEffect(() => { if (isSuccess) refetchTerms(); }, [isSuccess, refetchTerms]);

  async function verify() {
    if (!client || !isAddress(collection) || !address) return;
    setVerifying(true);
    setVerifyErr(null);
    setVerified(null);
    try {
      const coll = getAddress(collection) as `0x${string}`;
      try {
        const owner = await client.readContract({ address: coll, abi: OWNABLE_ABI, functionName: "owner" });
        if (typeof owner === "string" && owner.toLowerCase() === address.toLowerCase()) {
          setVerified("ok");
          if (!treasury) setTreasury(address);
          return;
        }
      } catch {}
      try {
        const has = await client.readContract({
          address: coll, abi: ACCESS_ABI, functionName: "hasRole",
          args: [DEFAULT_ADMIN_ROLE, address],
        });
        if (has) { setVerified("ok"); if (!treasury) setTreasury(address); return; }
      } catch {}
      setVerified("manual");
    } catch (e: any) {
      setVerifyErr(e.message || String(e));
    } finally {
      setVerifying(false);
    }
  }

  function submit() {
    reset();
    writeContract({
      address: FORWARDER_ADDRESS,
      abi: FORWARDER_ABI,
      functionName: "setArtistTerms",
      args: [
        getAddress(collection) as `0x${string}`,
        getAddress(treasury) as `0x${string}`,
        parseEther(feeEth),
      ],
    });
  }

  function clear() {
    reset();
    writeContract({
      address: FORWARDER_ADDRESS,
      abi: FORWARDER_ABI,
      functionName: "clearArtistTerms",
      args: [getAddress(collection) as `0x${string}`],
    });
  }

  if (!isConnected) {
    return <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <h1 className="font-display text-5xl gilded-text">Artists, sign in</h1>
      <p className="mt-4 text-[#a89e85]">Connect the wallet that owns your NFT collection contract.</p>
    </div>;
  }

  const embedHtml = isAddress(collection) ? `<!-- ArtID widget for your collection -->
<script src="https://cdn.artid.eth/widget.js"
  data-collection="${getAddress(collection)}"></script>` : "";

  const embedReact = isAddress(collection) ? `import { ArtIDWidget } from "@artid/react";

<ArtIDWidget collection="${getAddress(collection)}" />` : "";

  const [tab, setTab] = useState<"html" | "react">("html");
  const existingActive = existing && (existing as any)[2];
  const existingFee = existing && (existing as any)[1] as bigint;
  const existingTreasury = existing && (existing as any)[0] as string;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-display text-5xl gilded-text">Integrate ArtID</h1>
      <p className="mt-4 text-[#a89e85]">
        Embed a museum-mint button on your collection's site. Collectors mint inline; the on-chain forwarder pays your treasury on every mint.
      </p>

      <section className="mt-10 gilded-frame p-6">
        <h2 className="font-display text-2xl">1 — Verify ownership</h2>
        <input
          value={collection}
          onChange={(e) => { setCollection(e.target.value); setVerified(null); }}
          placeholder="0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D"
          className="mt-4 w-full bg-charcoal-900 border border-charcoal-700 px-4 py-3 font-mono text-sm focus:border-gilded-400 outline-none"
        />
        <button
          onClick={verify}
          disabled={!isAddress(collection) || verifying}
          className="mt-4 px-6 py-2 border border-gilded-500/40 hover:border-gilded-300 disabled:opacity-50"
        >
          {verifying ? "Checking…" : "Verify on-chain ownership"}
        </button>
        {verifyErr && <p className="mt-3 text-sm text-red-400">{verifyErr}</p>}
        {verified === "ok" && <p className="mt-3 text-sm text-green-400">✓ Verified. You control this collection.</p>}
        {verified === "manual" && (
          <p className="mt-3 text-sm text-yellow-400">
            Couldn't auto-verify. Your contract must expose Ownable.owner() or AccessControl.hasRole(DEFAULT_ADMIN_ROLE, you).
          </p>
        )}
        {existingActive && (
          <p className="mt-3 text-sm text-[#a89e85]">
            Existing on-chain terms: <span className="text-gilded-300">{formatEther(existingFee || 0n)} ETH</span> →{" "}
            <span className="font-mono text-xs">{existingTreasury}</span>
          </p>
        )}
      </section>

      {verified === "ok" && (
        <section className="mt-6 gilded-frame p-6">
          <h2 className="font-display text-2xl">2 — Set payout terms (on-chain)</h2>

          <label className="block mt-4 text-xs uppercase tracking-widest text-[#8a8068]">Artist treasury</label>
          <input
            value={treasury}
            onChange={(e) => setTreasury(e.target.value)}
            className="mt-1 w-full bg-charcoal-900 border border-charcoal-700 px-4 py-3 font-mono text-sm focus:border-gilded-400 outline-none"
          />

          <label className="block mt-4 text-xs uppercase tracking-widest text-[#8a8068]">Artist fee (ETH) — max 0.05</label>
          <input
            type="number" step="0.0001" min="0" max="0.05"
            value={feeEth}
            onChange={(e) => setFeeEth(e.target.value)}
            className="mt-1 w-full bg-charcoal-900 border border-charcoal-700 px-4 py-3 font-mono text-sm focus:border-gilded-400 outline-none"
          />

          <p className="mt-3 text-xs text-[#5a5141]">
            One on-chain tx. You can update or clear these terms at any time from the same wallet.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              onClick={submit}
              disabled={confirming || !isAddress(treasury) || Number(feeEth) < 0 || Number(feeEth) > 0.05}
              className="flex-1 py-3 bg-gilded-500 text-charcoal-950 font-medium hover:bg-gilded-400 disabled:bg-charcoal-700 disabled:text-[#5a5141]"
            >
              {confirming ? "Confirming…" : isSuccess ? "✓ Terms saved" : existingActive ? "Update terms" : "Set terms"}
            </button>
            {existingActive && (
              <button
                onClick={clear}
                disabled={confirming}
                className="px-5 py-3 border border-red-500/40 text-red-400 hover:border-red-400"
              >
                Clear
              </button>
            )}
          </div>
          {writeErr && <p className="mt-3 text-sm text-red-400">{writeErr.message}</p>}
        </section>
      )}

      {existingActive && (
        <section className="mt-6 gilded-frame p-6">
          <h2 className="font-display text-2xl">3 — Embed</h2>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setTab("html")} className={`px-3 py-1 text-sm ${tab === "html" ? "bg-gilded-500/20 text-gilded-300" : "text-[#8a8068]"}`}>HTML</button>
            <button onClick={() => setTab("react")} className={`px-3 py-1 text-sm ${tab === "react" ? "bg-gilded-500/20 text-gilded-300" : "text-[#8a8068]"}`}>React</button>
          </div>
          <pre className="mt-3 bg-charcoal-900 border border-charcoal-700 p-4 text-xs overflow-x-auto font-mono">
{tab === "html" ? embedHtml : embedReact}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(tab === "html" ? embedHtml : embedReact)}
            className="mt-3 px-4 py-2 text-sm border border-gilded-500/40 hover:border-gilded-300"
          >
            Copy to clipboard
          </button>
          <p className="mt-4 text-xs text-[#5a5141]">
            The widget reads your terms from the forwarder on every mint — no signature, no expiry. Update them anytime.
          </p>
        </section>
      )}
    </div>
  );
}
