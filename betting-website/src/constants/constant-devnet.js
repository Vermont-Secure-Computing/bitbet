import { PublicKey } from "@solana/web3.js";

// Program IDs
export const BETTING_CONTRACT_PROGRAM_ID = new PublicKey("98ftixwWWStM2KE7dNHHr5ABPPckVkrCELqCjA2sJbJE");
export const TRUTH_NETWORK_PROGRAM_ID = new PublicKey("C26LU8DVw2c51gNWFLye1oAwH3hiRPGcGCA2crnER3mR");

export const FALLBACK_RPC_URLS = [
    localStorage.getItem("customRpcUrl") || "https://api.devnet.solana.com",
    "https://api.devnet.solana.com",
    "https://solana-testnet.drpc.org/"
];

export const DEFAULT_RPC_URL = FALLBACK_RPC_URLS[0];

export const RPC_HELP_LINKS = [
    "https://www.helius.xyz/",
    "https://triton.one/",
    "https://quicknode.com/",
];

// Header title
export const NETWORK_NAME = "DevNet"

// Switch Website network
export const SWITCH_LINK_LABEL = "Open in MainNet"
export const SWITCH_LINK_URL = "https://solbetx.com"