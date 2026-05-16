/**
 * One-shot mainnet bring-up for artid.eth.
 *
 * Performs, in order, from the artid.eth-owning wallet:
 *   (1) BaseRegistrar.setApprovalForAll(NameWrapper, true)        [if not already]
 *   (2) NameWrapper.wrapETH2LD("artid", owner, CANNOT_UNWRAP=1, PublicResolver)
 *   (3) Deploy ArtIDRegistrar
 *   (4) Deploy ArtIDForwarder
 *   (5) ArtIDRegistrar.setForwarder(forwarder, true)
 *   (6) NameWrapper.setApprovalForAll(ArtIDRegistrar, true)
 *
 * Step (2) burns CANNOT_UNWRAP on artid.eth IRREVERSIBLY.
 *
 *   npx hardhat run scripts/setup-and-deploy.js --network mainnet
 */
const { ethers, network } = require("hardhat");

const NETS = {
  mainnet: {
    chainId: 1,
    baseRegistrar:  "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85",
    nameWrapper:    "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401",
    publicResolver: "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63",
  },
  sepolia: {
    chainId: 11155111,
    baseRegistrar:  "0x0635513f179D50A207757E05759CbD106d7dFcE8", // sepolia uses same wrapper for .eth control via wrapETH2LD
    nameWrapper:    "0x0635513f179D50A207757E05759CbD106d7dFcE8",
    publicResolver: "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD",
  },
};

const CANNOT_UNWRAP = 1;
const PLATFORM_FEE = ethers.parseEther("0.0075");
const PRICE_PER_YEAR = ethers.parseEther("0.008");

const BASE_REGISTRAR_ABI = [
  "function ownerOf(uint256) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved)",
];

const NAMEWRAPPER_ABI = [
  "function wrapETH2LD(string label, address wrappedOwner, uint16 ownerControlledFuses, address resolver) returns (uint64)",
  "function isWrapped(bytes32 node) view returns (bool)",
  "function ownerOf(uint256 id) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved)",
  "function getData(uint256 id) view returns (address, uint32, uint64)",
];

async function step(name, fn) {
  console.log(`\n→ ${name}`);
  const result = await fn();
  return result;
}

async function main() {
  const net = network.name;
  if (!NETS[net]) throw new Error(`No address book for "${net}"`);
  const A = NETS[net];

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  const treasury = process.env.TREASURY_ADDRESS || deployer.address;

  console.log("══════════════════════════════════════════════════════════════");
  console.log("  artid.eth setup + deploy");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`  Network:      ${net} (chainId ${A.chainId})`);
  console.log(`  Deployer:     ${deployer.address}`);
  console.log(`  Balance:      ${ethers.formatEther(balance)} ETH`);
  console.log(`  Treasury:     ${treasury}`);
  console.log(`  NameWrapper:  ${A.nameWrapper}`);
  console.log(`  Resolver:     ${A.publicResolver}`);
  console.log("══════════════════════════════════════════════════════════════");

  const parentNode = ethers.namehash("artid.eth");
  const labelhash  = ethers.keccak256(ethers.toUtf8Bytes("artid"));
  const tokenId    = ethers.toBigInt(labelhash);

  console.log(`  parent node:  ${parentNode}`);
  console.log(`  labelhash:    ${labelhash}`);

  const baseRegistrar = new ethers.Contract(A.baseRegistrar, BASE_REGISTRAR_ABI, deployer);
  const nameWrapper   = new ethers.Contract(A.nameWrapper, NAMEWRAPPER_ABI, deployer);

  // ─── Step 0: check current state ───────────────────────────────────
  let alreadyWrapped = false;
  try {
    alreadyWrapped = await nameWrapper.isWrapped(parentNode);
  } catch {}
  console.log(`\n  artid.eth wrapped?  ${alreadyWrapped}`);

  if (alreadyWrapped) {
    // Check fuses
    const [wrappedOwner, fuses, expiry] = await nameWrapper.getData(tokenId);
    console.log(`  wrapped owner:      ${wrappedOwner}`);
    console.log(`  current fuses:      ${fuses}`);
    console.log(`  expiry:             ${new Date(Number(expiry) * 1000).toISOString()}`);
    if (wrappedOwner.toLowerCase() !== deployer.address.toLowerCase()) {
      throw new Error(`Wrapped owner ${wrappedOwner} != deployer ${deployer.address}`);
    }
    if ((Number(fuses) & CANNOT_UNWRAP) === 0) {
      throw new Error("artid.eth is wrapped but CANNOT_UNWRAP not burned. Burn it manually first (irreversible).");
    }
    console.log(`  ✓ already wrapped + CANNOT_UNWRAP burned — skipping wrap`);
  } else {
    // Verify deployer owns the .eth NFT in BaseRegistrar
    let baseOwner;
    try {
      baseOwner = await baseRegistrar.ownerOf(tokenId);
    } catch (e) {
      throw new Error(`BaseRegistrar.ownerOf(artid) reverted — does the name exist?`);
    }
    if (baseOwner.toLowerCase() !== deployer.address.toLowerCase()) {
      throw new Error(`BaseRegistrar owner of artid.eth is ${baseOwner}, not deployer ${deployer.address}`);
    }
    console.log(`  ✓ deployer owns artid.eth in BaseRegistrar`);

    // ─── Step 1: approve NameWrapper on BaseRegistrar ────────────────
    const alreadyApproved = await baseRegistrar.isApprovedForAll(deployer.address, A.nameWrapper);
    if (!alreadyApproved) {
      await step("BaseRegistrar.setApprovalForAll(NameWrapper, true)", async () => {
        const tx = await baseRegistrar.setApprovalForAll(A.nameWrapper, true);
        console.log(`  tx: ${tx.hash}`);
        await tx.wait();
      });
    } else {
      console.log(`  ✓ NameWrapper already approved on BaseRegistrar — skipping`);
    }

    // ─── Step 2: wrap + burn CANNOT_UNWRAP ──────────────────────────
    await step(`NameWrapper.wrapETH2LD("artid", deployer, CANNOT_UNWRAP, PublicResolver)`, async () => {
      console.log(`  ⚠️  This BURNS CANNOT_UNWRAP — artid.eth can never be unwrapped again.`);
      const tx = await nameWrapper.wrapETH2LD("artid", deployer.address, CANNOT_UNWRAP, A.publicResolver);
      console.log(`  tx: ${tx.hash}`);
      await tx.wait();
    });
  }

  // ─── Step 3: deploy ArtIDRegistrar ──────────────────────────────────
  const Registrar = await ethers.getContractFactory("ArtIDRegistrar");
  const registrar = await step("Deploy ArtIDRegistrar", async () => {
    const c = await Registrar.deploy(
      parentNode,
      A.nameWrapper,
      A.publicResolver,
      treasury,
      PLATFORM_FEE,
      PRICE_PER_YEAR,
      deployer.address
    );
    await c.waitForDeployment();
    const a = await c.getAddress();
    console.log(`  ArtIDRegistrar: ${a}`);
    return c;
  });
  const registrarAddr = await registrar.getAddress();

  // ─── Step 4: deploy ArtIDForwarder ──────────────────────────────────
  const Forwarder = await ethers.getContractFactory("ArtIDForwarder");
  const forwarder = await step("Deploy ArtIDForwarder", async () => {
    const c = await Forwarder.deploy(registrarAddr, deployer.address);
    await c.waitForDeployment();
    const a = await c.getAddress();
    console.log(`  ArtIDForwarder: ${a}`);
    return c;
  });
  const forwarderAddr = await forwarder.getAddress();

  // ─── Step 5: authorize forwarder on registrar ───────────────────────
  await step("ArtIDRegistrar.setForwarder(forwarder, true)", async () => {
    const tx = await registrar.setForwarder(forwarderAddr, true);
    console.log(`  tx: ${tx.hash}`);
    await tx.wait();
  });

  // ─── Step 6: approve registrar on NameWrapper ───────────────────────
  await step("NameWrapper.setApprovalForAll(ArtIDRegistrar, true)", async () => {
    const tx = await nameWrapper.setApprovalForAll(registrarAddr, true);
    console.log(`  tx: ${tx.hash}`);
    await tx.wait();
  });

  // ─── Done ───────────────────────────────────────────────────────────
  const finalBalance = await ethers.provider.getBalance(deployer.address);
  const spent = balance - finalBalance;

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  ✓ DEPLOYED");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`  Spent:           ${ethers.formatEther(spent)} ETH`);
  console.log(`  Final balance:   ${ethers.formatEther(finalBalance)} ETH`);
  console.log(`\n  ArtIDRegistrar:  ${registrarAddr}`);
  console.log(`  ArtIDForwarder:  ${forwarderAddr}`);
  console.log(`  parent node:     ${parentNode}`);
  console.log(`\n  Add to frontend/.env:`);
  console.log(`    NEXT_PUBLIC_REGISTRAR_ADDRESS=${registrarAddr}`);
  console.log(`    NEXT_PUBLIC_FORWARDER_ADDRESS=${forwarderAddr}`);
  console.log(`    NEXT_PUBLIC_ARTID_PARENT_NODE=${parentNode}`);
  console.log(`    NEXT_PUBLIC_CHAIN_ID=${A.chainId}`);
  console.log(`\n  Verify on Etherscan:`);
  console.log(`    npx hardhat verify --network ${net} ${registrarAddr} \\`);
  console.log(`      "${parentNode}" "${A.nameWrapper}" "${A.publicResolver}" \\`);
  console.log(`      "${treasury}" "${PLATFORM_FEE}" "${PRICE_PER_YEAR}" "${deployer.address}"`);
  console.log(`    npx hardhat verify --network ${net} ${forwarderAddr} \\`);
  console.log(`      "${registrarAddr}" "${deployer.address}"`);
  console.log("══════════════════════════════════════════════════════════════\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
