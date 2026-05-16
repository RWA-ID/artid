import type { Metadata } from "next";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { SiteNav } from "@/components/SiteNav";
import { wagmiConfig } from "@/lib/wagmi";

export const metadata: Metadata = {
  title: "ArtID — Museum passports for your NFTs",
  description: "Mint an ENS subdomain under artid.eth that hosts a personalized museum site for any NFT you own.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const initialState = cookieToInitialState(wagmiConfig, headers().get("cookie"));
  return (
    <html lang="en">
      <body className="min-h-screen bg-charcoal-950 text-[#e6dcc7]">
        <Providers initialState={initialState}>
          <SiteNav />
          <main className="min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
