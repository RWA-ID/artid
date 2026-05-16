"use client";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet, sepolia } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";
import { cookieStorage, createStorage } from "wagmi";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000";
export const networks = [mainnet, sepolia];

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

let appKitInitialized = false;
export function initAppKit() {
  if (appKitInitialized) return;
  appKitInitialized = true;
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [mainnet, sepolia],
    defaultNetwork: mainnet,
    projectId,
    metadata: {
      name: "ArtID",
      description: "Museum passports for NFTs — permanent ENS subdomains under artid.eth",
      url: "https://artid.eth.limo",
      icons: ["https://artid.eth.limo/icon.png"],
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#d4a843",
      "--w3m-color-mix": "#0a0908",
      "--w3m-color-mix-strength": 20,
      "--w3m-border-radius-master": "2px",
      "--w3m-font-family": "'Cormorant Garamond', Georgia, serif",
    },
  });
}

export const TARGET_CHAIN = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 1);
