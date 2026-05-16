const { expect } = require("chai");
const { ethers } = require("hardhat");

const PARENT_NODE = ethers.namehash("artid.eth");
const PLATFORM_FEE = ethers.parseEther("0.0075");
const PRICE_PER_YEAR = ethers.parseEther("0.008");
const DUMMY_CID = "0xe301017012209abc";
const PCC = 1 << 16;
const CANNOT_UNWRAP = 1;
const CAN_EXTEND_EXPIRY = 1 << 18;
const EXPECTED_FUSES = PCC | CANNOT_UNWRAP | CAN_EXTEND_EXPIRY;

async function deployAll() {
  const [deployer, treasury, user, artist, otherArtist, other] = await ethers.getSigners();

  const NameWrapper = await ethers.getContractFactory("MockNameWrapper");
  const nameWrapper = await NameWrapper.deploy();

  const Resolver = await ethers.getContractFactory("MockPublicResolver");
  const resolver = await Resolver.deploy();

  const Registrar = await ethers.getContractFactory("ArtIDRegistrar");
  const registrar = await Registrar.deploy(
    PARENT_NODE,
    await nameWrapper.getAddress(),
    await resolver.getAddress(),
    treasury.address,
    PLATFORM_FEE,
    PRICE_PER_YEAR,
    deployer.address
  );

  const Forwarder = await ethers.getContractFactory("ArtIDForwarder");
  const forwarder = await Forwarder.deploy(await registrar.getAddress(), deployer.address);

  await registrar.connect(deployer).setForwarder(await forwarder.getAddress(), true);

  const Ownable = await ethers.getContractFactory("MockOwnableCollection");
  const ownableNft = await Ownable.deploy(artist.address);

  const AccessControl = await ethers.getContractFactory("MockAccessControlCollection");
  const acNft = await AccessControl.deploy(artist.address);

  const Opaque = await ethers.getContractFactory("MockOpaqueCollection");
  const opaqueNft = await Opaque.deploy();

  const Rejecting = await ethers.getContractFactory("RejectingRecipient");
  const rejecting = await Rejecting.deploy();

  return {
    deployer, treasury, user, artist, otherArtist, other,
    nameWrapper, resolver, registrar, forwarder,
    ownableNft, acNft, opaqueNft, rejecting,
  };
}

describe("ArtID — on-chain artist registry, locked subnames", function () {
  describe("Deployment", function () {
    it("initializes with expected state", async function () {
      const { registrar, forwarder, treasury } = await deployAll();
      expect(await registrar.PARENT_NODE()).to.equal(PARENT_NODE);
      expect(await registrar.platformFee()).to.equal(PLATFORM_FEE);
      expect(await registrar.pricePerYear()).to.equal(PRICE_PER_YEAR);
      expect(await registrar.treasury()).to.equal(treasury.address);
      expect(await registrar.authorizedForwarders(await forwarder.getAddress())).to.equal(true);
      expect(await registrar.SUBNODE_FUSES()).to.equal(EXPECTED_FUSES);
      expect(await forwarder.maxArtistFee()).to.equal(ethers.parseEther("0.05"));
    });
  });

  describe("Registration without artist terms", function () {
    it("mints to user, treasury collects full price, fuses are burned on subname", async function () {
      const { forwarder, registrar, treasury, user, nameWrapper, ownableNft } = await deployAll();
      const price = await registrar.priceFor(1);
      const before = await ethers.provider.getBalance(treasury.address);

      await expect(
        forwarder.connect(user).register(
          "bayc-1", 1, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price }
        )
      ).to.emit(registrar, "Registered");

      expect(await ethers.provider.getBalance(treasury.address) - before).to.equal(price);

      const node = ethers.solidityPackedKeccak256(
        ["bytes32", "bytes32"],
        [PARENT_NODE, ethers.keccak256(ethers.toUtf8Bytes("bayc-1"))]
      );
      expect(await nameWrapper.owners(node)).to.equal(user.address);
      expect(await nameWrapper.fuses(node)).to.equal(EXPECTED_FUSES);
    });

    it("calls setSubnodeRecord(registrar) then setSubnodeOwner(user) in order", async function () {
      const { forwarder, registrar, user, nameWrapper, ownableNft } = await deployAll();
      const price = await registrar.priceFor(1);
      const tx = await forwarder.connect(user).register(
        "bayc-2", 1, await ownableNft.getAddress(), 2, DUMMY_CID, { value: price }
      );
      const rcpt = await tx.wait();
      const wrapperAddr = (await nameWrapper.getAddress()).toLowerCase();
      const parsed = rcpt.logs
        .filter(l => l.address.toLowerCase() === wrapperAddr)
        .map(l => nameWrapper.interface.parseLog(l))
        .filter(Boolean);
      expect(parsed[0].name).to.equal("SubnodeRecord");
      expect(parsed[0].args.owner).to.equal(await registrar.getAddress());
      expect(parsed[1].name).to.equal("SubnodeOwner");
      expect(parsed[1].args.owner).to.equal(user.address);
      expect(parsed[1].args.fuses).to.equal(EXPECTED_FUSES);
    });

    it("refunds overpayment", async function () {
      const { forwarder, registrar, user, ownableNft } = await deployAll();
      const price = await registrar.priceFor(1);
      const overpay = ethers.parseEther("1");
      const before = await ethers.provider.getBalance(user.address);
      const tx = await forwarder.connect(user).register(
        "refundme", 1, await ownableNft.getAddress(), 3, DUMMY_CID, { value: price + overpay }
      );
      const rcpt = await tx.wait();
      const gas = rcpt.gasUsed * rcpt.gasPrice;
      const after = await ethers.provider.getBalance(user.address);
      expect(before - after).to.equal(price + gas);
    });

    it("reverts InsufficientPayment when underpaid", async function () {
      const { forwarder, registrar, user, ownableNft } = await deployAll();
      const price = await registrar.priceFor(1);
      await expect(
        forwarder.connect(user).register("short", 1, await ownableNft.getAddress(), 4, DUMMY_CID, { value: price - 1n })
      ).to.be.revertedWithCustomError(forwarder, "InsufficientPayment")
       .withArgs(price, price - 1n);
    });
  });

  describe("Artist onboarding", function () {
    it("Ownable collection owner can set terms", async function () {
      const { forwarder, artist, ownableNft } = await deployAll();
      const fee = ethers.parseEther("0.0025");
      await expect(
        forwarder.connect(artist).setArtistTerms(await ownableNft.getAddress(), artist.address, fee)
      ).to.emit(forwarder, "ArtistTermsSet");
      const [treasury, storedFee, active] = await forwarder.getArtistTerms(await ownableNft.getAddress());
      expect(treasury).to.equal(artist.address);
      expect(storedFee).to.equal(fee);
      expect(active).to.equal(true);
    });

    it("AccessControl admin can set terms", async function () {
      const { forwarder, artist, acNft } = await deployAll();
      const fee = ethers.parseEther("0.001");
      await forwarder.connect(artist).setArtistTerms(await acNft.getAddress(), artist.address, fee);
      const [, storedFee, active] = await forwarder.getArtistTerms(await acNft.getAddress());
      expect(storedFee).to.equal(fee);
      expect(active).to.equal(true);
    });

    it("non-owner cannot set terms on Ownable collection", async function () {
      const { forwarder, other, ownableNft } = await deployAll();
      await expect(
        forwarder.connect(other).setArtistTerms(await ownableNft.getAddress(), other.address, ethers.parseEther("0.001"))
      ).to.be.revertedWithCustomError(forwarder, "NotCollectionOwner");
    });

    it("opaque collection (no owner/role) cannot be onboarded", async function () {
      const { forwarder, artist, opaqueNft } = await deployAll();
      await expect(
        forwarder.connect(artist).setArtistTerms(await opaqueNft.getAddress(), artist.address, 0)
      ).to.be.revertedWithCustomError(forwarder, "NotCollectionOwner");
    });

    it("rejects fee > maxArtistFee", async function () {
      const { forwarder, artist, ownableNft } = await deployAll();
      await expect(
        forwarder.connect(artist).setArtistTerms(await ownableNft.getAddress(), artist.address, ethers.parseEther("0.06"))
      ).to.be.revertedWithCustomError(forwarder, "ArtistFeeTooHigh");
    });

    it("rejects zero treasury", async function () {
      const { forwarder, artist, ownableNft } = await deployAll();
      await expect(
        forwarder.connect(artist).setArtistTerms(await ownableNft.getAddress(), ethers.ZeroAddress, 0)
      ).to.be.revertedWithCustomError(forwarder, "ZeroAddress");
    });

    it("artist can update their own terms", async function () {
      const { forwarder, artist, ownableNft } = await deployAll();
      await forwarder.connect(artist).setArtistTerms(await ownableNft.getAddress(), artist.address, 100);
      await forwarder.connect(artist).setArtistTerms(await ownableNft.getAddress(), artist.address, 200);
      const [, fee] = await forwarder.getArtistTerms(await ownableNft.getAddress());
      expect(fee).to.equal(200);
    });

    it("artist can clear their own terms", async function () {
      const { forwarder, artist, ownableNft } = await deployAll();
      await forwarder.connect(artist).setArtistTerms(await ownableNft.getAddress(), artist.address, ethers.parseEther("0.001"));
      await expect(
        forwarder.connect(artist).clearArtistTerms(await ownableNft.getAddress())
      ).to.emit(forwarder, "ArtistTermsCleared");
      const [, , active] = await forwarder.getArtistTerms(await ownableNft.getAddress());
      expect(active).to.equal(false);
    });

    it("contract owner can emergency-clear bad terms", async function () {
      const { forwarder, deployer, artist, ownableNft } = await deployAll();
      await forwarder.connect(artist).setArtistTerms(await ownableNft.getAddress(), artist.address, ethers.parseEther("0.001"));
      await expect(
        forwarder.connect(deployer).clearArtistTerms(await ownableNft.getAddress())
      ).to.emit(forwarder, "ArtistTermsCleared");
    });

    it("random user cannot clear terms", async function () {
      const { forwarder, artist, other, ownableNft } = await deployAll();
      await forwarder.connect(artist).setArtistTerms(await ownableNft.getAddress(), artist.address, 100);
      await expect(
        forwarder.connect(other).clearArtistTerms(await ownableNft.getAddress())
      ).to.be.revertedWithCustomError(forwarder, "NotCollectionOwner");
    });
  });

  describe("Registration with artist terms", function () {
    it("pays artist exactly fee, treasury exactly priceFor(years)", async function () {
      const { forwarder, registrar, user, artist, treasury, ownableNft } = await deployAll();
      const fee = ethers.parseEther("0.0025");
      await forwarder.connect(artist).setArtistTerms(await ownableNft.getAddress(), artist.address, fee);

      const price = await registrar.priceFor(2);
      const total = price + fee;

      const artistBefore = await ethers.provider.getBalance(artist.address);
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await expect(
        forwarder.connect(user).register("art-1", 2, await ownableNft.getAddress(), 1, DUMMY_CID, { value: total })
      ).to.emit(forwarder, "ArtistPaid");

      expect(await ethers.provider.getBalance(artist.address) - artistBefore).to.equal(fee);
      expect(await ethers.provider.getBalance(treasury.address) - treasuryBefore).to.equal(price);
    });

    it("totalCost view returns base + fee when active, base alone otherwise", async function () {
      const { forwarder, registrar, artist, ownableNft, opaqueNft } = await deployAll();
      const fee = ethers.parseEther("0.003");
      const price1 = await registrar.priceFor(1);
      await forwarder.connect(artist).setArtistTerms(await ownableNft.getAddress(), artist.address, fee);
      expect(await forwarder.totalCost(await ownableNft.getAddress(), 1)).to.equal(price1 + fee);
      // Opaque collection isn't onboarded → only base cost
      expect(await forwarder.totalCost(await opaqueNft.getAddress(), 1)).to.equal(price1);
    });

    it("after clearArtistTerms, register stops paying artist", async function () {
      const { forwarder, registrar, user, artist, treasury, ownableNft } = await deployAll();
      const fee = ethers.parseEther("0.002");
      await forwarder.connect(artist).setArtistTerms(await ownableNft.getAddress(), artist.address, fee);
      await forwarder.connect(artist).clearArtistTerms(await ownableNft.getAddress());

      const price = await registrar.priceFor(1);
      const artistBefore = await ethers.provider.getBalance(artist.address);
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await forwarder.connect(user).register("clear", 1, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price });
      expect(await ethers.provider.getBalance(artist.address) - artistBefore).to.equal(0n);
      expect(await ethers.provider.getBalance(treasury.address) - treasuryBefore).to.equal(price);
    });

    it("refunds overpayment beyond price+fee", async function () {
      const { forwarder, registrar, user, artist, ownableNft } = await deployAll();
      const fee = ethers.parseEther("0.0025");
      await forwarder.connect(artist).setArtistTerms(await ownableNft.getAddress(), artist.address, fee);

      const price = await registrar.priceFor(1);
      const total = price + fee;
      const overpay = ethers.parseEther("0.5");
      const before = await ethers.provider.getBalance(user.address);
      const tx = await forwarder.connect(user).register(
        "art-3", 1, await ownableNft.getAddress(), 3, DUMMY_CID, { value: total + overpay }
      );
      const rcpt = await tx.wait();
      const gas = rcpt.gasUsed * rcpt.gasPrice;
      expect(before - await ethers.provider.getBalance(user.address)).to.equal(total + gas);
    });

    it("reverts atomically if artist treasury rejects ETH", async function () {
      const { forwarder, registrar, user, artist, rejecting, ownableNft } = await deployAll();
      const fee = ethers.parseEther("0.001");
      // Treasury is a contract that rejects payments
      await forwarder.connect(artist).setArtistTerms(await ownableNft.getAddress(), await rejecting.getAddress(), fee);
      const price = await registrar.priceFor(1);
      await expect(
        forwarder.connect(user).register("reject", 1, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price + fee })
      ).to.be.revertedWithCustomError(forwarder, "TransferFailed");
    });

    it("reverts InsufficientPayment when value < price + artistFee", async function () {
      const { forwarder, registrar, user, artist, ownableNft } = await deployAll();
      const fee = ethers.parseEther("0.002");
      await forwarder.connect(artist).setArtistTerms(await ownableNft.getAddress(), artist.address, fee);
      const price = await registrar.priceFor(1);
      await expect(
        forwarder.connect(user).register("under", 1, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price })
      ).to.be.revertedWithCustomError(forwarder, "InsufficientPayment")
       .withArgs(price + fee, price);
    });
  });

  describe("Label validation", function () {
    const cases = [
      ["UPPER", "Upper"],
      ["under_score", "under_score"],
      ["-leading", "-leading"],
      ["trailing-", "trailing-"],
      ["empty", ""],
    ];
    for (const [name, label] of cases) {
      it(`rejects ${name}`, async function () {
        const { forwarder, registrar, user, ownableNft } = await deployAll();
        const price = await registrar.priceFor(1);
        await expect(
          forwarder.connect(user).register(label, 1, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price })
        ).to.be.reverted;
      });
    }
    it("rejects > 32 chars", async function () {
      const { forwarder, registrar, user, ownableNft } = await deployAll();
      const long = "a".repeat(33);
      const price = await registrar.priceFor(1);
      await expect(
        forwarder.connect(user).register(long, 1, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price })
      ).to.be.revertedWithCustomError(registrar, "LabelTooLong");
    });
    it("accepts exactly 32 chars", async function () {
      const { forwarder, registrar, user, ownableNft } = await deployAll();
      const ok = "a".repeat(32);
      const price = await registrar.priceFor(1);
      await expect(
        forwarder.connect(user).register(ok, 1, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price })
      ).to.not.be.reverted;
    });
  });

  describe("Years validation", function () {
    it("rejects 0 years", async function () {
      const { forwarder, registrar, user, ownableNft } = await deployAll();
      await expect(
        forwarder.connect(user).register("zero", 0, await ownableNft.getAddress(), 1, DUMMY_CID, { value: PLATFORM_FEE })
      ).to.be.revertedWithCustomError(registrar, "YearsOutOfRange");
    });
    it("rejects 11 years", async function () {
      const { forwarder, registrar, user, ownableNft } = await deployAll();
      const price = await registrar.priceFor(11);
      await expect(
        forwarder.connect(user).register("eleven", 11, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price })
      ).to.be.revertedWithCustomError(registrar, "YearsOutOfRange");
    });
  });

  describe("Pause", function () {
    it("blocks register when paused; resumes on unpause", async function () {
      const { forwarder, registrar, deployer, user, ownableNft } = await deployAll();
      const price = await registrar.priceFor(1);
      await registrar.connect(deployer).pause();
      await expect(
        forwarder.connect(user).register("paused", 1, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price })
      ).to.be.reverted;
      await registrar.connect(deployer).unpause();
      await expect(
        forwarder.connect(user).register("paused", 1, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price })
      ).to.not.be.reverted;
    });
  });

  describe("Direct authorization on registrar", function () {
    it("non-forwarder caller registering with different _owner reverts", async function () {
      const { registrar, user, other, ownableNft } = await deployAll();
      const price = await registrar.priceFor(1);
      await expect(
        registrar.connect(user).register("unauth", 1, other.address, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price })
      ).to.be.revertedWithCustomError(registrar, "NotForwarderOrSelf");
    });
    it("user calling registrar directly with _owner == self succeeds", async function () {
      const { registrar, user, ownableNft } = await deployAll();
      const price = await registrar.priceFor(1);
      await expect(
        registrar.connect(user).register("self", 1, user.address, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price })
      ).to.not.be.reverted;
    });
  });

  describe("Renewal via extendExpiry", function () {
    it("extends expiry by years*365d, costs pricePerYear*years, calls extendExpiry", async function () {
      const { forwarder, registrar, user, treasury, nameWrapper, ownableNft } = await deployAll();
      const price = await registrar.priceFor(1);
      await forwarder.connect(user).register("renewme", 1, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price });

      const labelhash = ethers.keccak256(ethers.toUtf8Bytes("renewme"));
      const recBefore = await registrar.records(labelhash);
      const oldExpiry = recBefore.expiry;

      const renewCost = PRICE_PER_YEAR * 2n;
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      const tx = await registrar.connect(user).renew("renewme", 2, { value: renewCost });
      const rcpt = await tx.wait();
      await expect(tx).to.emit(registrar, "Renewed");

      // Verify extendExpiry was called on the wrapper
      const wrapperAddr = (await nameWrapper.getAddress()).toLowerCase();
      const extendLogs = rcpt.logs
        .filter(l => l.address.toLowerCase() === wrapperAddr)
        .map(l => nameWrapper.interface.parseLog(l))
        .filter(p => p && p.name === "ExpiryExtended");
      expect(extendLogs.length).to.equal(1);
      expect(extendLogs[0].args.labelhash).to.equal(labelhash);

      const recAfter = await registrar.records(labelhash);
      expect(recAfter.expiry - oldExpiry).to.equal(2n * 365n * 24n * 60n * 60n);
      expect(await ethers.provider.getBalance(treasury.address) - treasuryBefore).to.equal(renewCost);
    });
    it("can be called by anyone", async function () {
      const { forwarder, registrar, user, other, ownableNft } = await deployAll();
      const price = await registrar.priceFor(1);
      await forwarder.connect(user).register("anyone", 1, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price });
      await expect(
        registrar.connect(other).renew("anyone", 1, { value: PRICE_PER_YEAR })
      ).to.not.be.reverted;
    });
    it("reverts InsufficientPayment when underpaid", async function () {
      const { forwarder, registrar, user, ownableNft } = await deployAll();
      const price = await registrar.priceFor(1);
      await forwarder.connect(user).register("under", 1, await ownableNft.getAddress(), 1, DUMMY_CID, { value: price });
      await expect(
        registrar.connect(user).renew("under", 1, { value: PRICE_PER_YEAR - 1n })
      ).to.be.revertedWithCustomError(registrar, "InsufficientPayment");
    });
  });
});
