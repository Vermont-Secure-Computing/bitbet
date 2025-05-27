import { PublicKey } from "@solana/web3.js";

// Program IDs
export const BETTING_CONTRACT_PROGRAM_ID = new PublicKey("9XiAk8AJVCWkypFstaRERag2DeKgtSergJR4PqTYeV9C");
export const TRUTH_NETWORK_PROGRAM_ID = new PublicKey("4sC1fceX7osnaP8JkY4AfgK5tSFSfS44rXMhX361WEPF");

// Default RPC url
export const DEFAULT_RPC_URL = localStorage.getItem("customRpcUrl") || "https://solana-rpc.publicnode.com"

// Header title
export const NETWORK_NAME = "MainNet"

// Switch Website network
export const SWITCH_LINK_LABEL = "Open in DevNet"
export const SWITCH_LINK_URL = "https://devnet.solbetx.com"