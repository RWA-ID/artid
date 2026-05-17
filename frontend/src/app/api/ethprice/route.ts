import { NextResponse } from "next/server";

export const revalidate = 60;

export async function GET() {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      next: { revalidate: 60 },
    });
    if (!r.ok) return NextResponse.json({ usd: null }, { status: 502 });
    const d = await r.json();
    return NextResponse.json({ usd: d.ethereum?.usd ?? null });
  } catch (e: any) {
    return NextResponse.json({ usd: null, error: e.message }, { status: 500 });
  }
}
