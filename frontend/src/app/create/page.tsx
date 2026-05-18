"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useEstimateFeesPerGas, useChainId, useSwitchChain, usePublicClient } from "wagmi";
import { formatEther, isAddress, getAddress } from "viem";
import { mainnet } from "wagmi/chains";
import Link from "next/link";
import { generateSlug } from "@/lib/slug";
import { resolveAvailableSlug } from "@/lib/slug-client";
import { FORWARDER_ADDRESS, FORWARDER_ABI, REGISTRAR_ADDRESS, REGISTRAR_ABI } from "@/lib/contracts";
import { useEthUsd, formatEthAndUsd } from "@/lib/useEthUsd";
import { fetchNft, type OpenSeaNft } from "@/lib/opensea";
import { buildMuseumFiles, buildPreviewHtml } from "@/lib/museum-generate";
import { pinSiteFolder } from "@/lib/pinata-browser";

const DONATE_OPTIONS = [0, 1, 2, 5, 10] as const;
const FALLBACK_GAS = 700_000n;

export default function CreatePageWrapper() {
  return (
    <Suspense fallback={<div className="p-24 text-center text-[#a89e85] font-display italic">Loading…</div>}>
      <CreatePage />
    </Suspense>
  );
}

function CreatePage() {
  const sp = useSearchParams();
  const rawContract = sp.get("c") || "";
  const tokenId = sp.get("t") || "";
  const contract = isAddress(rawContract) ? getAddress(rawContract) : rawContract;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: mainnet.id });

  const [nft, setNft] = useState<OpenSeaNft | null>(null);
  const [nftErr, setNftErr] = useState<string | null>(null);
  const [slug, setSlug] = useState<string>("");
  const [donateYears, setDonateYears] = useState<number>(0);
  const [xHandle, setXHandle] = useState<string>("");
  const [previewSrcDoc, setPreviewSrcDoc] = useState<string>("");
  const [deploying, setDeploying] = useState(false);
  const [step, setStep] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [cid, setCid] = useState<string>("");

  if (!contract || !tokenId) {
    return <CenteredMessage title="Missing NFT reference" body="Open a passport from the dashboard." />;
  }

  // Fetch NFT
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchNft(contract, tokenId);
        if (cancelled) return;
        if (!data) throw new Error("No NFT data returned");
        setNft(data);
        const base = generateSlug({
          contract, identifier: tokenId,
          name: data.name ?? undefined,
          collection: data.collection ?? undefined,
        });
        try {
          const s = await resolveAvailableSlug(base);
          if (!cancelled) setSlug(s);
        } catch { if (!cancelled) setSlug(base); }
      } catch (e: any) {
        if (!cancelled) setNftErr(e.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [contract, tokenId]);

  // Live preview HTML — built client-side and injected via srcDoc
  useEffect(() => {
    if (!nft || !slug) return;
    let cancelled = false;
    buildPreviewHtml({ nft, contract, tokenId, subdomain: slug, xHandle })
      .then(html => { if (!cancelled) setPreviewSrcDoc(html); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [nft, slug, xHandle, contract, tokenId]);

  // Pricing
  const { data: donationPrice } = useReadContract({
    address: REGISTRAR_ADDRESS, abi: REGISTRAR_ABI, functionName: "donationPrice", args: [BigInt(donateYears)],
  });
  const { data: parentExpiry } = useReadContract({
    address: REGISTRAR_ADDRESS, abi: REGISTRAR_ABI, functionName: "parentExpiry",
  });
  const { data: platformFee } = useReadContract({
    address: FORWARDER_ADDRESS, abi: FORWARDER_ABI, functionName: "platformFee",
  });
  const { data: artistTerms } = useReadContract({
    address: FORWARDER_ADDRESS, abi: FORWARDER_ABI, functionName: "getArtistTerms", args: [contract as `0x${string}`],
  });
  const artistFee = artistTerms?.[2] ? (artistTerms[1] as bigint) : 0n;
  const total = (donationPrice ?? 0n) + ((platformFee as bigint | undefined) ?? 0n) + artistFee;
  const ethUsd = useEthUsd();
  const { data: fees } = useEstimateFeesPerGas({ chainId: mainnet.id });

  const [gasUnits, setGasUnits] = useState<bigint | undefined>();
  useEffect(() => {
    if (!publicClient || !slug || !address) return;
    let cancelled = false;
    publicClient.estimateContractGas({
      address: FORWARDER_ADDRESS, abi: FORWARDER_ABI, functionName: "register",
      args: [slug, BigInt(donateYears), contract as `0x${string}`, BigInt(tokenId), "0xe301017012209abc"],
      value: total, account: address,
    }).then(g => { if (!cancelled) setGasUnits(g); })
      .catch(() => { if (!cancelled) setGasUnits(FALLBACK_GAS); });
    return () => { cancelled = true; };
  }, [publicClient, slug, address, donateYears, total, contract, tokenId]);

  const gasCostWei = useMemo(() => {
    if (!fees?.maxFeePerGas) return undefined;
    return (gasUnits ?? FALLBACK_GAS) * fees.maxFeePerGas;
  }, [fees, gasUnits]);

  const { writeContract, data: txHash, error: writeErr, reset: resetWrite } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  useEffect(() => {
    if (writeErr) { setErr(writeErr.message.split("\n")[0]); setDeploying(false); setStep(""); }
  }, [writeErr]);

  const isEmbed = sp.get("embed") === "1";
  useEffect(() => {
    if (isSuccess && isEmbed && typeof window !== "undefined" && window.parent !== window) {
      try {
        window.parent.postMessage(
          { type: "artid:registered", subdomain: `${slug}.artid.eth`, slug, txHash, cid },
          "*"
        );
      } catch {}
    }
  }, [isSuccess, isEmbed, slug, txHash, cid]);

  async function deploy() {
    if (!nft || !slug || !address || donationPrice === undefined) return;
    setDeploying(true); setErr(null); resetWrite();
    try {
      setStep("Generating museum site…");
      const files = await buildMuseumFiles({ nft, contract, tokenId, subdomain: slug, owner: address, xHandle });

      setStep("Pinning to IPFS…");
      const { cid: pinnedCid, contenthash } = await pinSiteFolder(files, `${slug}.artid.eth`);
      setCid(pinnedCid);

      if (chainId !== mainnet.id) {
        setStep("Switching to Ethereum mainnet…");
        try { await switchChainAsync({ chainId: mainnet.id }); }
        catch (e: any) { throw new Error(`Please switch to Ethereum mainnet (${e?.message || e})`); }
      }

      setStep("Confirm in your wallet…");
      writeContract({
        chainId: mainnet.id,
        address: FORWARDER_ADDRESS, abi: FORWARDER_ABI, functionName: "register",
        args: [slug, BigInt(donateYears), contract as `0x${string}`, BigInt(tokenId), contenthash],
        value: total,
        gas: gasUnits ? gasUnits + 80_000n : undefined,
        ...(fees?.maxFeePerGas ? {
          maxFeePerGas: (fees.maxFeePerGas * 110n) / 100n,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? 1_000_000n,
        } : {}),
      });
    } catch (e: any) {
      setErr(e.message || String(e)); setDeploying(false); setStep("");
    }
  }

  if (!isConnected) return <CenteredMessage title="Please connect your wallet" />;
  if (nftErr) return <CenteredMessage title="Couldn't load NFT" body={nftErr} />;
  if (!nft) return <div className="p-24 text-center text-[#a89e85] font-display italic">Curating your selection…</div>;

  if (isSuccess) {
    const expiryDate = parentExpiry ? new Date(Number(parentExpiry) * 1000) : null;
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-[11px] tracking-[0.42em] uppercase text-[#c8a35a]/70">— Acquired —</p>
        <h1 className="font-display font-light italic text-[clamp(48px,7vw,80px)] gilded-text mt-6">Your museum is open.</h1>
        <p className="mt-8 text-lg">
          Visit it at{" "}
          <a className="text-gilded-300 underline" href={`https://${slug}.artid.eth.link`} target="_blank" rel="noreferrer">
            {slug}.artid.eth.link
          </a>
        </p>
        {expiryDate && (
          <div className="mt-8 inline-block text-left border border-[rgba(200,163,90,0.18)] px-6 py-5 max-w-md">
            <div className="text-[10px] tracking-[0.32em] uppercase text-[#6a6151]">Open through</div>
            <div className="font-display text-2xl text-[#ece4d2] mt-1">
              {expiryDate.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </div>
            <div className="text-[11px] text-[#8a8068] mt-3 leading-snug">
              Every artid.eth museum shares one expiry — the lifetime of <span className="font-mono text-[#a89e85]">artid.eth</span> itself.
              {donateYears > 0
                ? ` Your ${donateYears}-year donation extended this date for every passport in the gallery.`
                : " Anyone can donate years from the Museums page to push this date forward for everyone."}
            </div>
          </div>
        )}
        <p className="mt-6 text-xs text-[#5a5141] font-mono">IPFS · {cid}</p>
        <div className="mt-12 flex flex-wrap justify-center items-center gap-3">
          <a
            href={`https://twitter.com/intent/tweet?${new URLSearchParams({
              text: `Just inaugurated my museum at ${slug}.artid.eth — a permanent IPFS gallery for ${nft?.name || `#${tokenId}`}. Mint your own at`,
              url: `https://${slug}.artid.eth.link`,
              hashtags: "artid,ENS",
            }).toString()}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gilded-500 text-charcoal-950 font-medium tracking-[0.3em] uppercase text-[11px] hover:bg-gilded-400 transition shadow-gilded"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Share on X
          </a>
          <Link href="/museums" className="inline-block px-6 py-3 border border-gilded-500/40 hover:border-gilded-300 text-[11px] tracking-[0.3em] uppercase">
            View all museums
          </Link>
        </div>
      </div>
    );
  }

  const imageUrl = nft.display_image_url || nft.image_url || "";
  const expectedExpiry = parentExpiry
    ? new Date((Number(parentExpiry) + donateYears * 365 * 24 * 60 * 60) * 1000)
    : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 grid lg:grid-cols-[1fr_1.1fr] gap-14">
      <div>
        <p className="text-[11px] tracking-[0.42em] uppercase text-[#c8a35a]/70">— Selected work —</p>
        <h1 className="font-display text-5xl gilded-text mt-3 leading-tight">{nft.name || `#${tokenId}`}</h1>
        <p className="text-sm text-[#8a8068] mt-2 italic">{nft.collection || "—"}</p>

        <div className="mt-8 border border-[rgba(200,163,90,0.18)] p-6">
          <div className="text-[10px] uppercase tracking-[0.32em] text-[#6a6151]">Your subdomain</div>
          <div className="font-display text-3xl text-gilded-300 mt-2 break-all">
            {slug || <span className="text-[#5a5141]">…</span>}<span className="text-[#a89e85]">.artid.eth</span>
          </div>
          <p className="text-[11px] text-[#5a5141] mt-3 italic">Auto-generated, permanent, yours.</p>
        </div>

        <div className="mt-6">
          <div className="text-[10px] uppercase tracking-[0.32em] text-[#6a6151] mb-2">X handle (optional)</div>
          <div className="flex items-center border border-charcoal-700 focus-within:border-gilded-400 transition bg-charcoal-900/40">
            <span className="px-3 text-[#5a5141] font-mono">@</span>
            <input
              type="text"
              value={xHandle}
              onChange={(e) => setXHandle(e.target.value.replace(/^@+/, "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 15))}
              placeholder="yourhandle" maxLength={15}
              className="flex-1 bg-transparent py-3 pr-3 font-mono text-sm text-[#ece4d2] outline-none"
            />
          </div>
          <p className="text-[11px] text-[#5a5141] mt-2 italic leading-snug">
            Featured under "Holder" in the museum's Creator card. Baked into the IPFS site — no extra transaction.
          </p>
        </div>

        <div className="mt-8">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[10px] uppercase tracking-[0.32em] text-[#6a6151]">Donate years to artid.eth (optional)</div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-[#5a5141]">benefits every passport</div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {DONATE_OPTIONS.map(y => (
              <button key={y} onClick={() => setDonateYears(y)}
                className={`py-4 border font-display text-xl transition ${
                  donateYears === y ? "border-gilded-300 bg-gilded-500/10 text-gilded-300"
                                   : "border-charcoal-700 text-[#a89e85] hover:border-gilded-500/40"
                }`}>
                {y === 0 ? "—" : `+${y}`}<span className="text-[10px] ml-1">{y === 0 ? "free" : `yr${y > 1 ? "s" : ""}`}</span>
              </button>
            ))}
          </div>
          {parentExpiry && expectedExpiry && (
            <p className="text-[11px] text-[#5a5141] mt-3 leading-snug italic">
              {donateYears === 0
                ? <>Your subname will share artid.eth's current expiry: <span className="text-[#a89e85]">{new Date(Number(parentExpiry) * 1000).toLocaleDateString()}</span>.</>
                : <>Pays the ENS DAO directly to extend artid.eth → new expiry for every museum: <span className="text-[#d8b977]">{expectedExpiry.toLocaleDateString()}</span></>
              }
            </p>
          )}
        </div>

        <div className="mt-8 border border-charcoal-700 p-8 bg-charcoal-900/40">
          <PriceBreakdown
            donateYears={donateYears}
            donation={donationPrice as bigint | undefined}
            platformFee={platformFee as bigint | undefined}
            artistFee={artistFee}
            gasCostWei={gasCostWei}
            gasUnits={gasUnits}
            total={total}
            usdPerEth={ethUsd}
            maxFeePerGas={fees?.maxFeePerGas}
          />
        </div>

        <button onClick={deploy} disabled={deploying || !slug || donationPrice === undefined}
          className="mt-8 w-full py-5 bg-gilded-500 text-charcoal-950 font-medium tracking-[0.3em] uppercase text-[11px] hover:bg-gilded-400 disabled:bg-charcoal-700 disabled:text-[#5a5141] transition shadow-gilded">
          {confirming ? "Confirming on-chain…" : deploying ? step : total === 0n ? "Mint passport (gas only)" : "Mint passport"}
        </button>
        {txHash && (
          <div className="mt-3 text-xs text-[#a89e85]">
            Pending:{" "}
            <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="text-gilded-300 underline font-mono">
              {txHash.slice(0, 10)}…{txHash.slice(-8)}
            </a>
            {" — "}{confirming ? "waiting for confirmation" : "submitted"}
          </div>
        )}
        {err && (
          <div className="mt-4 p-3 border border-red-500/30 bg-red-500/5 text-sm text-red-400">
            <div className="font-medium">Transaction failed</div>
            <div className="mt-1 text-xs break-words opacity-80">{err}</div>
            <button onClick={() => { setErr(null); resetWrite(); }} className="mt-2 text-xs underline">dismiss</button>
          </div>
        )}
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.32em] text-[#6a6151] mb-3">Live museum preview</div>
        <div className="overflow-hidden bg-charcoal-900" style={{ aspectRatio: "9/14", boxShadow: "inset 0 0 0 1px rgba(200,163,90,0.18)" }}>
          {previewSrcDoc ? (
            <iframe srcDoc={previewSrcDoc} className="w-full h-full" title={`${slug} museum preview`} sandbox="allow-scripts" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#5a5141] italic">loading preview…</div>
          )}
        </div>
        {imageUrl && (
          <div className="mt-4 flex items-center gap-3 text-[10px] tracking-[0.32em] uppercase text-[#5a5141]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="w-10 h-10 object-cover border border-gilded-500/30" />
            <span className="font-mono normal-case tracking-normal">Source NFT · Ethereum mainnet</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CenteredMessage({ title, body }: { title: string; body?: string }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <h1 className="font-display text-4xl gilded-text">{title}</h1>
      {body && <p className="mt-4 font-mono text-sm text-[#a89e85] break-all">{body}</p>}
    </div>
  );
}

function PriceBreakdown({
  donateYears, donation, platformFee, artistFee, gasCostWei, gasUnits, total, usdPerEth, maxFeePerGas,
}: {
  donateYears: number;
  donation?: bigint;
  platformFee?: bigint;
  artistFee: bigint;
  gasCostWei?: bigint;
  gasUnits?: bigint;
  total: bigint;
  usdPerEth: number | null;
  maxFeePerGas?: bigint;
}) {
  const totalEth = formatEther(total);
  const totalNum = Number(totalEth);
  const usd = usdPerEth ? totalNum * usdPerEth : undefined;
  return (
    <>
      <div className="flex flex-col gap-3.5">
        <Row label="Platform fee" val={formatEthAndUsd(platformFee, usdPerEth)} />
        <Row label={donateYears === 0 ? "Donation to artid.eth" : `Donate ${donateYears} yr${donateYears > 1 ? "s" : ""} (ENS DAO)`}
             val={formatEthAndUsd(donation, usdPerEth)} />
        {artistFee > 0n && <Row label="Artist fee" val={formatEthAndUsd(artistFee, usdPerEth)} />}
        <Row label={`Network gas (est. ${gasUnits ? Number(gasUnits).toLocaleString() : "…"} units)`} val={formatEthAndUsd(gasCostWei, usdPerEth)} />
      </div>
      <div className="h-px my-7"
        style={{ background: "linear-gradient(90deg, transparent, rgba(200,163,90,0.18) 15%, rgba(200,163,90,0.18) 85%, transparent)" }} />
      <div className="grid grid-cols-[1fr_auto] items-end gap-6">
        <div className="font-display italic font-light text-sm tracking-[0.42em] uppercase text-gilded-300">Total to send</div>
        <div className="text-right">
          <div className="font-display font-light leading-[0.95] tracking-[-0.04em] text-[clamp(48px,7vw,84px)]"
            style={{
              fontFeatureSettings: '"tnum" 1, "lnum" 1',
              background: "linear-gradient(180deg, #f0d989 0%, #d8b977 45%, #c8a35a 100%)",
              WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
              textShadow: "0 0 60px rgba(200,163,90,0.15)",
            }}>
            {totalNum.toFixed(5)}
            <span className="text-[0.36em] italic ml-2" style={{ letterSpacing: "0.04em" }}>ETH</span>
          </div>
          {usd !== undefined && (
            <div className="mt-3 text-[11px] tracking-[0.32em] uppercase text-[#6a6151]">≈ ${usd.toFixed(2)} USD</div>
          )}
        </div>
      </div>
      {maxFeePerGas && (
        <p className="text-[10px] text-[#5a5141] mt-6 leading-snug">
          Donation flows directly to the ENS DAO at the live oracle rate.
          On-chain gas at {(Number(maxFeePerGas) / 1e9).toFixed(2)} gwei.
        </p>
      )}
    </>
  );
}

function Row({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-[11px] tracking-[0.18em] uppercase text-[#6a6151]">{label}</span>
      <span className="font-mono text-[13px] text-[#ece4d2]">{val}</span>
    </div>
  );
}
