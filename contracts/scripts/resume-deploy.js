/**
 * Resume mainnet bring-up after wrap + registrar are already deployed.
 * Reads REGISTRAR_ADDR from env, deploys forwarder, wires authorization, approves.
 *
 *   REGISTRAR_ADDR=0x61bee75562230D1BBDAeD5D95a4f4D200B19CFdc \
 *   npx hardhat run scripts/resume-deploy.js --network mainnet
 */
const { ethers, network } = require("hardhat");

const NETS = {
  mainnet: { chainId: 1, nameWrapper: "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401" },
  sepolia: { chainId: 11155111, nameWrapper: "0x0635513f179D50A207757E05759CbD106d7dFcE8" },
};

async function main() {
  const net = network.name;
  const A = NETS[net];
  if (!A) throw new Error(`No address book for ${net}`);
  const registrarAddr = process.env.REGISTRAR_ADDR;
  if (!registrarAddr) throw new Error("Set REGISTRAR_ADDR env");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Existing registrar: ${registrarAddr}`);

  const Forwarder = await ethers.getContractFactory("ArtIDForwarder");
  console.log("\nDeploying ArtIDForwarder…");
  const deployTx = await Forwarder.getDeployTransaction(registrarAddr, deployer.address);
  const sent = await deployer.sendTransaction(deployTx);
  console.log(`  tx: ${sent.hash}`);
  const rcpt = await ethers.provider.getTransactionReceipt(sent.hash)
    ?? await new Promise(async (resolve) => {
      const poll = async () => {
        const r = await ethers.provider.getTransactionReceipt(sent.hash);
        if (r) resolve(r); else setTimeout(poll, 4000);
      };
      poll();
    });
  const forwarderAddr = rcpt.contractAddress;
  console.log(`  ArtIDForwarder: ${forwarderAddr}`);

  const registrarAbi = ["function setForwarder(address,bool) external"];
  const registrar = new ethers.Contract(registrarAddr, registrarAbi, deployer);
  console.log("\nArtIDRegistrar.setForwarder(forwarder, true)…");
  const tx2 = await registrar.setForwarder(forwarderAddr, true);
  console.log(`  tx: ${tx2.hash}`);
  await ethers.provider.waitForTransaction(tx2.hash);

  const wrapper = new ethers.Contract(
    A.nameWrapper,
    ["function setApprovalForAll(address,bool) external", "function isApprovedForAll(address,address) view returns (bool)"],
    deployer
  );
  const already = await wrapper.isApprovedForAll(deployer.address, registrarAddr);
  if (already) {
    console.log("\nNameWrapper already approves registrar — skipping");
  } else {
    console.log("\nNameWrapper.setApprovalForAll(registrar, true)…");
    const tx3 = await wrapper.setApprovalForAll(registrarAddr, true);
    console.log(`  tx: ${tx3.hash}`);
    await ethers.provider.waitForTransaction(tx3.hash);
  }

  const parent = ethers.namehash("artid.eth");
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  ✓ DONE");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`  ArtIDRegistrar:  ${registrarAddr}`);
  console.log(`  ArtIDForwarder:  ${forwarderAddr}`);
  console.log(`  parent node:     ${parent}`);
  console.log(`\n  frontend/.env entries:`);
  console.log(`    NEXT_PUBLIC_REGISTRAR_ADDRESS=${registrarAddr}`);
  console.log(`    NEXT_PUBLIC_FORWARDER_ADDRESS=${forwarderAddr}`);
  console.log(`    NEXT_PUBLIC_ARTID_PARENT_NODE=${parent}`);
  console.log(`    NEXT_PUBLIC_CHAIN_ID=${A.chainId}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
