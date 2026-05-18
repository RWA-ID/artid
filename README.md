# ArtID — ENS Museum Passports for NFTs

> **A private museum for every masterpiece.**
> Mint a permanent ENS subdomain under `artid.eth` for any NFT you own — paired with a hand-crafted, IPFS-hosted gallery site. Charcoal walls, gilded frames, hushed footsteps. Provenance you can visit.

Live on **Ethereum mainnet**. Frontend ships to IPFS.

---

## What it is

An NFT lives in a dashboard built for traders. ArtID gives the work a real address, a real room, and a real record:

- **One subname per piece** under `artid.eth` (e.g. `pudgypenguin-77.artid.eth`)
- **Generated museum site** with the NFT in a gilded frame, its traits as a catalog, 5 silhouette visitors, position-aware camera flashes
- **Pinned to IPFS**, contenthash set on the ENS public resolver
- **Wrapped subname token** transferred to the holder with `PARENT_CANNOT_CONTROL` burned — the parent (this contract) cannot revoke or modify it
- **Renewals work via `extendExpiry`** — the holder can renew themselves, anyone can pay to extend on their behalf

The collector owns the gallery. The artist earns a share of every mint. The platform takes a fixed fee.

---

## Artist integration

> **For NFT collection owners.** Earn from every museum minted under your contract — automatic, on-chain, no portal or signer to maintain.

The forwarder reads your payout terms at mint time and routes part of every transaction to your treasury. You set the terms once and update them whenever you want. Collectors mint as normal — through your embed *or* anywhere else on ArtID — and your share is paid in the same transaction.

### How payment splits

When a collector pays to mint a museum for one of your NFTs:

```
                                  ┌─→  Platform fee   →  ArtID treasury (0.0075 ETH fixed)
collector pays total  ──→ forwarder ─→  Artist fee    →  your treasury  (you choose, max 0.05 ETH)
                                  └─→  Registration   →  ENS DAO        (0.008 ETH per year donated)
```

All three legs settle atomically. If your treasury reverts, the whole tx reverts — collectors are never charged for a broken treasury, and you never miss a payment.

### Three steps to integrate

**1. Verify ownership** — visit [artid.eth.link/integrate](https://artid.eth.link/integrate), connect the wallet that owns your collection contract. The page reads `Ownable.owner()` or `AccessControl.hasRole(DEFAULT_ADMIN_ROLE, you)` — no gas, no signature.

**2. Set terms on-chain** — one transaction to `ArtIDForwarder.setArtistTerms(collection, treasury, fee)`:

```solidity
forwarder.setArtistTerms(
  0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D,  // your collection contract
  0xYourTreasury,                                // where the fee lands
  0.0025 ether                                   // per-mint fee (max 0.05)
);
```

Update or clear anytime by calling `setArtistTerms` again or `clearArtistTerms(collection)`. The forwarder always reads the latest values on every mint.

**3. Embed the widget** — drop a script tag (or React component) into your collection's site so visitors can mint a passport for any NFT they own from your collection.

### Embedding the widget

**Vanilla HTML** — script tag from the CDN:

```html
<script src="https://artid.eth.link/widget.js"
  data-collection="0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D"
  defer></script>
```

Drop that anywhere on your page and a gilded "Mint Museum Passport" button renders inline. Click → modal with the full mint flow.

Or place a positioned slot with the placeholder div:

```html
<div data-artid-widget data-collection="0xBC4..."></div>
```

**React** — install [`@artidv1/react`](https://www.npmjs.com/package/@artidv1/react):

```bash
npm i @artidv1/react
```

```tsx
import { ArtIDWidget } from "@artidv1/react";

export function CollectionPage() {
  return (
    <ArtIDWidget
      collection="0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D"
      onRegistered={(e) => console.log("Museum minted:", e.subdomain, e.txHash)}
    />
  );
}
```

**Imperative** — `useArtID()` hook if you want your own button:

```tsx
import { useArtID } from "@artidv1/react";

const { open } = useArtID();
<button onClick={() => open({ collection: "0xBC4..." })}>Open ArtID</button>;
```

### Widget configuration

| Attribute / prop | Required | Description |
|---|---|---|
| `data-collection` / `collection` | yes | Your NFT collection contract address |
| `data-token-id` / `tokenId` | no | Pre-select a specific token; omit to open the visitor's gallery filtered to your collection |
| `data-label` / `label` | no | Button text (default: "Mint Museum Passport") |
| `data-host` / `host` | no | Override the dApp host (default: `https://artid.eth.link`) |

### Listening to mints

Both packages dispatch a `window` event when a museum is registered:

```js
window.addEventListener("artid:registered", (e) => {
  // e.detail = { subdomain, slug, txHash, cid }
  trackEvent("museum_minted", e.detail);
});
```

In React, the same data is delivered through `onRegistered`.

### Self-hosting the script

If you'd rather not depend on `artid.eth.link`, the widget bundle is published at [`@artidv1/widget`](https://www.npmjs.com/package/@artidv1/widget) — pull `dist/widget.js` (~6 KB minified, zero dependencies) and serve it from your own CDN. The modal still iframes the live ArtID dApp, so the mint flow stays canonical.

### Updating or revoking terms

From the same wallet that originally set them:

```solidity
// Update — same function, new values
forwarder.setArtistTerms(collection, newTreasury, newFee);

// Revoke — collectors can still mint, just no artist payout
forwarder.clearArtistTerms(collection);
```

No re-deployment, no signature re-issuance, no embed code change. The widget reads the chain on every mint.

---

## Live mainnet contracts

| Contract | Address |
|----------|---------|
| ArtIDRegistrar | [`0x61bee75562230D1BBDAeD5D95a4f4D200B19CFdc`](https://etherscan.io/address/0x61bee75562230D1BBDAeD5D95a4f4D200B19CFdc#code) |
| ArtIDForwarder | [`0xb5B5BDA936d76a6DD47993A7eC347b5B99606e64`](https://etherscan.io/address/0xb5B5BDA936d76a6DD47993A7eC347b5B99606e64#code) |
| ENS NameWrapper | `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401` |
| PublicResolver | `0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63` |
| Parent node `artid.eth` | `0x7792657109490b637ca89e1920079e37bed31d55838ae7641747ecc9474fcd3b` |

Both contracts are verified on Etherscan and on Sourcify.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Collector                                 │
│                                  │                                     │
│                                  ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Next.js dApp (artid.eth)                                         │  │
│  │   /            ── high-end gallery landing                       │  │
│  │   /dashboard   ── lists wallet NFTs (OpenSea v2)                 │  │
│  │   /create/...  ── picks subdomain, mints                         │  │
│  │   /museums     ── lists & renews holder's passports              │  │
│  │   /integrate   ── artist sets payout terms                       │  │
│  │   /api/*       ── server-side proxies: OpenSea, Pinata, slug     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                  │                                     │
│  forwarder.register(label, years, nft, tokenId, contenthash) ↓ ETH    │
└──────────────────────────────────┼─────────────────────────────────────┘
                                   ▼
   ┌─────────────────────────────────────────────────────────┐
   │              ArtIDForwarder (on-chain registry)         │
   │   reads artistTerms[nft] → splits ETH on the fly        │
   │   artist gets fee → registrar gets registration cost    │
   └─────────────────────────────────────────────────────────┘
                                   ▼
   ┌─────────────────────────────────────────────────────────┐
   │              ArtIDRegistrar (the parent operator)       │
   │   1. setSubnodeRecord(registrar, fuses=0)               │
   │   2. resolver.setContenthash(node, ipfsCID)             │
   │   3. setSubnodeOwner(user, PCC|CANNOT_UNWRAP|CAN_EXTEND)│
   │   → user receives wrapped subname; parent loses control │
   └─────────────────────────────────────────────────────────┘
                                   ▼
                          ENS NameWrapper
```

### Key locked decisions

| | |
|---|---|
| **Subdomain naming** | Fully automatic — `{collection-slug}-{tokenId}`, falls back to slugified name, falls back to hash. No user editing. |
| **Subnode fuses** | `PARENT_CANNOT_CONTROL | CANNOT_UNWRAP | CAN_EXTEND_EXPIRY` — holder owns absolutely, only `extendExpiry` remains callable by the registrar. |
| **Artist onboarding** | **On-chain**, no off-chain signer. Artist calls `forwarder.setArtistTerms(collection, treasury, fee)`; forwarder verifies via `Ownable.owner()` or `AccessControl.hasRole(DEFAULT_ADMIN_ROLE)`. Can be updated or cleared at any time. |
| **Artist fee cap** | 0.05 ETH per mint, owner-adjustable. |
| **Renewals** | `pricePerYear * years` only — no platform fee. Anyone can renew anyone's name (standard ENS pattern). |
| **Parent name** | `artid.eth` is wrapped with `CANNOT_UNWRAP` burned — irreversibly committed to this contract architecture. |

---

## Repository layout

```
artid-eth/
├── CLAUDE.md                      ← original implementation spec
├── README.md                      ← you are here
├── contracts/
│   ├── contracts/                 ← Solidity sources
│   │   ├── ArtIDRegistrar.sol
│   │   ├── ArtIDForwarder.sol
│   │   └── Mocks.sol
│   ├── test/Forwarder.t.js        ← 36 tests, all passing
│   ├── scripts/
│   │   ├── setup-and-deploy.js    ← wrap + burn + deploy + approve
│   │   ├── resume-deploy.js       ← recovery script
│   │   └── deploy.js              ← contracts-only deploy
│   ├── hardhat.config.js
│   └── package.json
└── frontend/
    ├── lib/slug.{ts,test.ts}      ← 16 vitest tests
    ├── museum-template/           ← the per-NFT static site (HTML+CSS+JS)
    ├── src/
    │   ├── app/                   ← Next.js 14 App Router
    │   │   ├── page.tsx           ← landing
    │   │   ├── dashboard/
    │   │   ├── create/[contract]/[tokenId]/
    │   │   ├── integrate/         ← artist on-chain setArtistTerms
    │   │   ├── museums/
    │   │   └── api/{nfts,slug,generate,pin,preview}/
    │   ├── components/{Providers,SiteNav}.tsx
    │   └── lib/{contracts,wagmi,slug}.ts
    └── package.json
```

---

## Running locally

### Prereqs

- Node 18+
- An Alchemy or Infura mainnet RPC URL
- An OpenSea API key (server-side, never exposed to client)
- A Pinata JWT (server-side)
- A WalletConnect / Reown project ID (`https://cloud.reown.com`)
- A wallet with mainnet ETH if you want to actually mint

### Frontend

```bash
cd frontend
cp .env.example .env       # fill in the values
npm install
npm run dev                # http://localhost:3000
npm test                   # vitest, slug suite (16 tests)
npm run build              # production build
```

### Contracts

```bash
cd contracts
cp .env.example .env       # DEPLOYER_PRIVATE_KEY, TREASURY_ADDRESS, RPCs, ETHERSCAN_API_KEY
npm install
npx hardhat compile
npx hardhat test           # 36 tests
```

---

## Deploy & ENS setup (mainnet)

This dApp depends on `artid.eth` being **wrapped** with `CANNOT_UNWRAP` burned. The script `scripts/setup-and-deploy.js` does the whole sequence atomically — only run it from the wallet that owns `artid.eth`.

```bash
npx hardhat run scripts/setup-and-deploy.js --network mainnet
```

Sequence:

1. `BaseRegistrar.setApprovalForAll(NameWrapper, true)` — lets NameWrapper take custody
2. `NameWrapper.wrapETH2LD("artid", you, CANNOT_UNWRAP=1, PublicResolver)` — **wraps + burns the fuse, irreversibly**
3. Deploys `ArtIDRegistrar` with platform fee, price/year, treasury, parent node
4. Deploys `ArtIDForwarder` pointing at the registrar
5. `registrar.setForwarder(forwarder, true)`
6. `NameWrapper.setApprovalForAll(registrar, true)` — final approval so the registrar can mint subnames

Etherscan verification:

```bash
npx hardhat verify --network mainnet <REGISTRAR_ADDR> \
  "<PARENT_NODE>" "<NAME_WRAPPER>" "<PUBLIC_RESOLVER>" \
  "<TREASURY>" "<PLATFORM_FEE_WEI>" "<PRICE_PER_YEAR_WEI>" "<OWNER>"

npx hardhat verify --network mainnet <FORWARDER_ADDR> \
  "<REGISTRAR_ADDR>" "<OWNER>"
```

---

## Contracts API surface

### `ArtIDRegistrar`

```solidity
function register(
    string label, uint64 years, address owner,
    address nftContract, uint256 tokenId, bytes contenthash
) external payable returns (bytes32 node);

function renew(string label, uint64 years) external payable;

function priceFor(uint64 years) external view returns (uint256);   // platformFee + pricePerYear*years
function isAvailable(string label) external view returns (bool);

// Admin (owner-only)
function setPlatformFee(uint256), setPricePerYear(uint256), setTreasury(address payable);
function setForwarder(address, bool);
function pause(), unpause();
```

Constants: `SUBNODE_FUSES = PCC | CANNOT_UNWRAP | CAN_EXTEND_EXPIRY`, `MAX_YEARS = 10`.

### `ArtIDForwarder`

```solidity
// Single entry point for collectors
function register(
    string label, uint64 years,
    address nftContract, uint256 tokenId, bytes contenthash
) external payable returns (bytes32 node);

// Single entry point for artists / collection admins
function setArtistTerms(address collection, address payable treasury, uint256 fee) external;
function clearArtistTerms(address collection) external;

// Views
function getArtistTerms(address collection) external view returns (address, uint256, bool);
function totalCost(address nftContract, uint64 years) external view returns (uint256);
```

Artist auth is on-chain: forwarder calls `Ownable.owner()` → `AccessControl.hasRole(DEFAULT_ADMIN_ROLE, msg.sender)` and accepts whichever succeeds. No off-chain signer key.

---

## Subdomain generator

`frontend/lib/slug.ts` is pure and deterministic:

1. `{collection-slug}-{tokenId}` if both fit in 32 chars
2. Otherwise `slugify(name)` (NFKD, strip diacritics, ASCII-only) if length 3–28
3. Otherwise `nft-{keccak256(contract,tokenId)[0:6]}`

Collisions append `-2`, `-3`, ... via `findAvailableSlug` which queries `registrar.isAvailable`.

16 vitest tests cover BAYC, CryptoPunks, accents, emoji, edge cases.

---

## Testing

```bash
cd contracts && npx hardhat test     # 36 tests
cd frontend  && npm test             # 16 tests
```

What's covered for the contracts:
- Deployment + initial state, fuse constants
- Direct mint via forwarder (with and without artist terms)
- Artist onboarding via `Ownable.owner()`, `AccessControl.hasRole`, opaque collection rejection
- Fee cap, zero treasury, update/clear/owner-emergency-clear
- Atomic revert if artist treasury rejects ETH
- Label validation (uppercase, underscore, leading/trailing hyphen, empty, >32 chars)
- Years bounds (0, 11)
- Insufficient payment, overpayment refund
- Pause/unpause
- Authorization (non-forwarder cannot mint for another address)
- Renewal extends expiry by exactly `years*365d`, costs only `pricePerYear*years`, calls `extendExpiry`

---

## Tech stack

**Contracts:** Solidity 0.8.24 · OpenZeppelin v5 · Hardhat · viaIR + cancun (required — OZ v5 uses `mcopy`, register hits stack-too-deep without viaIR)

**Frontend:** Next.js 14 (App Router) · TypeScript · TailwindCSS · wagmi v2 · viem · Reown AppKit · framer-motion · vitest

**Off-chain services:** OpenSea v2 (NFT metadata), Pinata (IPFS pinning)

---

## License

MIT.
