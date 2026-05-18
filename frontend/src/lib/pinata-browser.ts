"use client";

const JWT = () => process.env.NEXT_PUBLIC_PINATA_JWT || "";

/**
 * Pin a folder of named string files to Pinata.
 * Returns the CIDv1 (bafy…) of the wrapping directory.
 */
export async function pinSiteFolder(
  files: Record<string, string>,
  name: string
): Promise<{ cid: string; contenthash: `0x${string}` }> {
  const form = new FormData();
  for (const [filename, content] of Object.entries(files)) {
    const ct = filename.endsWith(".html") ? "text/html"
             : filename.endsWith(".css") ? "text/css"
             : filename.endsWith(".js") ? "application/javascript"
             : "application/octet-stream";
    form.append("file", new Blob([content], { type: ct }), `${name}/${filename}`);
  }
  form.append("pinataMetadata", JSON.stringify({ name, keyvalues: { kind: "museum" } }));
  // wrapWithDirectory:false + the `${name}/` prefix above means the CID IS the
  // museum directory itself (so visiting the CID resolves index.html directly,
  // not a directory listing of a single subfolder). cidVersion 1 → bafy…
  form.append("pinataOptions", JSON.stringify({ wrapWithDirectory: false, cidVersion: 1 }));

  const r = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${JWT()}` },
    body: form,
  });
  if (!r.ok) throw new Error(`Pinata ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const cid: string = d.IpfsHash;
  return { cid, contenthash: encodeIpfsContentHash(cid) };
}

/**
 * Encode an IPFS CID as an ENS contenthash (EIP-1577).
 * Supports CIDv1 base32 (bafy…) and CIDv0 base58 (Qm…).
 */
export function encodeIpfsContentHash(cid: string): `0x${string}` {
  if (cid.startsWith("bafy") || cid.startsWith("bafk")) {
    const bytes = base32Decode(cid);
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return ("0xe301" + hex) as `0x${string}`;
  }
  if (cid.startsWith("Qm")) {
    const bytes = base58Decode(cid);
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return ("0xe30101701220" + hex.slice(4)) as `0x${string}`;
  }
  throw new Error(`Unsupported CID format: ${cid}`);
}

const B32 = "abcdefghijklmnopqrstuvwxyz234567";
function base32Decode(s: string): Uint8Array {
  const clean = s.toLowerCase().replace(/=+$/, "");
  const data = clean.startsWith("b") ? clean.slice(1) : clean;
  const bits = data.split("").map(c => {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error(`Invalid base32 char: ${c}`);
    return i.toString(2).padStart(5, "0");
  }).join("");
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    out.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(out);
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Decode(s: string): Uint8Array {
  const map: Record<string, number> = {};
  for (let i = 0; i < B58.length; i++) map[B58[i]] = i;
  const bytes = [0];
  for (const c of s) {
    const v = map[c];
    if (v === undefined) throw new Error(`Invalid base58 char: ${c}`);
    let carry = v;
    for (let j = 0; j < bytes.length; j++) {
      const x = bytes[j] * 58 + carry;
      bytes[j] = x & 0xff;
      carry = x >> 8;
    }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (const c of s) { if (c !== "1") break; bytes.push(0); }
  return new Uint8Array(bytes.reverse());
}
