"use client";
import Link from "next/link";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "appkit-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        balance?: "show" | "hide";
        size?: "md" | "sm";
        label?: string;
      };
      "appkit-account-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export function SiteNav() {
  return (
    <nav className="border-b border-charcoal-800 bg-charcoal-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-display text-2xl gilded-text tracking-wide">
          ArtID
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/dashboard" className="hover:text-gilded-300">Dashboard</Link>
          <Link href="/museums" className="hover:text-gilded-300">My Museums</Link>
          <Link href="/integrate" className="hover:text-gilded-300">Artists</Link>
          <appkit-button balance="hide" />
        </div>
      </div>
    </nav>
  );
}
