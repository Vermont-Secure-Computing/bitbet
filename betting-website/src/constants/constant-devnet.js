import { PublicKey } from "@solana/web3.js";

// Program IDs
export const BETTING_CONTRACT_PROGRAM_ID = new PublicKey("H7bHnh15df8mfnnWC9K861bGh8DLD1rTqmu86NKRTf6e");
export const TRUTH_NETWORK_PROGRAM_ID = new PublicKey("31wdq6EJgHKRjZotAjc6vkuJ7aRyQPauwmgadPiEm8EY");

export const FALLBACK_RPC_URLS = [
    localStorage.getItem("customRpcUrl") || "https://api.devnet.solana.com",
    "https://api.devnet.solana.com",
    "https://solana-testnet.drpc.org/"
];

export const DEFAULT_RPC_URL = FALLBACK_RPC_URLS[0];

export const RPC_HELP_LINKS = [
    "https://www.helius.xyz/",
    "https://alchemy.com",
    "https://quicknode.com/",
];

// Header title
export const NETWORK_NAME = "DevNet"

// Switch Website network
export const SWITCH_LINK_LABEL = "Open in MainNet"
export const SWITCH_LINK_URL = "https://solbetx.com"