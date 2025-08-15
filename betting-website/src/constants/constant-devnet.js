import { PublicKey } from "@solana/web3.js";

// Define version-specific program IDs
export const BETTING_CONTRACT_PROGRAM_ID = new PublicKey("H7bHnh15df8mfnnWC9K861bGh8DLD1rTqmu86NKRTf6e");
export const TRUTH_NETWORK_PROGRAM_ID = new PublicKey("31wdq6EJgHKRjZotAjc6vkuJ7aRyQPauwmgadPiEm8EY");

// Fallback RPCs
export const FALLBACK_RPC_URLS = [
    localStorage.getItem("customRpcUrl") || "https://api.devnet.solana.com",
    "https://solana-devnet.api.onfinality.io/public",
    "https://solana-devnet.drpc.org",
    "https://rpc.ankr.com/solana_devnet",
    "https://solana-devnet.g.alchemy.com/public",
  ];

export const DEFAULT_RPC_URL = FALLBACK_RPC_URLS[0];

export const RPC_HELP_LINKS = [
    "https://www.helius.xyz/",
    "https://alchemy.com",
    "https://quicknode.com/",
];

export const SOLBETX_VERSIONS = [
    { label: "Latest", value: "latest", url: "https://solbetx.com" },
    { label: "Coucal", value: "coucal", url: "https://coucal.solbetx.com" },
    { label: "Malkoha", value: "malkoha", url: "https://malkoha.solbetx.com" },
];

// Header title
export const NETWORK_NAME = "DevNet"

// Switch Website network
export const SWITCH_LINK_LABEL = "Open in MainNet"
export const SWITCH_LINK_URL = "https://solbetx.com"