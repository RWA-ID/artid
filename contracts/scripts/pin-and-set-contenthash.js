/**
 * Pin landing-static/index.html to IPFS via Pinata, encode contenthash,
 * call PublicResolver.setContenthash(artid.eth, cid).
 *
 *   PINATA_JWT=... npx hardhat run scripts/pin-and-set-contenthash.js --network mainnet
 *
 * Uses raw ethers to bypass hardhat-ethers Alchemy quirk on contract calls.
 */
const { ethers } = require("hardhat");
const bs58 = require("bs58");
const fs = require("node:fs/promises");
const path = require("node:path");
require("dotenv").config();

// EIP-1577 encode a CIDv0 ("Qm…") as an ENS contenthash for IPFS.
// Format: 0xe3 0x01 (ipfs-ns) + 0x01 0x70 (cidv1 dag-pb) + 0x12 0x20 + 32-byte sha256 hash.
function encodeIpfsCidV0(cid) {
  const decoded = bs58.decode(cid); // [0x12, 0x20, ...32 bytes]
  if (decoded.length !== 34 || decoded[0] !== 0x12 || decoded[1] !== 0x20) {
    throw new Error(`Unexpected CIDv0 shape: ${cid}`);
  }
  const hash = Buffer.from(decoded.slice(2));
  const prefix = Buffer.from([0xe3, 0x01, 0x01, 0x70, 0x12, 0x20]);
  return "0x" + Buffer.concat([prefix, hash]).toString("hex");
}

const PUBLIC_RESOLVER = "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63";
const LANDING_DIR = path.join(__dirname, "..", "..", "landing-static");

async function pinFolder(jwt) {
  const files = await fs.readdir(LANDING_DIR);
  const form = new FormData();
  for (const name of files) {
    const buf = await fs.readFile(path.join(LANDING_DIR, name));
    const ct = name.endsWith(".html") ? "text/html"
             : name.endsWith(".css") ? "text/css"
             : name.endsWith(".js") ? "application/javascript"
             : "application/octet-stream";
    form.append("file", new Blob([buf], { type: ct }), `landing-static/${name}`);
  }
  const meta = JSON.stringify({ name: "artid.eth landing", keyvalues: { kind: "landing" } });
  form.append("pinataMetadata", meta);
  form.append("pinataOptions", JSON.stringify({ wrapWithDirectory: true }));

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
  return d.IpfsHash;
}

async function main() {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT not set");

  console.log("→ Pinning landing-static/ to Pinata…");
  const cid = await pinFolder(jwt);
  console.log("  CID:", cid);
  console.log("  Gateway:", `https://gateway.pinata.cloud/ipfs/${cid}`);

  const ch = encodeIpfsCidV0(cid);
  console.log("  contenthash:", ch);

  console.log("\n→ Setting contenthash on artid.eth via PublicResolver…");
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL_MAINNET);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const node = ethers.namehash("artid.eth");
  const resolver = new ethers.Contract(PUBLIC_RESOLVER, [
    "function setContenthash(bytes32 node, bytes calldata hash)",
    "function contenthash(bytes32 node) view returns (bytes memory)",
  ], wallet);
  const tx = await resolver.setContenthash(node, ch);
  console.log("  tx:", tx.hash);
  await provider.waitForTransaction(tx.hash);
  const onChain = await resolver.contenthash(node);
  console.log("  on-chain contenthash:", onChain);

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  ✓ artid.eth → IPFS");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  CID:        " + cid);
  console.log("  Live at:    https://artid.eth.link  (propagates in ~30s)");
  console.log("              https://artid.eth.limo");
  console.log("              ipns://artid.eth (in dApps)");
}

main().catch((e) => { console.error(e); process.exit(1); });
