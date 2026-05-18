import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet, sepolia } from "@reown/appkit/networks";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000";
export const networks = [mainnet, sepolia];

const MAINNET_RPC = process.env.NEXT_PUBLIC_RPC_URL_MAINNET;
const SEPOLIA_RPC = process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA;

const customRpcUrls: Record<string, { url: string }[]> = {};
if (MAINNET_RPC) customRpcUrls["eip155:1"] = [{ url: MAINNET_RPC }];
if (SEPOLIA_RPC) customRpcUrls["eip155:11155111"] = [{ url: SEPOLIA_RPC }];

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  customRpcUrls: customRpcUrls as any,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
export const APPKIT_PROJECT_ID = projectId;
export const TARGET_CHAIN = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 1);
