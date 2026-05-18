import { open, close, mount, DEFAULT_HOST } from "./index";

function attr(el: Element | null, name: string, fallback?: string): string | undefined {
  if (!el) return fallback;
  const v = el.getAttribute(`data-${name}`);
  return v == null || v === "" ? fallback : v;
}

function init() {
  const script =
    (document.currentScript as HTMLScriptElement | null) ||
    (() => {
      const all = document.getElementsByTagName("script");
      for (let i = all.length - 1; i >= 0; i--) {
        if (/widget\.js(\?|$)/.test(all[i].src)) return all[i];
      }
      return null;
    })();

  const placeholders = document.querySelectorAll("[data-artid-widget]");
  if (placeholders.length) {
    placeholders.forEach((el) => {
      if ((el as any).__artidMounted) return;
      (el as any).__artidMounted = true;
      const collection = attr(el, "collection");
      if (!collection) return;
      mount(el, {
        collection,
        tokenId: attr(el, "token-id"),
        label: attr(el, "label"),
        host: attr(el, "host", DEFAULT_HOST),
      });
    });
  } else if (script && script.getAttribute("data-collection")) {
    const holder = document.createElement("span");
    script.parentNode?.insertBefore(holder, script);
    mount(holder, {
      collection: script.getAttribute("data-collection")!,
      tokenId: attr(script, "token-id"),
      label: attr(script, "label"),
      host: attr(script, "host", DEFAULT_HOST),
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { open, close, mount };
