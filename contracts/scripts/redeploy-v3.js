/**
 * Redeploy ArtIDRegistrar v3 (donation model) + ArtIDForwarder.
 * Uses raw ethers to dodge the hardhat-ethers ⇄ Alchemy contract-creation bug.
 */
const { ethers, artifacts } = require("hardhat");
require("dotenv").config();

const NAME_WRAPPER    = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";
const PUBLIC_RESOLVER = "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63";
const ETH_CONTROLLER  = "0x253553366Da8546fC250F225fe3d25d0C782303b";
const PARENT_LABEL    = "artid";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL_MAINNET);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const parentNode = ethers.namehash("artid.eth");

  console.log("Deployer:", wallet.address);
  console.log("Balance: ", ethers.formatEther(await provider.getBalance(wallet.address)), "ETH");

  // 1. Registrar
  const regArt = await artifacts.readArtifact("ArtIDRegistrar");
  const regFactory = new ethers.ContractFactory(regArt.abi, regArt.bytecode, wallet);
  console.log("\n→ Deploying ArtIDRegistrar v3…");
  const regTx = await wallet.sendTransaction(
    await regFactory.getDeployTransaction(parentNode, PARENT_LABEL, NAME_WRAPPER, PUBLIC_RESOLVER, ETH_CONTROLLER, wallet.address)
  );
  console.log("  tx:", regTx.hash);
  const regRcpt = await provider.waitForTransaction(regTx.hash);
  const registrarAddr = regRcpt.contractAddress;
  console.log("  ArtIDRegistrar:", registrarAddr);

  // 2. Forwarder
  const fwArt = await artifacts.readArtifact("ArtIDForwarder");
  const fwFactory = new ethers.ContractFactory(fwArt.abi, fwArt.bytecode, wallet);
  console.log("\n→ Deploying ArtIDForwarder…");
  const fwTx = await wallet.sendTransaction(
    await fwFactory.getDeployTransaction(registrarAddr, wallet.address)
  );
  console.log("  tx:", fwTx.hash);
  const fwRcpt = await provider.waitForTransaction(fwTx.hash);
  const forwarderAddr = fwRcpt.contractAddress;
  console.log("  ArtIDForwarder:", forwarderAddr);

  // 3. setForwarder
  const reg = new ethers.Contract(registrarAddr, ["function setForwarder(address,bool)"], wallet);
  console.log("\n→ setForwarder…");
  let tx = await reg.setForwarder(forwarderAddr, true);
  console.log("  tx:", tx.hash);
  await provider.waitForTransaction(tx.hash);

  // 4. NameWrapper approval for new registrar
  const wrap = new ethers.Contract(NAME_WRAPPER, [
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
  console.log("  ✓ v3 DEPLOY DONE");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  ArtIDRegistrar v3:  " + registrarAddr);
  console.log("  ArtIDForwarder v3:  " + forwarderAddr);
  console.log("\n  Update frontend/.env:");
  console.log("    NEXT_PUBLIC_REGISTRAR_ADDRESS=" + registrarAddr);
  console.log("    NEXT_PUBLIC_FORWARDER_ADDRESS=" + forwarderAddr);
  console.log("\n  Verify:");
  console.log(`    npx hardhat verify --network mainnet ${registrarAddr} \\`);
  console.log(`      "${parentNode}" "${PARENT_LABEL}" "${NAME_WRAPPER}" "${PUBLIC_RESOLVER}" "${ETH_CONTROLLER}" "${wallet.address}"`);
  console.log(`    npx hardhat verify --network mainnet ${forwarderAddr} \\`);
  console.log(`      "${registrarAddr}" "${wallet.address}"`);
}

main().catch((e) => { console.error(e); process.exit(1); });
