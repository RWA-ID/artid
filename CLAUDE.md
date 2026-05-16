# ArtID.eth MVP — Implementation Spec

You're continuing an in-progress build of **artid.eth**, a dApp that lets NFT collectors mint personalized museum/passport websites as ENS subdomains under `artid.eth`, with IPFS-hosted static gallery sites. Architectural decisions are locked. Do not re-relitigate them.

## What already exists

```
artid-mvp/
├── contracts/
│   └── contracts/
│       ├── ArtIDRegistrar.sol      ✓ Compiles clean (5.40 KB deployed)
│       ├── ArtIDForwarder.sol      ✓ Compiles clean (4.86 KB deployed)
│       └── Mocks.sol               ✓ Test mocks (NameWrapper, Resolver, RejectingRecipient)
└── frontend/
    └── museum-template/
        ├── index.html              ✓ With {{PLACEHOLDER}} tokens
        ├── preview.html            ✓ Sample-data version, opens in browser
        ├── style.css               ✓ Charcoal walls, gilded gold frame, Cormorant Garamond display
        └── script.js               ✓ 5 visitor silhouettes, position-aware camera flashes, lightbox, traits-from-JSON
```

**Compiler settings that MUST match** (both for Hardhat and any downstream compilation):
- Solidity `0.8.24`
- Optimizer `{ enabled: true, runs: 200 }`
- **`viaIR: true`** (required — `register()` hits stack-too-deep without it)
- **`evmVersion: "cancun"`** (required — OpenZeppelin v5 uses `mcopy`)

**Museum template placeholders** (substitution targets, do not change names):
`{{NFT_NAME}}`, `{{NFT_DESCRIPTION}}`, `{{NFT_IMAGE_URL}}`, `{{COLLECTION_NAME}}`, `{{TOKEN_ID}}`, `{{BLOCKCHAIN}}`, `{{SUBDOMAIN}}`, `{{CONTRACT_ADDRESS}}`, `{{CONTRACT_ADDRESS_SHORT}}`, `{{OWNER_ADDRESS_SHORT}}`, `{{TOKEN_STANDARD}}`, `{{MINT_DATE}}`, `{{ARTID_MINT_YEAR}}`, `{{IPFS_CID_SHORT}}`, `{{TRAITS_JSON}}` (replaced inside `<script id="traits-data">`, value is a JSON array `[{trait_type, value, rarity?}]`).

## Locked architectural decisions

These are decided. Don't propose alternatives:

| Decision | Choice |
|---|---|
| Platform fee | **0.0075 ETH** fixed (configurable in registrar storage but seeded at deploy) |
| Price per year | **0.008 ETH/year** (configurable, seeded at deploy) |
| Max years | **10** (constant) |
| Subdomain generation | **Fully automatic and deterministic**, no user editing. Priority order: `{collection.slug}-{tokenId}` → slugified `name` → fallback `{collection_symbol}-{tokenId}`. Collisions append `-2`, `-3`, etc. Max 32 chars, `[a-z0-9-]` only, no leading/trailing hyphens. |
| Artist onboarding | **NOT a portal**. There's an `/integrate` page where artists connect wallet, the page **verifies on-chain that they own the collection** (via `Ownable.owner()`, falling back to deployer if no `Ownable`), then the platform signer (off-chain key) issues an **EIP-712 signature** attesting `(collection, artistTreasury, artistFee, expiry, nonce)`. Artist copies that signature into their widget config. |
| Forwarder pattern | `ArtIDForwarder.registerWithArtist()` verifies the signature on-chain, peels off artist fee, sends it directly to `artistTreasury`, forwards the rest to `ArtIDRegistrar.register()`. If no signature or invalid, falls back to `ArtIDForwarder.register()` — registration still succeeds, artist just earns nothing. |
| Widget rendering | **Modal/iframe** that runs the full create flow inline on the artist's site. NOT a redirect button. |
| Widget packages | **Two npm packages**: `@artid/widget` (vanilla JS / `<script>` tag) and `@artid/react` (React wrapper around it). |
| Museum visitor count | **5 visitors** (already configured in `script.js` `VISITORS` array) |
| Shutter audio | **Off** for v1. The hook exists commented out in `script.js`, leave it that way. |
| Frame style | **Gilded gold** for all collections in v1. Per-collection theming is a v2 concern. |

## What to build next, in order

### 1. Finish Hardhat test suite for the contracts

Set up Hardhat properly (this environment has network access, unlike my previous shell). The contracts already compile via `compile.js`, but proper Hardhat tests are what you actually want for ongoing development.

`hardhat.config.js`:
```js
require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "cancun"
    }
  },
  networks: { hardhat: { hardfork: "cancun" } }
};
```

Then in `test/Forwarder.t.js`, cover at minimum:

- **Deployment** — registrar + forwarder + mocks deploy with expected initial state; `setForwarder` authorizes the forwarder.
- **Direct registration** — `forwarder.register()` mints subdomain to `msg.sender`, treasury gets full price, NameWrapper sees the correct `setSubnodeRecord` then `setSubnodeOwner(user)` sequence.
- **Artist registration happy path** — Sign an `ArtistGrant` with the platform signer key via `wallet.signTypedData(domain, types, value)`. Domain must be `{ name: "ArtIDForwarder", version: "1", chainId, verifyingContract: forwarderAddr }`. Verify: artist gets exactly `artistFee`, treasury gets exactly `priceFor(years)`, subdomain owned by user.
- **Signature rejection cases** — wrong signer, expired grant, revoked nonce, mismatched collection (grant.collection != _nftContract arg), artistFee > maxArtistFee.
- **Label validation** — rejects uppercase, underscore, leading hyphen, trailing hyphen, > 32 chars, empty string.
- **Years validation** — rejects 0, rejects 11.
- **Insufficient payment** — reverts with `InsufficientPayment(required, provided)`.
- **Overpayment refund** — both `register()` and `registerWithArtist()` refund excess to `msg.sender`.
- **Artist treasury that reverts** — use `RejectingRecipient` mock as `artistTreasury`, expect the whole tx to revert with `TransferFailed` (atomicity guarantee).
- **Pause** — `pause()` blocks new registrations; `unpause()` restores.
- **Authorization** — `register()` called directly by a non-authorized address with `_owner != msg.sender` reverts with `NotForwarderOrSelf`.
- **Renewal** — `renew()` extends expiry by exactly `years * 365 days`, costs `pricePerYear * years` (no second platform fee), can be called by anyone (standard ENS pattern).

I had to use an in-process EVM earlier because the previous shell couldn't download solc. With Hardhat working here, just write idiomatic `ethers v6` + `chai` tests against `hre.ethers`.

### 2. Subdomain generator module

`frontend/lib/slug.ts` — pure TypeScript, fully deterministic, testable.

```ts
type OpenSeaNft = {
  contract: string;
  identifier: string;       // tokenId as string
  name?: string;
  collection?: string;      // OpenSea slug, e.g. "boredapeyachtclub"
};

export function generateSlug(nft: OpenSeaNft): string {
  // Priority 1: {collection.slug}-{tokenId}
  // Priority 2: slugify(name) — only if result is ≤ 28 chars and ≥ 3 chars after cleaning
  // Priority 3: hashed fallback `nft-{first 6 chars of keccak256(contract,tokenId)}`
  //
  // Slugify rules:
  //   - Lowercase
  //   - NFKD normalize
  //   - Strip diacritics
  //   - Replace spaces and underscores with `-`
  //   - Strip everything not in [a-z0-9-]
  //   - Collapse multiple consecutive hyphens
  //   - Trim leading/trailing hyphens
  //   - Truncate to 32 chars (slice mid-word is fine for the auto-generated case)
}

// Collision handling lives in the API route, not here — it needs to call
// the registrar's isAvailable() to know which suffix to try.
export async function findAvailableSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>
): Promise<string> {
  if (!(await isTaken(base))) return base;
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base.slice(0, 32 - String(i).length - 1)}-${i}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error("No slug variant available — base too saturated");
}
```

Write Vitest tests covering at least: BAYC #3749 → `boredapeyachtclub-3749`, CryptoPunk #8857 → `cryptopunks-8857`, names with emoji/accents/spaces, names too long, names that produce empty slugs (must fall to hash fallback).

### 3. Next.js 14 app (App Router)

Use **wagmi v2 + viem + RainbowKit**, Tailwind, shadcn/ui. Server actions for anything that needs the OpenSea API key or Pinata JWT.

Routes:

- **`/`** — Landing. Hero with the museum aesthetic from `museum-template/style.css` (same Cormorant Garamond display, same gold accents — but with movement/interactivity). Connect Wallet button.
- **`/dashboard`** — Lists the connected wallet's NFTs via OpenSea v2 (`/chain/{chain}/account/{address}/nfts`). Paginated. Each card → "Create Museum Site".
- **`/create/[contract]/[tokenId]`** — The create flow. Shows the auto-generated subdomain prominently (not editable), years selector (1/2/5/10), price breakdown including artist fee if present, live preview of the museum site in an iframe pointing at a server-rendered preview URL. Single "Pay & Deploy" button.
- **`/integrate`** — Artist onboarding (see step 4).
- **`/museums`** — User's owned ArtID sites with renewal UI.

API routes:

- **`/api/nfts/[address]`** — Server-side proxy to OpenSea v2 (hides API key).
- **`/api/generate`** — Takes `(nftContract, tokenId, subdomain)`, fetches NFT data, fills in the museum template placeholders, returns the populated HTML+CSS+JS folder.
- **`/api/pin`** — Server-side Pinata pin of the generated folder, returns CID. Use `pinata-web3` SDK. Encode contenthash as EIP-1577: `0xe301` + CIDv1 dag-pb bytes (use `@ensdomains/content-hash` lib).
- **`/api/grant`** — POST endpoint for `/integrate`. Receives `(collection, artistTreasury, artistFee)`. Server: (a) calls collection's `owner()` via viem to verify msg.sender owns it, (b) if signer matches, signs an EIP-712 `ArtistGrant` with the platform signer's private key (from `PLATFORM_SIGNER_PRIVATE_KEY` env var, NEVER exposed client-side), returns the signature. The artist copies it into their widget config.

### 4. `/integrate` page

Flow:
1. Connect wallet.
2. Input: NFT collection address.
3. Frontend calls `nftContract.owner()` via viem. If it reverts (no `Ownable`), try `hasRole(DEFAULT_ADMIN_ROLE, msg.sender)`. If both fail, surface a "Manual verification required" message with a Telegram contact link — don't try to auto-approve.
4. If verified: inputs for `artistTreasury` (default = msg.sender), `artistFee` (in ETH, default 0.0025, max enforced client-side at 0.05 to match `maxArtistFee` in the forwarder), and an expiry slider (1–24 months out).
5. Click "Generate Signature" → POST to `/api/grant` → server signs → server returns `{ grant, signature }`.
6. UI shows a copy-pasteable embed code block:

```html
<!-- ArtID widget for YourCollection -->
<script src="https://cdn.artid.eth/widget.js"
  data-collection="0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D"
  data-artist-treasury="0x..."
  data-artist-fee="2500000000000000"
  data-grant-expiry="1798765432"
  data-grant-nonce="42"
  data-signature="0xabc..."></script>
```

7. Also show a React tab with the equivalent `@artid/react` usage.

### 5. `@artid/widget` package (vanilla JS)

A single file that:
- Reads `data-*` attributes from its own `<script>` tag (use `document.currentScript`).
- Injects a styled launcher button onto the page near where the script lives, or wherever a `<div data-artid-widget>` is present (artist's choice).
- On click, opens a modal containing an `<iframe>` pointed at `https://artid.eth/embed?collection=...&artistTreasury=...&artistFee=...&grantExpiry=...&grantNonce=...&signature=...`.
- The iframe runs the full create flow with the grant pre-loaded. When user completes registration, iframe `postMessage`s `{ type: "artid:registered", subdomain, txHash }` back to the parent so the artist's page can show a success state.

Keep the bundle under 8 KB minified. No React, no dependencies. Build with `tsup` or similar to produce both `dist/widget.js` (IIFE for `<script>` tag) and `dist/index.mjs` (ESM for the React wrapper to import).

### 6. `@artid/react` package

Thin wrapper exporting `<ArtIDWidget>` and `<ArtIDButton>` components that mount the underlying widget. Same configuration props as the data attributes. ~30 lines of actual code; mostly just types.

```tsx
<ArtIDWidget
  collection="0xBC4..."
  artistTreasury="0x..."
  artistFee={parseEther("0.0025")}
  grant={{ expiry: 1798765432, nonce: 42, signature: "0xabc..." }}
/>
```

## Deployment targets

- **Sepolia first** for the contracts. ENS NameWrapper on Sepolia: `0x0635513f179D50A207757E05759CbD106d7dFcE8`. PublicResolver Sepolia: `0x8FADE66B79cC9f707aB26799354482EB93a5B7dD`.
- A real `artid.eth` name on Sepolia (register one for testing) must be **wrapped first** and the registrar contract approved as operator on the NameWrapper before any subdomain can be minted. Document this in the deployment script.
- For mainnet: NameWrapper `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401`, PublicResolver `0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63`.

Write a `script/deploy.js` Hardhat script that takes `--network sepolia` and: deploys registrar → deploys forwarder → calls `setForwarder(forwarder, true)` on registrar → prints both addresses and the verification commands.

## Environment variables

```
NEXT_PUBLIC_RPC_URL_MAINNET=
NEXT_PUBLIC_RPC_URL_SEPOLIA=
NEXT_PUBLIC_OPENSEA_API_KEY=        # server-side only, never NEXT_PUBLIC_
NEXT_PUBLIC_REGISTRAR_ADDRESS=
NEXT_PUBLIC_FORWARDER_ADDRESS=
NEXT_PUBLIC_ARTID_PARENT_NODE=      # namehash("artid.eth")
PINATA_JWT=
PLATFORM_SIGNER_PRIVATE_KEY=        # signs EIP-712 ArtistGrants server-side
DEPLOYER_PRIVATE_KEY=               # for hardhat deployments
```

The `NEXT_PUBLIC_OPENSEA_API_KEY` comment is intentional — that variable name is WRONG, it must not start with NEXT_PUBLIC_, since the key would leak. Use `OPENSEA_API_KEY` (server-only).

## Things to verify by reading the existing code

Before doing anything else, **read these files in this order** and confirm you understand the data flow:

1. `contracts/ArtIDRegistrar.sol` — pay attention to `register()` which does `setSubnodeRecord` → `setContenthash` → `setSubnodeOwner` (the registrar briefly owns the subnode so it can set contenthash before transferring to the user).
2. `contracts/ArtIDForwarder.sol` — note the EIP-712 schema (`ArtistGrant(address collection,address artistTreasury,uint256 artistFee,uint256 expiry,uint256 nonce)`), the call to `REGISTRAR.register{value: registrationCost}(...)` passing `msg.sender` as owner, and the overpayment refund logic.
3. `frontend/museum-template/index.html` — note the placeholder format `{{NAME}}` and the `<script id="traits-data">` JSON injection point.
4. `frontend/museum-template/script.js` — the `VISITORS` array (5 entries, locked) and the spatially-aware flash that reads visitor positions from `getBoundingClientRect()`.

## Anti-patterns to avoid

- **Do not** add an artist portal / on-chain artist registry. The whole architectural point of the forwarder + EIP-712 grant pattern is that artists need zero on-chain state. The signature *is* the registration.
- **Do not** let users edit their subdomain. The spec was explicit: fully automatic, no manual slug selection.
- **Do not** use Tailwind classes for the museum template — it's plain CSS for a reason (it ships to IPFS, where every byte matters and external CDN dependencies are friction). Tailwind is fine for the Next.js dApp itself.
- **Do not** charge a second platform fee on renewal — renewals are `pricePerYear * years` only. The contract enforces this; don't reinflate it on the frontend.
- **Do not** burn fuses on subdomain mint. The user must retain full control to transfer / re-resolve / renew elsewhere. Re-read `SUBNODE_FUSES = 0` in the registrar before considering otherwise.
- **Do not** put OpenSea API calls in client components. They leak the key. Server actions or API routes only.

## Definition of done for this round

1. Hardhat tests pass green for both contracts.
2. Both contracts deployed to Sepolia with verified source on Etherscan.
3. A single working end-to-end demo on Sepolia: connect wallet → see NFTs → pick one → register → land on `https://your-slug.artid.eth.limo` (or equivalent gateway) and see the populated museum site with traits, animated visitors, and the user's NFT in the gilded frame.
4. The `/integrate` page accepts a real collection address, verifies ownership, and produces a working embed code that, pasted into a separate test HTML page, opens the modal and completes a registration crediting the artist treasury.

Once that's running, post the Sepolia deploy addresses + the demo subdomain URL back here and stop. We'll review before going to mainnet.
