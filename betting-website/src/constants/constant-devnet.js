import { PublicKey } from "@solana/web3.js";

// Program IDs
export const BETTING_CONTRACT_PROGRAM_ID = new PublicKey("98ftixwWWStM2KE7dNHHr5ABPPckVkrCELqCjA2sJbJE");
export const TRUTH_NETWORK_PROGRAM_ID = new PublicKey("C26LU8DVw2c51gNWFLye1oAwH3hiRPGcGCA2crnER3mR");

// Default RPC url
export const DEFAULT_RPC_URL = localStorage.getItem("customRpcUrl") || "https://api.devnet.solana.com"

// Header title
export const NETWORK_NAME = "DevNet"

// Switch Website network
export const SWITCH_LINK_LABEL = "Open in MainNet"
export const SWITCH_LINK_URL = "https://solbetx.com"