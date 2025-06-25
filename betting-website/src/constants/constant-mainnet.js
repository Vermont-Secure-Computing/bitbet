import { PublicKey } from "@solana/web3.js";

// Program IDs
export const BETTING_CONTRACT_PROGRAM_ID = new PublicKey("Dm3SXYSbQJJjiFR346vLh41wdPnXSJcq4pMsheuWnfU4");
export const TRUTH_NETWORK_PROGRAM_ID = new PublicKey("4sC1fceX7osnaP8JkY4AfgK5tSFSfS44rXMhX361WEPF");

export const FALLBACK_RPC_URLS = [
    localStorage.getItem("customRpcUrl") || "https://solana-rpc.publicnode.com",
    "https://solana-rpc.publicnode.com",
    "https://go.getblock.io/4136d34f90a6488b84214ae26f0ed5f4",
    "https://api.mainnet-beta.solana.com",
];

export const DEFAULT_RPC_URL = FALLBACK_RPC_URLS[0];

export const RPC_HELP_LINKS = [
    "https://www.helius.xyz/",
    "https://alchemy.com",
    "https://quicknode.com/",
];

// Header title
export const NETWORK_NAME = "MainNet"

// Switch Website network
export const SWITCH_LINK_LABEL = "Open in DevNet"
export const SWITCH_LINK_URL = "https://devnet.solbetx.com"