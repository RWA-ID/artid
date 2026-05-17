"use client";
import { useEffect, useState } from "react";
import { formatEther } from "viem";

export function useEthUsd() {
  const [usd, setUsd] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd")
      .then(r => r.json())
      .then(d => { if (!cancelled) setUsd(d?.ethereum?.usd ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return usd;
}

export function formatEthAndUsd(wei: bigint | undefined, usdPerEth: number | null): string {
  if (wei === undefined) return "…";
  const eth = formatEther(wei);
  if (!usdPerEth) return `${eth} ETH`;
  const usd = Number(eth) * usdPerEth;
  return `${Number(eth).toFixed(5)} ETH · $${usd.toFixed(2)}`;
}
