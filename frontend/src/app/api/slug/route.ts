import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { REGISTRAR_ADDRESS, REGISTRAR_ABI } from "@/lib/contracts";
import { findAvailableSlug } from "../../../../lib/slug";

const chain = process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? mainnet : sepolia;
const client = createPublicClient({
  chain,
  transport: http(chain.id === 1 ? process.env.NEXT_PUBLIC_RPC_URL_MAINNET : process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA),
});

export async function GET(req: NextRequest) {
  const base = new URL(req.url).searchParams.get("base");
  if (!base) return NextResponse.json({ error: "base required" }, { status: 400 });
  try {
    const slug = await findAvailableSlug(base, async (s) => {
      const avail = await client.readContract({
        address: REGISTRAR_ADDRESS, abi: REGISTRAR_ABI,
        functionName: "isAvailable", args: [s],
      });
      return !avail;
    });
    return NextResponse.json({ slug });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
