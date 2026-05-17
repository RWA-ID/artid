"use client";
import { createPublicClient, http } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { REGISTRAR_ADDRESS, REGISTRAR_ABI } from "@/lib/contracts";
import { findAvailableSlug } from "@/lib/slug";

const chain = process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? mainnet : sepolia;
let _client: ReturnType<typeof createPublicClient> | null = null;
function client() {
  if (!_client) _client = createPublicClient({
    chain,
    transport: http(chain.id === 1 ? process.env.NEXT_PUBLIC_RPC_URL_MAINNET : process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA),
  });
  return _client;
}

export async function resolveAvailableSlug(base: string): Promise<string> {
  return findAvailableSlug(base, async (s) => {
    const avail = await client().readContract({
      address: REGISTRAR_ADDRESS, abi: REGISTRAR_ABI,
      functionName: "isAvailable", args: [s],
    });
    return !avail;
  });
}
