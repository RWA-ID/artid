/**
 * Pin frontend/out/ (the static dApp) to Pinata as a CIDv1 directory.
 * Walks the out/ tree, uploads with wrapWithDirectory + cidVersion 1.
 */
const fs = require("node:fs/promises");
const path = require("node:path");
require("dotenv").config();

const OUT_DIR = path.join(__dirname, "..", "..", "frontend", "out");

function ctypeOf(name) {
  if (name.endsWith(".html")) return "text/html";
  if (name.endsWith(".css")) return "text/css";
  if (name.endsWith(".js")) return "application/javascript";
  if (name.endsWith(".json")) return "application/json";
  if (name.endsWith(".svg")) return "image/svg+xml";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".woff2")) return "font/woff2";
  if (name.endsWith(".woff")) return "font/woff";
  if (name.endsWith(".ico")) return "image/x-icon";
  if (name.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

async function walk(dir, base = dir) {
  const ents = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(full, base));
    else out.push({ full, rel: path.relative(base, full) });
  }
  return out;
}

async function main() {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT not set");

  const files = await walk(OUT_DIR);
  console.log(`Pinning ${files.length} files from out/…`);
  const form = new FormData();
  for (const f of files) {
    const buf = await fs.readFile(f.full);
    form.append("file", new Blob([buf], { type: ctypeOf(f.rel) }), `dapp/${f.rel}`);
  }
  form.append("pinataMetadata", JSON.stringify({ name: "artid-dapp", keyvalues: { kind: "dapp" } }));
  form.append("pinataOptions", JSON.stringify({ wrapWithDirectory: true, cidVersion: 1 }));

  const r = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Pinata ${r.status}: ${t}`);
  }
  const d = await r.json();
  console.log("");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  ✓ ArtID dApp pinned");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  CID:        " + d.IpfsHash);
  console.log("  Gateway:    https://gateway.pinata.cloud/ipfs/" + d.IpfsHash);
  console.log("  For ENS:    ipfs://" + d.IpfsHash);
  console.log("");
  console.log("Paste the ipfs:// string into app.ens.domains/artid.eth → Content Hash");
}

main().catch((e) => { console.error(e); process.exit(1); });
