"use client";
import "@/lib/appkit";       // ensure createAppKit() runs before useAppKit
import Link from "next/link";
import { useAccount, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { useEffect, useRef, useState } from "react";

function hardReset() {
  try {
    Object.keys(localStorage).forEach(k => {
      if (/wagmi|wc@|walletconnect|@w3m|@appkit|reown|w3m/i.test(k)) {
        localStorage.removeItem(k);
      }
    });
    Object.keys(sessionStorage).forEach(k => sessionStorage.removeItem(k));
    document.cookie.split(";").forEach(c => {
      const eq = c.indexOf("=");
      const name = (eq > -1 ? c.substring(0, eq) : c).trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  } catch {}
  location.reload();
}

function ConnectChip() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) {
    return <div className="px-5 py-2.5 text-[11px] tracking-[0.3em] uppercase border border-[rgba(200,163,90,0.18)] text-[#5a5141]">…</div>;
  }
  return <ConnectChipInner />;
}

function ConnectChipInner() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!isConnected || !address) {
    return (
      <button
        onClick={() => open()}
        className="inline-flex items-center gap-2.5 px-5 py-2.5 text-[11px] tracking-[0.3em] uppercase
                   border border-[rgba(200,163,90,0.4)] text-[#c8a35a]
                   hover:border-[#c8a35a] hover:bg-[rgba(200,163,90,0.05)] hover:text-[#d8b977]
                   transition"
      >
        Connect
        <svg viewBox="0 0 14 14" width="10" height="10">
          <path d="M3 7h8M7 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4"/>
        </svg>
      </button>
    );
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setMenuOpen(o => !o)}
        className="inline-flex items-center gap-2.5 px-4 py-2.5 text-[11px] tracking-[0.18em] uppercase
                   border border-[rgba(200,163,90,0.25)] text-[#ece4d2]
                   hover:border-[#c8a35a] hover:text-[#d8b977]
                   transition font-mono normal-case tracking-normal"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#c8a35a]" />
        {short}
      </button>
      {menuOpen && (
        <div className="absolute right-0 mt-2 min-w-[180px] border border-[rgba(200,163,90,0.18)] bg-[#0a0908] shadow-[0_24px_48px_rgba(0,0,0,0.5)] z-50">
          <button
            onClick={() => { setMenuOpen(false); open({ view: "Account" }); }}
            className="block w-full text-left px-4 py-3 text-[11px] tracking-[0.18em] uppercase text-[#b8aa8e] hover:text-[#d8b977] hover:bg-[rgba(200,163,90,0.04)]"
          >
            Account
          </button>
          <button
            onClick={() => { setMenuOpen(false); open({ view: "Networks" }); }}
            className="block w-full text-left px-4 py-3 text-[11px] tracking-[0.18em] uppercase text-[#b8aa8e] hover:text-[#d8b977] hover:bg-[rgba(200,163,90,0.04)] border-t border-[rgba(200,163,90,0.08)]"
          >
            Network
          </button>
          <button
            onClick={() => { setMenuOpen(false); disconnect(); }}
            className="block w-full text-left px-4 py-3 text-[11px] tracking-[0.18em] uppercase text-[#a06060] hover:text-[#c87070] hover:bg-[rgba(200,90,90,0.04)] border-t border-[rgba(200,163,90,0.08)]"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

export function SiteNav() {
  const [embedded, setEmbedded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setEmbedded(sp.get("embed") === "1");
    } catch {}
  }, []);
  if (embedded) return null;
  return (
    <nav className="border-b border-[rgba(200,163,90,0.08)] bg-[#0a0908]/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-7 py-4 sm:py-5 flex items-center justify-between">
        <Link href="/" className="font-display italic text-[22px] tracking-[-0.01em] text-[#d8b977]">
          ArtID
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 text-[11px] tracking-[0.3em] uppercase">
          <Link href="/dashboard" className="text-[#b8aa8e] hover:text-[#d8b977] transition">Gallery</Link>
          <Link href="/museums" className="text-[#b8aa8e] hover:text-[#d8b977] transition">Museums</Link>
          <Link href="/integrate" className="text-[#b8aa8e] hover:text-[#d8b977] transition">Artists</Link>
          <button
            onClick={hardReset}
            title="Clear all wallet session storage"
            className="text-[10px] text-[#5a5141] hover:text-red-400/80 tracking-[0.32em]"
          >
            Reset
          </button>
          <ConnectChip />
        </div>

        {/* Mobile: connect chip + hamburger */}
        <div className="flex md:hidden items-center gap-3">
          <ConnectChip />
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="inline-flex items-center justify-center w-10 h-10 border border-[rgba(200,163,90,0.25)] text-[#c8a35a] hover:border-[#c8a35a] transition"
          >
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4">
              {menuOpen
                ? <path d="M4 4l10 10M14 4L4 14" strokeLinecap="round" />
                : <><path d="M2 5h14" strokeLinecap="round" /><path d="M2 9h14" strokeLinecap="round" /><path d="M2 13h14" strokeLinecap="round" /></>}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-[rgba(200,163,90,0.08)] bg-[#0a0908]/95 backdrop-blur">
          <div className="px-6 py-3 flex flex-col text-[12px] tracking-[0.3em] uppercase">
            <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="py-3.5 text-[#b8aa8e] hover:text-[#d8b977] transition border-b border-[rgba(200,163,90,0.06)]">Gallery</Link>
            <Link href="/museums" onClick={() => setMenuOpen(false)} className="py-3.5 text-[#b8aa8e] hover:text-[#d8b977] transition border-b border-[rgba(200,163,90,0.06)]">Museums</Link>
            <Link href="/integrate" onClick={() => setMenuOpen(false)} className="py-3.5 text-[#b8aa8e] hover:text-[#d8b977] transition border-b border-[rgba(200,163,90,0.06)]">Artists</Link>
            <button
              onClick={() => { setMenuOpen(false); hardReset(); }}
              className="py-3.5 text-left text-[10px] text-[#5a5141] hover:text-red-400/80 tracking-[0.32em]"
            >
              Reset wallet session
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
