/**
 * Redeploy ArtIDRegistrar + ArtIDForwarder after the ERC1155Holder fix.
 * Skips the wrap-and-burn steps (artid.eth already wrapped).
 * Uses raw ethers (bypasses the hardhat-ethers Alchemy quirk).
 */
const { ethers, artifacts } = require("hardhat");
require("dotenv").config();

const ADDRS = {
  mainnet: {
    nameWrapper:    "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401",
    publicResolver: "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63",
  },
};

const PLATFORM_FEE = ethers.parseEther("0");                // currently 0
const PRICE_PER_YEAR = ethers.parseEther("0.00229254");     // ~$5/yr at $2181/ETH

async function main() {
  const A = ADDRS.mainnet;
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL_MAINNET);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const treasury = process.env.TREASURY_ADDRESS || wallet.address;
  const parentNode = ethers.namehash("artid.eth");

  console.log("Deployer:", wallet.address);
  console.log("Balance: ", ethers.formatEther(await provider.getBalance(wallet.address)));

  // ── Deploy ArtIDRegistrar ────────────────────────────────────────
  const regArt = await artifacts.readArtifact("ArtIDRegistrar");
  const regFactory = new ethers.ContractFactory(regArt.abi, regArt.bytecode, wallet);
  console.log("\n→ Deploying ArtIDRegistrar (with ERC1155Holder)…");
  const regDeployTx = await regFactory.getDeployTransaction(
    parentNode, A.nameWrapper, A.publicResolver,
    treasury, PLATFORM_FEE, PRICE_PER_YEAR, wallet.address
  );
  const regTx = await wallet.sendTransaction(regDeployTx);
  console.log("  tx:", regTx.hash);
  const regRcpt = await provider.waitForTransaction(regTx.hash);
  const registrarAddr = regRcpt.contractAddress;
  console.log("  ArtIDRegistrar:", registrarAddr);

  // ── Deploy ArtIDForwarder ────────────────────────────────────────
  const fwArt = await artifacts.readArtifact("ArtIDForwarder");
  const fwFactory = new ethers.ContractFactory(fwArt.abi, fwArt.bytecode, wallet);
  console.log("\n→ Deploying ArtIDForwarder…");
  const fwDeployTx = await fwFactory.getDeployTransaction(registrarAddr, wallet.address);
  const fwTx = await wallet.sendTransaction(fwDeployTx);
  console.log("  tx:", fwTx.hash);
  const fwRcpt = await provider.waitForTransaction(fwTx.hash);
  const forwarderAddr = fwRcpt.contractAddress;
  console.log("  ArtIDForwarder:", forwarderAddr);

  // ── setForwarder ─────────────────────────────────────────────────
  const reg = new ethers.Contract(registrarAddr, [
    "function setForwarder(address,bool)",
  ], wallet);
  console.log("\n→ ArtIDRegistrar.setForwarder(forwarder, true)…");
  let tx = await reg.setForwarder(forwarderAddr, true);
  console.log("  tx:", tx.hash);
  await provider.waitForTransaction(tx.hash);

  // ── Approve NEW registrar on NameWrapper ─────────────────────────
  const wrap = new ethers.Contract(A.nameWrapper, [
    "function setApprovalForAll(address,bool)",
    "function isApprovedForAll(address,address) view returns (bool)",
  ], wallet);
  if (!(await wrap.isApprovedForAll(wallet.address, registrarAddr))) {
    console.log("\n→ NameWrapper.setApprovalForAll(newRegistrar, true)…");
    tx = await wrap.setApprovalForAll(registrarAddr, true);
    console.log("  tx:", tx.hash);
    await provider.waitForTransaction(tx.hash);
  }

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  ✓ REDEPLOY DONE");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  NEW ArtIDRegistrar:  " + registrarAddr);
  console.log("  NEW ArtIDForwarder:  " + forwarderAddr);
  console.log("\n  Update frontend/.env:");
  console.log(`    NEXT_PUBLIC_REGISTRAR_ADDRESS=${registrarAddr}`);
  console.log(`    NEXT_PUBLIC_FORWARDER_ADDRESS=${forwarderAddr}`);
  console.log("\n  Verify on Etherscan:");
  console.log(`    npx hardhat verify --network mainnet ${registrarAddr} \\`);
  console.log(`      "${parentNode}" "${A.nameWrapper}" "${A.publicResolver}" \\`);
  console.log(`      "${treasury}" "${PLATFORM_FEE}" "${PRICE_PER_YEAR}" "${wallet.address}"`);
  console.log(`    npx hardhat verify --network mainnet ${forwarderAddr} \\`);
  console.log(`      "${registrarAddr}" "${wallet.address}"`);
}

main().catch((e) => { console.error(e); process.exit(1); });
