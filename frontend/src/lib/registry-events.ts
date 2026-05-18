"use client";
import { decodeAbiParameters, pad } from "viem";
import { REGISTRAR_ADDRESS } from "@/lib/contracts";

const ETHERSCAN_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || "";
const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || "1";

// keccak256("Registered(string,bytes32,address,address,uint256,uint64,uint256)")
const REGISTERED_TOPIC0 = "0xbcb8f869b5bfe63fee272708db739ff6dcbf909fb6dc950274219d459c99e59f";

export type RegisteredEvent = {
  label: string;
  node: `0x${string}`;
  owner: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  sharedExpiry: bigint;
  donated: bigint;
  blockNumber: bigint;
  txHash: `0x${string}`;
};

type EtherscanLog = {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
};

function decodeLog(l: EtherscanLog): RegisteredEvent {
  // Indexed: node (topic1), owner (topic2), nftContract (topic3)
  // Non-indexed (in data): label (string), tokenId (uint256), sharedExpiry (uint64), donated (uint256)
  const [label, tokenId, sharedExpiry, donated] = decodeAbiParameters(
    [
      { type: "string", name: "label" },
      { type: "uint256", name: "tokenId" },
      { type: "uint64", name: "sharedExpiry" },
      { type: "uint256", name: "donated" },
    ],
    l.data as `0x${string}`
  );
  return {
    label: label as string,
    node: l.topics[1] as `0x${string}`,
    owner: (`0x` + l.topics[2].slice(26)) as `0x${string}`,
    nftContract: (`0x` + l.topics[3].slice(26)) as `0x${string}`,
    tokenId: tokenId as bigint,
    sharedExpiry: sharedExpiry as bigint,
    donated: donated as bigint,
    blockNumber: BigInt(l.blockNumber),
    txHash: l.transactionHash as `0x${string}`,
  };
}

async function fetchRegisteredLogs(params: {
  owner?: string;
  fromBlock?: number | "earliest";
  toBlock?: number | "latest";
}): Promise<RegisteredEvent[]> {
  if (!ETHERSCAN_KEY) throw new Error("ETHERSCAN_API_KEY missing");
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", CHAIN_ID);
  url.searchParams.set("module", "logs");
  url.searchParams.set("action", "getLogs");
  url.searchParams.set("address", REGISTRAR_ADDRESS);
  url.searchParams.set("topic0", REGISTERED_TOPIC0);
  if (params.owner) {
    url.searchParams.set("topic2", pad(params.owner as `0x${string}`, { size: 32 }));
    url.searchParams.set("topic0_2_opr", "and");
  }
  url.searchParams.set("fromBlock", String(params.fromBlock ?? 0));
  url.searchParams.set("toBlock", String(params.toBlock ?? "latest"));
  url.searchParams.set("apikey", ETHERSCAN_KEY);

  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`Etherscan HTTP ${r.status}`);
  const d = await r.json();
  // Etherscan returns status "0" with message "No records found" when empty — not an error
  if (d.status === "0" && d.message !== "No records found") {
    throw new Error(`Etherscan: ${d.message || d.result || "unknown error"}`);
  }
  const rows: EtherscanLog[] = Array.isArray(d.result) ? d.result : [];
  return rows.map(decodeLog);
}

export async function fetchRegisteredByOwner(owner: string) {
  return fetchRegisteredLogs({ owner });
}

export async function fetchRecentRegistered(limit = 8) {
  const all = await fetchRegisteredLogs({});
  return all.slice(-limit).reverse();
}
