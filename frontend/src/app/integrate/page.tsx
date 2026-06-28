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
  const [tab, setTab] = useState<"html" | "react">("html");
  const [copied, setCopied] = useState(false);

  const { writeContract, data: txHash, error: writeErr, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

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
    return (
      <div className="max-w-2xl mx-auto px-6 sm:px-7 py-24 sm:py-32 text-center">
        <p className="text-[10px] sm:text-[11px] tracking-[0.32em] sm:tracking-[0.42em] uppercase text-[#c8a35a]/70">— For collection owners —</p>
        <h1 className="font-display italic font-light text-[clamp(48px,6vw,72px)] leading-[1.05] text-[#ece4d2] mt-6">
          Connect the wallet that controls your collection.
        </h1>
        <p className="mt-8 max-w-xl mx-auto text-[14px] leading-[1.7] text-[#a89e85]">
          Earn from every museum minted under your NFTs — automatic, on-chain, no portal to maintain.
        </p>
      </div>
    );
  }

  const embedHtml = isAddress(collection) ? `<!-- ArtID widget for your collection -->
<script src="https://artid.eth.link/widget.js"
  data-collection="${getAddress(collection)}"
  defer></script>

<!-- Optional: place the button anywhere with a placeholder div -->
<!-- <div data-artid-widget data-collection="${getAddress(collection)}"></div> -->` : "";

  const embedReact = isAddress(collection) ? `import { ArtIDWidget } from "@artidv1/react";

<ArtIDWidget
  collection="${getAddress(collection)}"
  onRegistered={(e) => console.log("Museum minted:", e.subdomain)}
/>` : "";

  const existingActive = existing && (existing as any)[2];
  const existingFee = existing && (existing as any)[1] as bigint;
  const existingTreasury = existing && (existing as any)[0] as string;

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative bg-[#0a0908] text-[#ece4d2] min-h-screen">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto px-6 sm:px-7 pt-14 sm:pt-20 pb-10">
        <p className="text-[10px] sm:text-[11px] tracking-[0.32em] sm:tracking-[0.42em] uppercase text-[#c8a35a]/70">— For collection owners —</p>
        <h1 className="font-display font-normal text-[clamp(48px,6vw,80px)] leading-[0.98] tracking-[-0.025em] mt-5">
          Earn from every <span className="italic font-light text-[#d8b977]">museum</span><br />
          minted under your collection.
        </h1>
        <p className="mt-7 max-w-2xl text-[15px] leading-[1.75] text-[#b8aa8e]">
          Set on-chain payout terms once. Any collector who mints a museum passport for an NFT in your collection
          will route a fee straight to your treasury — in the same transaction, with no signature, no manual approval, no portal to maintain.
          The forwarder reads your terms live on every mint.
        </p>
        <div className="h-px mt-12" style={{ background: "linear-gradient(90deg, transparent, rgba(200,163,90,0.22) 12%, rgba(200,163,90,0.22) 88%, transparent)" }} />
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto px-6 sm:px-7 pb-4">
        <p className="text-[11px] tracking-[0.32em] uppercase text-[#6a6151] mb-8">How it works</p>
        <div className="grid md:grid-cols-3 gap-[18px]">
          <PrimerCard
            n="01"
            title="Prove ownership"
            body={
              <>The page reads <span className="font-mono text-[#a89e85]">Ownable.owner()</span> (or{" "}
              <span className="font-mono text-[#a89e85]">AccessControl.DEFAULT_ADMIN_ROLE</span>) on your collection. Zero gas.</>
            }
          />
          <PrimerCard
            n="02"
            title="Set terms on-chain"
            body={
              <>One tx writes <span className="font-mono text-[#a89e85]">(treasury, fee)</span> to the forwarder.
              Max fee 0.05 ETH. Update or clear anytime from the same wallet.</>
            }
          />
          <PrimerCard
            n="03"
            title="Earn automatically"
            body={
              <>Every mint of an NFT in your collection — through your embed or anywhere else —
              splits payment three ways: platform · ENS DAO donation · <span className="text-[#d8b977]">you</span>.</>
            }
          />
        </div>
      </section>

      {/* ── Step 1 ───────────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto px-6 sm:px-7 pt-16">
        <Step n="1" eyebrow="The contract you control" title="Verify ownership">
          <div className="mt-6 relative">
            <input
              value={collection}
              onChange={(e) => { setCollection(e.target.value); setVerified(null); }}
              placeholder="0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D"
              className="w-full bg-[#100e0c] border border-[rgba(200,163,90,0.18)] focus:border-[#c8a35a] px-5 py-4 font-mono text-[13px] text-[#ece4d2] outline-none transition"
            />
          </div>
          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <button
              onClick={verify}
              disabled={!isAddress(collection) || verifying}
              className="px-7 py-3 border border-[rgba(200,163,90,0.4)] hover:border-[#c8a35a] hover:bg-[rgba(200,163,90,0.05)] hover:text-[#d8b977] text-[11px] tracking-[0.3em] uppercase text-[#c8a35a] disabled:opacity-30 disabled:hover:bg-transparent transition"
            >
              {verifying ? "Checking…" : "Verify ownership"}
            </button>
            {verified === "ok" && (
              <span className="inline-flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-[#86c878]">
                <Dot color="#86c878" /> Verified
              </span>
            )}
            {verified === "manual" && (
              <span className="inline-flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-[#e2b96e]">
                <Dot color="#e2b96e" /> Couldn't auto-verify
              </span>
            )}
          </div>
          {verifyErr && <p className="mt-4 text-[12px] text-red-400/90">{verifyErr}</p>}
          {verified === "manual" && (
            <p className="mt-3 text-[12px] text-[#8a8068] italic leading-snug max-w-xl">
              Your contract needs <span className="font-mono text-[#a89e85]">owner()</span> (Ownable) or{" "}
              <span className="font-mono text-[#a89e85]">hasRole(DEFAULT_ADMIN_ROLE, you)</span> (AccessControl).
              If neither applies, reach out for manual verification.
            </p>
          )}
          {existingActive && (
            <div className="mt-6 border border-[rgba(200,163,90,0.18)] bg-[#100e0c] p-5">
              <p className="text-[10px] tracking-[0.32em] uppercase text-[#6a6151] mb-2">Existing on-chain terms</p>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <span className="font-display italic text-[24px] text-[#d8b977]">{formatEther(existingFee || 0n)} ETH</span>
                <span className="text-[12px] text-[#8a8068]">→</span>
                <span className="font-mono text-[12px] text-[#a89e85] break-all">{existingTreasury}</span>
              </div>
            </div>
          )}
        </Step>
      </section>

      {/* ── Step 2 ───────────────────────────────────────────── */}
      {verified === "ok" && (
        <section className="max-w-[1200px] mx-auto px-6 sm:px-7 pt-14">
          <Step n="2" eyebrow="Where the artist fee lands" title="Payout terms">
            <div className="mt-6 grid md:grid-cols-2 gap-5">
              <Field label="Artist treasury" hint="Defaults to your wallet">
                <input
                  value={treasury}
                  onChange={(e) => setTreasury(e.target.value)}
                  placeholder="0x…"
                  className="w-full bg-[#100e0c] border border-[rgba(200,163,90,0.18)] focus:border-[#c8a35a] px-5 py-4 font-mono text-[13px] text-[#ece4d2] outline-none transition"
                />
              </Field>
              <Field label="Artist fee" hint="Max 0.05 ETH per mint">
                <div className="flex items-center bg-[#100e0c] border border-[rgba(200,163,90,0.18)] focus-within:border-[#c8a35a] transition">
                  <input
                    type="number" step="0.0001" min="0" max="0.05"
                    value={feeEth}
                    onChange={(e) => setFeeEth(e.target.value)}
                    className="flex-1 bg-transparent px-5 py-4 font-mono text-[13px] text-[#ece4d2] outline-none"
                  />
                  <span className="pr-5 text-[11px] tracking-[0.32em] uppercase text-[#6a6151]">ETH</span>
                </div>
              </Field>
            </div>

            <p className="mt-5 text-[12px] text-[#8a8068] italic leading-snug max-w-xl">
              One on-chain transaction. You can update or clear these terms anytime from the same wallet — the forwarder always reads the latest values at mint time.
            </p>

            <div className="mt-7 flex items-center gap-3 flex-wrap">
              <button
                onClick={submit}
                disabled={confirming || !isAddress(treasury) || Number(feeEth) < 0 || Number(feeEth) > 0.05}
                className="px-9 py-3.5 bg-gradient-to-b from-[#f0d989] via-[#d8b977] to-[#c8a35a] text-[#0a0908] font-medium tracking-[0.3em] uppercase text-[11px] hover:from-[#f4e09e] hover:to-[#d2ae65] disabled:from-[#3a3429] disabled:to-[#2a261e] disabled:text-[#5a5141] transition shadow-[0_8px_24px_rgba(200,163,90,0.25),inset_0_1px_0_rgba(255,255,255,0.3)]"
              >
                {confirming ? "Confirming…" : isSuccess ? "✓ Terms saved" : existingActive ? "Update terms" : "Set terms"}
              </button>
              {existingActive && (
                <button
                  onClick={clear}
                  disabled={confirming}
                  className="px-7 py-3.5 border border-red-400/30 text-red-400/90 hover:border-red-400/60 hover:bg-red-500/5 text-[11px] tracking-[0.3em] uppercase transition disabled:opacity-30"
                >
                  Clear
                </button>
              )}
            </div>
            {writeErr && (
              <div className="mt-5 p-3 border border-red-500/30 bg-red-500/5 text-[12px] text-red-400/90 max-w-2xl break-words">
                {writeErr.message.split("\n")[0]}
              </div>
            )}
          </Step>
        </section>
      )}

      {/* ── Step 3 ───────────────────────────────────────────── */}
      {existingActive && (
        <section className="max-w-[1200px] mx-auto px-6 sm:px-7 pt-14 pb-24 sm:pb-32">
          <Step n="3" eyebrow="Drop into your collection's site" title="Embed the widget">
            <div className="mt-6 inline-flex border-b border-[rgba(200,163,90,0.18)]">
              <TabBtn active={tab === "html"} onClick={() => setTab("html")}>HTML</TabBtn>
              <TabBtn active={tab === "react"} onClick={() => setTab("react")}>React</TabBtn>
            </div>
            <pre className="mt-4 relative bg-[#100e0c] border border-[rgba(200,163,90,0.18)] p-6 text-[12.5px] leading-[1.7] overflow-x-auto font-mono text-[#cdc3a8]">
              <code>{tab === "html" ? embedHtml : embedReact}</code>
            </pre>
            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <button
                onClick={() => copy(tab === "html" ? embedHtml : embedReact)}
                className="px-7 py-3 border border-[rgba(200,163,90,0.4)] hover:border-[#c8a35a] hover:text-[#d8b977] text-[11px] tracking-[0.3em] uppercase text-[#c8a35a] transition"
              >
                {copied ? "Copied ✓" : "Copy snippet"}
              </button>
              {tab === "react" && (
                <code className="text-[11px] text-[#6a6151]">npm i @artidv1/react</code>
              )}
            </div>
            <p className="mt-6 text-[12px] text-[#8a8068] italic leading-snug max-w-2xl">
              The widget opens an iframe modal. Every mint reads your terms on-chain — you don't need to redeploy or regenerate anything when you change the fee.
            </p>
          </Step>
        </section>
      )}
    </div>
  );
}

/* ── Primitives ─────────────────────────────────────────────── */

function PrimerCard({ n, title, body }: { n: string; title: string; body: React.ReactNode }) {
  return (
    <div className="border border-[rgba(200,163,90,0.14)] bg-[#100e0c] p-7 hover:border-[rgba(200,163,90,0.32)] transition">
      <div className="font-display italic text-[#c8a35a] text-[32px] leading-none mb-4">{n}</div>
      <div className="font-display text-[22px] text-[#ece4d2] mb-3 tracking-[-0.01em]">{title}</div>
      <div className="text-[13px] text-[#a89e85] leading-[1.65]">{body}</div>
    </div>
  );
}

function Step({ n, eyebrow, title, children }: { n: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-4 sm:gap-5 mb-2">
        <span className="font-display italic text-[#c8a35a]/70 text-[28px] leading-none">{n}.</span>
        <p className="text-[10px] sm:text-[11px] tracking-[0.26em] sm:tracking-[0.42em] uppercase text-[#c8a35a]/70">— {eyebrow} —</p>
      </div>
      <h2 className="font-display font-normal text-[clamp(32px,4vw,48px)] leading-[1.05] tracking-[-0.02em] text-[#ece4d2]">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-[10px] tracking-[0.32em] uppercase text-[#6a6151]">{label}</label>
        {hint && <span className="text-[11px] text-[#5a5141] italic">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 text-[11px] tracking-[0.3em] uppercase transition relative ${
        active ? "text-[#d8b977]" : "text-[#6a6151] hover:text-[#a89e85]"
      }`}
    >
      {children}
      {active && <span className="absolute left-0 right-0 -bottom-px h-px bg-[#c8a35a]" />}
    </button>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />;
}
