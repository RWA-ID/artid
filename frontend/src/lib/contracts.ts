import type { Address } from "viem";

export const REGISTRAR_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRAR_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
export const FORWARDER_ADDRESS = (process.env.NEXT_PUBLIC_FORWARDER_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
export const ARTID_PARENT_NODE = (process.env.NEXT_PUBLIC_ARTID_PARENT_NODE || "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`;

export const REGISTRAR_ABI = [
  {
    name: "priceFor", type: "function", stateMutability: "view",
    inputs: [{ name: "_years", type: "uint64" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "isAvailable", type: "function", stateMutability: "view",
    inputs: [{ name: "_label", type: "string" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "platformFee", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }],
  },
  {
    name: "pricePerYear", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }],
  },
  {
    name: "SUBNODE_FUSES", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint32" }],
  },
  {
    name: "renew", type: "function", stateMutability: "payable",
    inputs: [
      { name: "_label", type: "string" },
      { name: "_years", type: "uint64" },
    ],
    outputs: [],
  },
  {
    name: "records", type: "function", stateMutability: "view",
    inputs: [{ type: "bytes32" }],
    outputs: [
      { name: "registrant", type: "address" },
      { name: "registeredAt", type: "uint64" },
      { name: "expiry", type: "uint64" },
      { name: "nftContractAndTokenId", type: "bytes32" },
    ],
  },
  {
    name: "Registered", type: "event",
    inputs: [
      { name: "label", type: "string", indexed: false },
      { name: "node", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "nftContract", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "expiry", type: "uint64", indexed: false },
      { name: "paid", type: "uint256", indexed: false },
    ],
  },
] as const;

export const FORWARDER_ABI = [
  {
    name: "register", type: "function", stateMutability: "payable",
    inputs: [
      { name: "_label", type: "string" },
      { name: "_years", type: "uint64" },
      { name: "_nftContract", type: "address" },
      { name: "_tokenId", type: "uint256" },
      { name: "_contenthash", type: "bytes" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    name: "setArtistTerms", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "_collection", type: "address" },
      { name: "_treasury", type: "address" },
      { name: "_fee", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "clearArtistTerms", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "_collection", type: "address" }],
    outputs: [],
  },
  {
    name: "getArtistTerms", type: "function", stateMutability: "view",
    inputs: [{ name: "_collection", type: "address" }],
    outputs: [
      { name: "treasury", type: "address" },
      { name: "fee", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    name: "totalCost", type: "function", stateMutability: "view",
    inputs: [
      { name: "_nftContract", type: "address" },
      { name: "_years", type: "uint64" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "maxArtistFee", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }],
  },
  {
    name: "ArtistTermsSet", type: "event",
    inputs: [
      { name: "collection", type: "address", indexed: true },
      { name: "treasury", type: "address", indexed: true },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
  {
    name: "ArtistPaid", type: "event",
    inputs: [
      { name: "collection", type: "address", indexed: true },
      { name: "treasury", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
