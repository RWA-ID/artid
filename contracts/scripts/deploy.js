/**
 * Deploys ArtIDRegistrar + ArtIDForwarder.
 *
 *   npx hardhat run scripts/deploy.js --network mainnet
 *   npx hardhat run scripts/deploy.js --network sepolia
 *
 * PREREQUISITES (do BEFORE running):
 *   1. You own `artid.eth` on the target network.
 *   2. You have WRAPPED `artid.eth` via app.ens.domains.
 *   3. You have BURNED `CANNOT_UNWRAP` on artid.eth (required for the
 *      registrar to mint children with PARENT_CANNOT_CONTROL burned).
 *      This is irreversible — artid.eth can never be unwrapped again.
 *
 * AFTER deploying, from the artid.eth owner wallet:
 *   NameWrapper.setApprovalForAll(registrarAddress, true)
 *
 * Env required:
 *   DEPLOYER_PRIVATE_KEY, NEXT_PUBLIC_RPC_URL_{MAINNET|SEPOLIA}, TREASURY_ADDRESS
 *   (optional) ETHERSCAN_API_KEY for verification
 */
const { ethers, network } = require("hardhat");

const ADDRS = {
  sepolia: {
    nameWrapper: "0x0635513f179D50A207757E05759CbD106d7dFcE8",
    publicResolver: "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD",
  },
  mainnet: {
    nameWrapper: "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401",
    publicResolver: "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63",
  },
};

async function main() {
  const net = network.name;
  if (!ADDRS[net]) throw new Error(`No address book for "${net}"`);

  const treasury = process.env.TREASURY_ADDRESS;
  if (!treasury) throw new Error("Set TREASURY_ADDRESS env var");

  const parentNode = ethers.namehash("artid.eth");
  const platformFee = ethers.parseEther("0.0075");
  const pricePerYear = ethers.parseEther("0.008");

  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log(`\nDeployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(bal)} ETH`);
  console.log(`Network:  ${net}`);
  console.log(`Treasury: ${treasury}`);
  console.log(`Parent:   ${parentNode}\n`);

  const Registrar = await ethers.getContractFactory("ArtIDRegistrar");
  console.log("Deploying ArtIDRegistrar…");
  const registrar = await Registrar.deploy(
    parentNode,
    ADDRS[net].nameWrapper,
    ADDRS[net].publicResolver,
    treasury,
    platformFee,
    pricePerYear,
    deployer.address
  );
  await registrar.waitForDeployment();
  const registrarAddr = await registrar.getAddress();
  console.log(`  ArtIDRegistrar: ${registrarAddr}`);

  const Forwarder = await ethers.getContractFactory("ArtIDForwarder");
  console.log("Deploying ArtIDForwarder…");
  const forwarder = await Forwarder.deploy(registrarAddr, deployer.address);
  await forwarder.waitForDeployment();
  const forwarderAddr = await forwarder.getAddress();
  console.log(`  ArtIDForwarder: ${forwarderAddr}`);

  console.log("Authorizing forwarder on registrar…");
  const tx = await registrar.setForwarder(forwarderAddr, true);
  await tx.wait();
  console.log(`  ✓ tx: ${tx.hash}`);

  console.log("\n──────────────────────────────────────────────");
  console.log("DEPLOYED. Next steps:");
  console.log(`  1. From the artid.eth owner wallet on ${net}, call:`);
  console.log(`     NameWrapper(${ADDRS[net].nameWrapper}).setApprovalForAll(${registrarAddr}, true)`);
  console.log("  2. Add to frontend/.env:");
  console.log(`     NEXT_PUBLIC_REGISTRAR_ADDRESS=${registrarAddr}`);
  console.log(`     NEXT_PUBLIC_FORWARDER_ADDRESS=${forwarderAddr}`);
  console.log(`     NEXT_PUBLIC_ARTID_PARENT_NODE=${parentNode}`);
  console.log(`     NEXT_PUBLIC_CHAIN_ID=${net === "mainnet" ? 1 : 11155111}`);
  console.log("  3. Verify on Etherscan:");
  console.log(`     npx hardhat verify --network ${net} ${registrarAddr} \\`);
  console.log(`       "${parentNode}" "${ADDRS[net].nameWrapper}" "${ADDRS[net].publicResolver}" \\`);
  console.log(`       "${treasury}" "${platformFee}" "${pricePerYear}" "${deployer.address}"`);
  console.log(`     npx hardhat verify --network ${net} ${forwarderAddr} \\`);
  console.log(`       "${registrarAddr}" "${deployer.address}"`);
  console.log("──────────────────────────────────────────────\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
