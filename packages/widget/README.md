# @artidv1/widget

Embeddable widget for [ArtID](https://artid.eth.link) — lets visitors mint ENS museum-passport sites under `artid.eth` for any NFT they own.

## Drop-in `<script>` tag

```html
<script
  src="https://unpkg.com/@artidv1/widget/dist/widget.js"
  data-collection="0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D"
  defer
></script>
```

Optional attributes: `data-token-id`, `data-label`, `data-host`.

Place a button anywhere with a placeholder:

```html
<div data-artid-widget data-collection="0x..." data-token-id="123"></div>
```

## Programmatic API

```js
import { open, close, mount } from "@artidv1/widget";

open({ collection: "0x...", tokenId: "123" });

mount(document.getElementById("slot"), { collection: "0x..." });
```

## Events

```js
window.addEventListener("artid:registered", (e) => {
  console.log(e.detail); // { subdomain, slug, txHash, cid }
});
```

## Self-host

The CDN script is `dist/widget.js` (IIFE, ~3 KB min). You can host it on your own domain — just pass `data-host="https://your-artid-host"` if you've forked the dApp too.

License: MIT.
