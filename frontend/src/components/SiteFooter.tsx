"use client";
import { useEffect, useState } from "react";

export function SiteFooter() {
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setEmbedded(sp.get("embed") === "1");
    } catch {}
  }, []);
  if (embedded) return null;

  return (
    <footer
      className="border-t px-6 sm:px-7 pt-12 sm:pt-14 pb-10"
      style={{ background: "#050505", borderColor: "rgba(200,163,90,0.18)" }}
    >
      <div className="max-w-[1200px] mx-auto flex flex-col gap-10 sm:flex-row sm:flex-wrap sm:justify-between sm:items-end">
        <div>
          <div className="font-display text-2xl tracking-[0.4em] text-[#c8a35a]">ArtID</div>
          <div className="mt-2 text-[10px] sm:text-[11px] tracking-[0.28em] sm:tracking-[0.32em] uppercase text-[#6a6151]">
            artid.eth · ethereum mainnet · 2026
          </div>
        </div>

        <div className="text-[10px] sm:text-[11px] tracking-[0.28em] sm:tracking-[0.32em] uppercase text-[#6a6151] sm:text-right">
          ENS · IPFS · No middlemen
        </div>
      </div>

      {/* Credits + source */}
      <div className="max-w-[1200px] mx-auto mt-10 pt-7 border-t flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "rgba(200,163,90,0.10)" }}>
        <a
          href="https://x.com/ensgianteth"
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-2.5 text-[10px] sm:text-[11px] tracking-[0.28em] uppercase text-[#6a6151] hover:text-[#d8b977] transition-colors"
        >
          <span>Built by</span>
          <span className="text-[#a89e85] group-hover:text-[#d8b977] normal-case tracking-normal font-mono text-[12px]">@ensgianteth</span>
          {/* X logo */}
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true" className="text-[#a89e85] group-hover:text-[#d8b977] transition-colors">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>

        <a
          href="https://github.com/RWA-ID/artid"
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-2.5 text-[10px] sm:text-[11px] tracking-[0.28em] uppercase text-[#6a6151] hover:text-[#d8b977] transition-colors"
        >
          {/* GitHub logo */}
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" className="text-[#a89e85] group-hover:text-[#d8b977] transition-colors">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
          <span>ArtID on GitHub</span>
        </a>
      </div>
    </footer>
  );
}
