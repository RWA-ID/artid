"use client";
import { createAppKit } from "@reown/appkit/react";
import { mainnet, sepolia } from "@reown/appkit/networks";
import { wagmiAdapter, APPKIT_PROJECT_ID } from "@/lib/wagmi";

// Self-initializing — runs on first import, in the browser only.
let initialized = false;
function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [mainnet, sepolia],
    defaultNetwork: mainnet,
    projectId: APPKIT_PROJECT_ID,
    metadata: {
      name: "ArtID",
      description: "Museum passports for NFTs — permanent ENS subdomains under artid.eth",
      url: "https://artid.eth.link",
      icons: ["https://artid.eth.link/icon.png"],
    },
    features: { analytics: false, email: false, socials: false },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#c8a35a",
      "--w3m-color-mix": "#0a0908",
      "--w3m-color-mix-strength": 20,
      "--w3m-border-radius-master": "2px",
      "--w3m-font-family": "'Cormorant Garamond', Georgia, serif",
    },
  });
}
init();

// Kept for backwards-compat; calling it more than once is a no-op.
export function initAppKit() { init(); }
