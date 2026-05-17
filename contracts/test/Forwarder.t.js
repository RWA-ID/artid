const { expect } = require("chai");
const { ethers } = require("hardhat");

const PARENT_NODE = ethers.namehash("artid.eth");
const PARENT_LABEL = "artid";
const DUMMY_CID = "0xe301017012209abc";
const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;
const PCC = 1 << 16;
const CANNOT_UNWRAP = 1;
const CAN_EXTEND_EXPIRY = 1 << 18;
const EXPECTED_FUSES = PCC | CANNOT_UNWRAP | CAN_EXTEND_EXPIRY;

// Mock ENS rate: ~0.002295 ETH/year ≈ $5 → ~73 wei/sec * year ≈ 0.002295 ETH
// Use 72744000 wei/sec → 1y = 72744000 * 31536000 ≈ 0.002294 ETH
const PRICE_PER_SECOND = 72744000n;

async function deployAll(initialParentExpiry) {
  const [deployer, user, artist, other] = await ethers.getSigners();

  const NameWrapper = await ethers.getContractFactory("MockNameWrapper");
  const nameWrapper = await NameWrapper.deploy();
  // Seed the parent expiry
  const now = BigInt((await ethers.provider.getBlock("latest")).timestamp);
  const startExpiry = initialParentExpiry ?? (now + SECONDS_PER_YEAR * 2n);
  await nameWrapper.setParentExpiry(PARENT_NODE, startExpiry);

  const Resolver = await ethers.getContractFactory("MockPublicResolver");
  const resolver = await Resolver.deploy();

  const Controller = await ethers.getContractFactory("MockController");
  const controller = await Controller.deploy(await nameWrapper.getAddress(), PARENT_NODE, PRICE_PER_SECOND);

  const Registrar = await ethers.getContractFactory("ArtIDRegistrar");
  const registrar = await Registrar.deploy(
    PARENT_NODE, PARENT_LABEL,
    await nameWrapper.getAddress(),
    await resolver.getAddress(),
    await controller.getAddress(),
    deployer.address
  );

  const Forwarder = await ethers.getContractFactory("ArtIDForwarder");
  const forwarder = await Forwarder.deploy(await registrar.getAddress(), deployer.address, 0, deployer.address);

  await registrar.connect(deployer).setForwarder(await forwarder.getAddress(), true);

  const Ownable = await ethers.getContractFactory("MockOwnableCollection");
  const nft = await Ownable.deploy(artist.address);

  return { deployer, user, artist, other, nameWrapper, resolver, controller, registrar, forwarder, nft, startExpiry };
}

describe("ArtID v3 — donation model", function () {
  describe("Deployment", function () {
    it("sets immutables + constants", async function () {
      const { registrar, forwarder, controller, nameWrapper, resolver } = await deployAll();
      expect(await registrar.PARENT_NODE()).to.equal(PARENT_NODE);
      expect(await registrar.PARENT_LABEL()).to.equal(PARENT_LABEL);
      expect(await registrar.NAME_WRAPPER()).to.equal(await nameWrapper.getAddress());
      expect(await registrar.PUBLIC_RESOLVER()).to.equal(await resolver.getAddress());
      expect(await registrar.CONTROLLER()).to.equal(await controller.getAddress());
      expect(await registrar.SUBNODE_FUSES()).to.equal(EXPECTED_FUSES);
      expect(await registrar.authorizedForwarders(await forwarder.getAddress())).to.equal(true);
    });

    it("donationPrice(0) is 0; donationPrice(N) reads controller", async function () {
      const { registrar } = await deployAll();
      expect(await registrar.donationPrice(0)).to.equal(0);
      const p1 = PRICE_PER_SECOND * SECONDS_PER_YEAR;
      expect(await registrar.donationPrice(1)).to.equal(p1);
      expect(await registrar.donationPrice(5)).to.equal(p1 * 5n);
    });
  });

  describe("Register without donation (years = 0)", function () {
    it("mints subname at parent expiry, sends no ETH to controller", async function () {
      const { forwarder, registrar, nameWrapper, controller, user, nft, startExpiry } = await deployAll();
      const ctrlBalBefore = await ethers.provider.getBalance(await controller.getAddress());
      const tx = await forwarder.connect(user).register(
        "free-mint", 0, await nft.getAddress(), 1, DUMMY_CID, { value: 0 }
      );
      await tx.wait();
      expect(await ethers.provider.getBalance(await controller.getAddress())).to.equal(ctrlBalBefore);

      const node = ethers.solidityPackedKeccak256(
        ["bytes32", "bytes32"],
        [PARENT_NODE, ethers.keccak256(ethers.toUtf8Bytes("free-mint"))]
      );
      expect(await nameWrapper.owners(node)).to.equal(user.address);
      expect(await nameWrapper.fuses(node)).to.equal(EXPECTED_FUSES);
      expect(await nameWrapper.expiries(node)).to.equal(startExpiry);
    });

    it("parent expiry does not change when years = 0", async function () {
      const { forwarder, nameWrapper, user, nft, startExpiry } = await deployAll();
      await forwarder.connect(user).register("nodonate", 0, await nft.getAddress(), 1, DUMMY_CID, { value: 0 });
      expect(await nameWrapper.expiries(PARENT_NODE)).to.equal(startExpiry);
    });
  });

  describe("Register with donation (years > 0)", function () {
    it("forwards correct ETH to controller, extends parent by N*365d", async function () {
      const { forwarder, registrar, nameWrapper, controller, user, nft, startExpiry } = await deployAll();
      const required = await registrar.donationPrice(2);
      const tx = await forwarder.connect(user).register(
        "donor", 2, await nft.getAddress(), 1, DUMMY_CID, { value: required }
      );
      await tx.wait();
      expect(await ethers.provider.getBalance(await controller.getAddress())).to.equal(required);
      expect(await nameWrapper.expiries(PARENT_NODE)).to.equal(startExpiry + SECONDS_PER_YEAR * 2n);
    });

    it("new subname inherits new parent expiry", async function () {
      const { forwarder, registrar, nameWrapper, user, nft, startExpiry } = await deployAll();
      const req = await registrar.donationPrice(3);
      await forwarder.connect(user).register("dn3", 3, await nft.getAddress(), 1, DUMMY_CID, { value: req });
      const node = ethers.solidityPackedKeccak256(
        ["bytes32","bytes32"],
        [PARENT_NODE, ethers.keccak256(ethers.toUtf8Bytes("dn3"))]
      );
      expect(await nameWrapper.expiries(node)).to.equal(startExpiry + SECONDS_PER_YEAR * 3n);
    });

    it("rejects donation > MAX_DONATE_YEARS (10)", async function () {
      const { forwarder, registrar, user, nft } = await deployAll();
      const req = await registrar.donationPrice(11); // pay for 11y so we get past the value check
      await expect(
        forwarder.connect(user).register("too-many", 11, await nft.getAddress(), 1, DUMMY_CID, { value: req })
      ).to.be.revertedWithCustomError(registrar, "YearsOutOfRange");
    });

    it("reverts InsufficientPayment when underpaid", async function () {
      const { forwarder, registrar, user, nft } = await deployAll();
      const req = await registrar.donationPrice(1);
      await expect(
        forwarder.connect(user).register("under", 1, await nft.getAddress(), 1, DUMMY_CID, { value: req - 1n })
      ).to.be.revertedWithCustomError(forwarder, "InsufficientPayment");
    });

    it("refunds overpayment to msg.sender", async function () {
      const { forwarder, registrar, user, nft } = await deployAll();
      const req = await registrar.donationPrice(1);
      const overpay = ethers.parseEther("0.1");
      const before = await ethers.provider.getBalance(user.address);
      const tx = await forwarder.connect(user).register("refund", 1, await nft.getAddress(), 1, DUMMY_CID, { value: req + overpay });
      const rcpt = await tx.wait();
      const gas = rcpt.gasUsed * rcpt.gasPrice;
      expect(before - await ethers.provider.getBalance(user.address)).to.equal(req + gas);
    });
  });

  describe("Batch sync — donations push every prior subname's expiry forward", function () {
    it("3 prior zero-donation mints all sync to new parent expiry when 4th donates", async function () {
      const { forwarder, registrar, nameWrapper, user, nft, startExpiry } = await deployAll();
      // First 3: no donation
      for (const lbl of ["a-one", "a-two", "a-three"]) {
        await forwarder.connect(user).register(lbl, 0, await nft.getAddress(), 1, DUMMY_CID, { value: 0 });
      }
      // All 3 should currently expire at startExpiry
      for (const lbl of ["a-one", "a-two", "a-three"]) {
        const n = ethers.solidityPackedKeccak256(
          ["bytes32","bytes32"], [PARENT_NODE, ethers.keccak256(ethers.toUtf8Bytes(lbl))]
        );
        expect(await nameWrapper.expiries(n)).to.equal(startExpiry);
      }
      // 4th donates 5y
      const req = await registrar.donationPrice(5);
      await forwarder.connect(user).register("donor", 5, await nft.getAddress(), 1, DUMMY_CID, { value: req });
      const newExpiry = startExpiry + SECONDS_PER_YEAR * 5n;
      // All 3 prior subnames must have synced
      for (const lbl of ["a-one", "a-two", "a-three"]) {
        const n = ethers.solidityPackedKeccak256(
          ["bytes32","bytes32"], [PARENT_NODE, ethers.keccak256(ethers.toUtf8Bytes(lbl))]
        );
        expect(await nameWrapper.expiries(n)).to.equal(newExpiry);
      }
    });
  });

  describe("Pure donate()", function () {
    it("extends parent and syncs all existing subnames; no new subname minted", async function () {
      const { registrar, forwarder, nameWrapper, user, other, nft, startExpiry } = await deployAll();
      // mint 2 free
      await forwarder.connect(user).register("d-1", 0, await nft.getAddress(), 1, DUMMY_CID, { value: 0 });
      await forwarder.connect(user).register("d-2", 0, await nft.getAddress(), 1, DUMMY_CID, { value: 0 });
      // donate
      const req = await registrar.donationPrice(2);
      await registrar.connect(other).donate(2, { value: req });
      const expected = startExpiry + SECONDS_PER_YEAR * 2n;
      for (const lbl of ["d-1", "d-2"]) {
        const n = ethers.solidityPackedKeccak256(
          ["bytes32","bytes32"], [PARENT_NODE, ethers.keccak256(ethers.toUtf8Bytes(lbl))]
        );
        expect(await nameWrapper.expiries(n)).to.equal(expected);
      }
      expect(await nameWrapper.expiries(PARENT_NODE)).to.equal(expected);
      expect(await registrar.totalSubnames()).to.equal(2);
    });

    it("rejects 0 years", async function () {
      const { registrar, user } = await deployAll();
      await expect(registrar.connect(user).donate(0, { value: 0 }))
        .to.be.revertedWithCustomError(registrar, "YearsOutOfRange");
    });
  });

  describe("Artist payouts (forwarder)", function () {
    it("artist gets fee, controller gets ENS price, both flow on same tx", async function () {
      const { forwarder, registrar, controller, user, artist, nft } = await deployAll();
      const fee = ethers.parseEther("0.001");
      await forwarder.connect(artist).setArtistTerms(await nft.getAddress(), artist.address, fee);
      const donation = await registrar.donationPrice(1);
      const total = donation + fee;

      const artistBefore = await ethers.provider.getBalance(artist.address);
      const ctrlBefore = await ethers.provider.getBalance(await controller.getAddress());

      await forwarder.connect(user).register("ar", 1, await nft.getAddress(), 1, DUMMY_CID, { value: total });

      expect(await ethers.provider.getBalance(artist.address) - artistBefore).to.equal(fee);
      expect(await ethers.provider.getBalance(await controller.getAddress()) - ctrlBefore).to.equal(donation);
    });

    it("totalCost matches actual required", async function () {
      const { forwarder, registrar, artist, nft } = await deployAll();
      const fee = ethers.parseEther("0.002");
      await forwarder.connect(artist).setArtistTerms(await nft.getAddress(), artist.address, fee);
      const expected = (await registrar.donationPrice(2)) + fee;
      expect(await forwarder.totalCost(await nft.getAddress(), 2)).to.equal(expected);
    });

    it("artist fee 0 when collection has no terms", async function () {
      const { forwarder, registrar, nft } = await deployAll();
      const expected = await registrar.donationPrice(1);
      expect(await forwarder.totalCost(await nft.getAddress(), 1)).to.equal(expected);
    });
  });

  describe("Label validation + pause + auth (regression)", function () {
    it("rejects invalid labels", async function () {
      const { forwarder, registrar, user, nft } = await deployAll();
      for (const bad of ["UPPER", "und_score", "-lead", "trail-", ""]) {
        await expect(
          forwarder.connect(user).register(bad, 0, await nft.getAddress(), 1, DUMMY_CID, { value: 0 })
        ).to.be.reverted;
      }
    });

    it("pause blocks register + donate", async function () {
      const { registrar, forwarder, deployer, user, nft } = await deployAll();
      await registrar.connect(deployer).pause();
      await expect(forwarder.connect(user).register("p", 0, await nft.getAddress(), 1, DUMMY_CID, { value: 0 })).to.be.reverted;
      const req = await registrar.donationPrice(1);
      await expect(registrar.connect(user).donate(1, { value: req })).to.be.reverted;
      await registrar.connect(deployer).unpause();
      await expect(forwarder.connect(user).register("p", 0, await nft.getAddress(), 1, DUMMY_CID, { value: 0 })).to.not.be.reverted;
    });

    it("direct registrar.register from non-forwarder for someone else reverts", async function () {
      const { registrar, user, other, nft } = await deployAll();
      await expect(
        registrar.connect(user).register("x", 0, other.address, await nft.getAddress(), 1, DUMMY_CID, { value: 0 })
      ).to.be.revertedWithCustomError(registrar, "NotForwarderOrSelf");
    });

    it("duplicate label rejected", async function () {
      const { forwarder, user, nft } = await deployAll();
      await forwarder.connect(user).register("dup", 0, await nft.getAddress(), 1, DUMMY_CID, { value: 0 });
      await expect(
        forwarder.connect(user).register("dup", 0, await nft.getAddress(), 1, DUMMY_CID, { value: 0 })
      ).to.be.reverted;
    });
  });

  describe("syncRange — paginated catch-up", function () {
    it("brings a tail of subnames forward to current parent expiry", async function () {
      const { registrar, forwarder, nameWrapper, deployer, user, nft, startExpiry } = await deployAll();
      // Constrain so we know which got auto-synced.
      await registrar.connect(deployer).setMaxSyncPerTx(0);
      // Mint 2 free
      await forwarder.connect(user).register("s-1", 0, await nft.getAddress(), 1, DUMMY_CID, { value: 0 });
      await forwarder.connect(user).register("s-2", 0, await nft.getAddress(), 1, DUMMY_CID, { value: 0 });
      // Donate 1y — but maxSyncPerTx=0 so neither was auto-synced
      const req = await registrar.donationPrice(1);
      await registrar.connect(user).donate(1, { value: req });
      const newExpiry = startExpiry + SECONDS_PER_YEAR;
      for (const lbl of ["s-1", "s-2"]) {
        const n = ethers.solidityPackedKeccak256(["bytes32","bytes32"], [PARENT_NODE, ethers.keccak256(ethers.toUtf8Bytes(lbl))]);
        expect(await nameWrapper.expiries(n)).to.equal(startExpiry); // still stale
      }
      // Catch them up manually
      await registrar.syncRange(0, 2);
      for (const lbl of ["s-1", "s-2"]) {
        const n = ethers.solidityPackedKeccak256(["bytes32","bytes32"], [PARENT_NODE, ethers.keccak256(ethers.toUtf8Bytes(lbl))]);
        expect(await nameWrapper.expiries(n)).to.equal(newExpiry);
      }
    });
  });
});
