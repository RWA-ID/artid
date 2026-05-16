import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata-web3";
import * as contentHash from "@ensdomains/content-hash";

export async function POST(req: NextRequest) {
  const { files, name } = await req.json();
  if (!files || typeof files !== "object") {
    return NextResponse.json({ error: "files required" }, { status: 400 });
  }
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return NextResponse.json({ error: "PINATA_JWT not set" }, { status: 500 });

  try {
    const pinata = new PinataSDK({ pinataJwt: jwt });
    const fileObjs = Object.entries(files as Record<string, string>).map(
      ([n, content]) => new File([content], n, { type: n.endsWith(".html") ? "text/html" : n.endsWith(".css") ? "text/css" : "application/javascript" })
    );
    const upload = await pinata.upload.fileArray(fileObjs).addMetadata({ name: name || "artid-site" });
    const cid = upload.IpfsHash;
    const encoded = (contentHash as any).encode("ipfs", cid);
    return NextResponse.json({ cid, contenthash: `0x${encoded}` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
