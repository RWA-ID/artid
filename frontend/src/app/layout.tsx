import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "ArtID — Museum passports for your NFTs",
  description: "Mint an ENS subdomain under artid.eth that hosts a personalized museum site for any NFT you own.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-charcoal-950 text-[#e6dcc7]">
        <Providers>
          <SiteNav />
          <main className="min-h-screen">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
