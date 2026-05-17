/**
 * Redeploy only ArtIDForwarder (v4) with platformFee. Registrar v3 stays.
 */
const { ethers, artifacts } = require("hardhat");
require("dotenv").config();

const REGISTRAR_V3 = "0x7F45Ded4DbDf82f41f2753EB2046df90147A639D";
const PLATFORM_FEE = ethers.parseEther("0.00555");

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL_MAINNET);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const treasury = process.env.TREASURY_ADDRESS || wallet.address;

  console.log("Deployer:", wallet.address);
  console.log("Treasury:", treasury);
  console.log("platformFee:", ethers.formatEther(PLATFORM_FEE), "ETH");

  // Deploy v4 forwarder
  const fwArt = await artifacts.readArtifact("ArtIDForwarder");
  const fwFactory = new ethers.ContractFactory(fwArt.abi, fwArt.bytecode, wallet);
  console.log("\n→ Deploying ArtIDForwarder v4…");
  const fwTx = await wallet.sendTransaction(
    await fwFactory.getDeployTransaction(REGISTRAR_V3, treasury, PLATFORM_FEE, wallet.address)
  );
  console.log("  tx:", fwTx.hash);
  const fwRcpt = await provider.waitForTransaction(fwTx.hash);
  const forwarderAddr = fwRcpt.contractAddress;
  console.log("  ArtIDForwarder v4:", forwarderAddr);

  // Authorize new forwarder on registrar
  const reg = new ethers.Contract(REGISTRAR_V3, [
    "function setForwarder(address,bool)",
    "function authorizedForwarders(address) view returns (bool)",
  ], wallet);
  console.log("\n→ Registrar.setForwarder(v4, true)…");
  const tx2 = await reg.setForwarder(forwarderAddr, true);
  console.log("  tx:", tx2.hash);
  await provider.waitForTransaction(tx2.hash);

  // De-authorize old forwarder (optional cleanliness)
  const OLD_FORWARDER = "0xb8569D288Ca135AfF5ee4180F6a65660aD634209";
  if (await reg.authorizedForwarders(OLD_FORWARDER)) {
    console.log("\n→ Registrar.setForwarder(v3 forwarder, false)…");
    const tx3 = await reg.setForwarder(OLD_FORWARDER, false);
    console.log("  tx:", tx3.hash);
    await provider.waitForTransaction(tx3.hash);
  }

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  ✓ v4 FORWARDER DONE");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  ArtIDForwarder v4:  " + forwarderAddr);
  console.log("  platformFee:        " + ethers.formatEther(PLATFORM_FEE) + " ETH");
  console.log("\n  Update frontend/.env:");
  console.log("    NEXT_PUBLIC_FORWARDER_ADDRESS=" + forwarderAddr);
  console.log("\n  Verify:");
  console.log(`    npx hardhat verify --network mainnet ${forwarderAddr} \\`);
  console.log(`      "${REGISTRAR_V3}" "${treasury}" "${PLATFORM_FEE}" "${wallet.address}"`);
}

main().catch((e) => { console.error(e); process.exit(1); });
