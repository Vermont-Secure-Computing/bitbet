import { PublicKey } from "@solana/web3.js";

// Define version-specific program IDs
const PROGRAM_IDS = {
    latest: {
        BETTING_CONTRACT_PROGRAM_ID: new PublicKey("B8XxuJynFpSVkuYumB6mXFxHEkDvdddavCudCHH7NJWM"),
        TRUTH_NETWORK_PROGRAM_ID: new PublicKey("FFL71XjBkjq5gce7EtpB7Wa5p8qnRNueLKSzM4tkEMoc"),
    },
    coucal: {
        BETTING_CONTRACT_PROGRAM_ID: new PublicKey("Dm3SXYSbQJJjiFR346vLh41wdPnXSJcq4pMsheuWnfU4"),
        TRUTH_NETWORK_PROGRAM_ID: new PublicKey("4sC1fceX7osnaP8JkY4AfgK5tSFSfS44rXMhX361WEPF"),
    },
    malkoha: {
        BETTING_CONTRACT_PROGRAM_ID: new PublicKey("9XiAk8AJVCWkypFstaRERag2DeKgtSergJR4PqTYeV9C"),
        TRUTH_NETWORK_PROGRAM_ID: new PublicKey("4sC1fceX7osnaP8JkY4AfgK5tSFSfS44rXMhX361WEPF"),
    },
};

// Determine version from env (fallback to latest)
const version = import.meta.env.VITE_VERSION || "latest";
const selected = PROGRAM_IDS[version.toLowerCase()] || PROGRAM_IDS.latest;

// Export selected program IDs
export const BETTING_CONTRACT_PROGRAM_ID = selected.BETTING_CONTRACT_PROGRAM_ID;
export const TRUTH_NETWORK_PROGRAM_ID = selected.TRUTH_NETWORK_PROGRAM_ID;

// Fallback RPCs
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

export const SOLBETX_VERSIONS = [
    { label: "Latest", value: "latest", url: "https://solbetx.com" },
    { label: "Coucal", value: "coucal", url: "https://coucal.solbetx.com" },
    { label: "Malkoha", value: "malkoha", url: "https://malkoha.solbetx.com" },
    {
      label: "Open in DevNet",
      value: "devnet",
      url: "https://devnet.solbetx.com",
    },
  ];

// Header label
export const NETWORK_NAME = "MainNet";

// Website switch
export const SWITCH_LINK_LABEL = "Open in DevNet";
export const SWITCH_LINK_URL = "https://devnet.solbetx.com";
