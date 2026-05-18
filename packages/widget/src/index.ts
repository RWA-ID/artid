export const DEFAULT_HOST = "https://artid.eth.link";

export interface ArtIDOpenOptions {
  collection: string;
  tokenId?: string | number | bigint;
  host?: string;
}

export interface ArtIDMountOptions extends ArtIDOpenOptions {
  label?: string;
}

export interface ArtIDRegisteredDetail {
  subdomain: string;
  slug: string;
  txHash?: string;
  cid?: string;
}

const STYLE_ID = "artid-widget-style";
const MODAL_ID = "artid-widget-modal";

function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = [
    ".artid-btn{display:inline-flex;align-items:center;gap:.6em;padding:14px 28px;",
    "font:500 11px/1 ui-sans-serif,system-ui,-apple-system,sans-serif;letter-spacing:.3em;",
    "text-transform:uppercase;color:#0a0908;background:linear-gradient(180deg,#f0d989,#d8b977 45%,#c8a35a);",
    "border:none;cursor:pointer;box-shadow:0 8px 24px rgba(200,163,90,.25),inset 0 1px 0 rgba(255,255,255,.3);",
    "transition:transform .15s ease,box-shadow .15s ease;-webkit-font-smoothing:antialiased;border-radius:0}",
    ".artid-btn:hover{transform:translateY(-1px);box-shadow:0 12px 32px rgba(200,163,90,.4),inset 0 1px 0 rgba(255,255,255,.4)}",
    ".artid-btn:active{transform:translateY(0)}",
    ".artid-btn svg{width:12px;height:12px;flex-shrink:0}",
    `#${MODAL_ID}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;`,
    "background:rgba(10,9,8,.78);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:artid-fade .2s ease}",
    `#${MODAL_ID} .artid-frame-wrap{position:relative;width:min(1180px,96vw);height:min(880px,92vh);`,
    "background:#0a0908;border:1px solid rgba(200,163,90,.22);box-shadow:0 32px 80px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.4);",
    "animation:artid-rise .25s cubic-bezier(.2,.8,.2,1)}",
    `#${MODAL_ID} iframe{width:100%;height:100%;border:0;display:block;background:#0a0908}`,
    `#${MODAL_ID} .artid-close{position:absolute;top:-14px;right:-14px;width:36px;height:36px;`,
    "border-radius:50%;background:#0a0908;border:1px solid rgba(200,163,90,.4);color:#d8b977;",
    "cursor:pointer;font:300 22px/1 ui-sans-serif,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;",
    "z-index:1;box-shadow:0 4px 16px rgba(0,0,0,.5);transition:border-color .15s,color .15s}",
    `#${MODAL_ID} .artid-close:hover{border-color:#d8b977;color:#f0d989}`,
    `#${MODAL_ID} .artid-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;`,
    "color:#a89e85;font:italic 300 14px ui-serif,Cormorant Garamond,Garamond,serif;letter-spacing:.04em;pointer-events:none}",
    "@keyframes artid-fade{from{opacity:0}to{opacity:1}}",
    "@keyframes artid-rise{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:none}}",
    `@media(max-width:640px){#${MODAL_ID} .artid-frame-wrap{width:100vw;height:100vh}`,
    `#${MODAL_ID} .artid-close{top:8px;right:8px}}`,
  ].join("");
  document.head.appendChild(s);
}

function buildUrl(host: string, collection: string, tokenId?: string | number | bigint) {
  const base = host.replace(/\/+$/, "");
  if (tokenId !== undefined && tokenId !== null && String(tokenId) !== "") {
    return `${base}/create?c=${encodeURIComponent(collection)}&t=${encodeURIComponent(String(tokenId))}&embed=1`;
  }
  return `${base}/dashboard?embed=1&c=${encodeURIComponent(collection)}`;
}

let activeCleanup: (() => void) | null = null;

export function open(options: ArtIDOpenOptions): () => void {
  if (typeof document === "undefined") return () => {};
  if (!options.collection) {
    console.warn("[artid] collection is required");
    return () => {};
  }
  close();
  injectStyles();

  const host = options.host || DEFAULT_HOST;
  let hostOrigin: string;
  try { hostOrigin = new URL(host).origin; } catch { hostOrigin = "*"; }
  const url = buildUrl(host, options.collection, options.tokenId);

  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "ArtID museum passport");
  modal.innerHTML =
    '<div class="artid-frame-wrap">' +
      '<button class="artid-close" aria-label="Close">×</button>' +
      '<div class="artid-loading">Opening museum…</div>' +
      '<iframe allow="clipboard-write; clipboard-read; payment" referrerpolicy="no-referrer"></iframe>' +
    "</div>";

  const iframe = modal.querySelector("iframe") as HTMLIFrameElement;
  const loading = modal.querySelector(".artid-loading") as HTMLElement | null;
  iframe.addEventListener("load", () => { loading?.remove(); });
  iframe.src = url;

  const closeBtn = modal.querySelector(".artid-close") as HTMLButtonElement;
  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
  const onMsg = (e: MessageEvent) => {
    if (hostOrigin !== "*" && e.origin !== hostOrigin) return;
    const d = e.data;
    if (!d || typeof d !== "object") return;
    if (d.type === "artid:close") { close(); return; }
    if (d.type === "artid:registered") {
      window.dispatchEvent(new CustomEvent<ArtIDRegisteredDetail>("artid:registered", { detail: d }));
    }
  };

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", onKey);
  window.addEventListener("message", onMsg);

  activeCleanup = () => {
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("message", onMsg);
    modal.remove();
    document.body.style.overflow = "";
    activeCleanup = null;
  };
  return close;
}

export function close(): void {
  if (activeCleanup) activeCleanup();
}

function makeButton(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "artid-btn";
  btn.innerHTML =
    '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
      '<path d="M2.5 11.5 V4 a1 1 0 0 1 1-1 h7 a1 1 0 0 1 1 1 v7.5" stroke="currentColor" stroke-width="1.3"/>' +
      '<path d="M2 11.5h10" stroke="currentColor" stroke-width="1.3"/>' +
      '<circle cx="7" cy="6.8" r="1.1" fill="currentColor"/>' +
    "</svg><span></span>";
  (btn.querySelector("span") as HTMLSpanElement).textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

export function mount(target: Element, options: ArtIDMountOptions): () => void {
  if (!options.collection) {
    console.warn("[artid] collection is required");
    return () => {};
  }
  injectStyles();
  const btn = makeButton(options.label || "Mint Museum Passport", () =>
    open({ collection: options.collection, tokenId: options.tokenId, host: options.host })
  );
  target.appendChild(btn);
  return () => btn.remove();
}
