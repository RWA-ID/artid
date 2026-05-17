# Design brief — ArtID

You are a senior product/visual designer specializing in editorial dark UIs and motion design (Linear, Vercel, Apple keynote, Cosmos, the Guggenheim website). Your job is to redesign two surfaces of **ArtID** — a dApp that lets NFT collectors mint a permanent ENS subdomain + IPFS-hosted museum site for any NFT they own.

Live at https://github.com/RWA-ID/artid · mainnet contracts deployed · functional but visually stiff. Audience: serious NFT collectors and contemporary digital artists. The brand voice is **museum, not crypto** — restrained, monumental, quietly luxurious. No memes, no neon, no rocket emojis.

---

## What to redesign

### 1. The Next.js dApp pages
Located in `frontend/src/app/`:
- `page.tsx` — landing. Currently has a hero with a floating "gallery wall" of trending NFTs, a manifesto pull-quote, a 3-step "how a passport is made" section, and two audience callouts.
- `dashboard/page.tsx` — grid of the connected wallet's NFTs (from OpenSea v2).
- `create/[contract]/[tokenId]/page.tsx` — the mint flow: shows the selected NFT, auto-generated subdomain, year selector, price breakdown, and a live preview iframe of the museum site that will be deployed.
- `integrate/page.tsx` — for artists/collections to set on-chain payout terms.
- `museums/page.tsx` — list of the connected wallet's minted museum passports + renewal UI.
- Shared: `components/SiteNav.tsx` (top nav), `components/Providers.tsx`.

Stack: **Next.js 14 App Router**, **TypeScript**, **TailwindCSS**, **framer-motion**, **wagmi v2**, **Reown AppKit**. Tailwind theme has a `gilded` (gold) and `charcoal` palette and a Cormorant Garamond display font.

### 2. The museum template
Located in `frontend/museum-template/`:
- `index.html` — the per-NFT museum page. Uses `{{PLACEHOLDER}}` tokens that the server fills in at mint time. Placeholders include `{{NFT_NAME}}`, `{{NFT_IMAGE_URL}}`, `{{COLLECTION_NAME}}`, `{{TOKEN_ID}}`, `{{SUBDOMAIN}}` (the bare slug, no `.artid.eth` suffix — the template adds that), `{{CONTRACT_ADDRESS}}`, `{{CONTRACT_ADDRESS_SHORT}}`, `{{OWNER_ADDRESS_SHORT}}`, `{{TOKEN_STANDARD}}`, `{{MINT_DATE}}`, `{{TRAITS_JSON}}`.
- `style.css` — plain CSS, charcoal walls, gilded gold frame.
- `script.js` — vanilla JS that places 5 visitor silhouettes in the hall and triggers spatially-aware camera flashes based on `getBoundingClientRect()`. Lightbox on image click. Traits are rendered from a JSON `<script id="traits-data">` block.
- `preview.html` — sample-data version that opens directly in a browser without the server.

**Hard constraints on the museum template:**
- **No external CDN dependencies** (it ships to IPFS — every byte and every network call matters). Inline everything. Google Fonts is OK because it's the only dependency users will tolerate.
- **No frameworks, no Tailwind, no React** — vanilla HTML/CSS/JS only.
- Must work offline once loaded (after fonts cache).
- Must render without JS for the core content (images + traits) — JS adds the visitors, the flashes, the lightbox.
- **Gilded gold frame** is the locked aesthetic for v1 — every collection looks the same.
- Five visitor silhouettes is the locked count.

---

## What needs to change

### Aesthetic
The landing is competent but flat. The museum template is good but static. Both need to feel **alive** without becoming busy.

References to study:
- **The Guggenheim Bilbao website** — slow camera moves, restrained motion, monumental typography.
- **Linear's landing** — type animations, scroll-driven reveals, depth without parallax-tackiness.
- **Cosmos.so** — gallery layouts, hover micro-interactions, no chrome competing with content.
- **Refik Anadol installations** — ambient generative backgrounds (low opacity).
- **A real museum at twilight** — pools of light, deep shadow, dust motes in the beam.

### Motion (be tasteful, not cluttered)
- **Landing** — frames in the gallery wall should drift, not bounce. Type should reveal as if exposed by a slowly-moving light. Hovering an NFT frame triggers a soft halo + slight scale, not a translation. Scroll should feel weighted (consider `framer-motion` `useScroll` + lagged transforms).
- **Museum template** — visitors should idle naturally (subtle weight-shifts, not loops). Camera flashes already exist; make them feel like real shutters (1/200s exposure, brief overexposure, slow fade). Add a barely-visible dust-motes overlay drifting across the spotlight cone. On lightbox open, the surrounding hall should dim further, not just blur.
- Respect `prefers-reduced-motion` everywhere.

### Information architecture
- The current museum template page header says `{{SUBDOMAIN}}.artid.eth` but has **no creator/artist info** beyond the collection name. Add a "Creator" plaque that surfaces the artist when available — for now, the data we can show is: collection name, contract address (short + full on hover), token standard, mint date, the holder's address, and a "View on OpenSea" link. Treat the plaque the way a museum treats a wall card: small caps, precise typography, generous whitespace.
- The create page price breakdown is informative but visually undifferentiated. Make the "Total to send" line monumental.
- The landing's manifesto quote is fine but could earn a more striking treatment — perhaps as a marquee that the visitor scrolls past, gold rule above and below.

---

## Deliverables

For each surface, provide:
1. A short visual rationale (2–3 sentences).
2. Replacement code (full files, not snippets) that I can drop directly into the repo.
3. Any new asset URLs you reference (use public CDN or inline SVG — no broken refs).
4. A note on what *not* to change (e.g. don't touch the `{{PLACEHOLDER}}` token names, don't reorder the wagmi hooks, etc.).

For the museum template specifically: please supply a `preview.html` with sample data filled in so I can open it directly in a browser to evaluate, in addition to the templated `index.html`.

---

## Anti-patterns to avoid

- **No skeuomorphic crypto chrome** — no glowing borders, no "verified" badges with checkmarks, no glassmorphism.
- **No emoji.** None.
- **No "Web3" copy** — say "Ethereum mainnet" or "ENS subdomain", never "Web3."
- **No parallax overload** — one parallax accent per page maximum.
- **No "Connect to continue"** dead-ends — pages should show meaningful empty states even when no wallet is connected.
- **No GIFs.** Use CSS or canvas if you need motion.
- Don't change the contract ABI references, the wagmi config, the route paths, or the placeholder token names in the museum template. The IA is fixed; only the visual + motion treatment is up for redesign.
