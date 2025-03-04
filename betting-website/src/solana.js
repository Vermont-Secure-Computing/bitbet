import { AnchorProvider, Program, web3 } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idlBetting from "./idls/betting.json"; // ✅ Import Betting Contract IDL
import idlTruth from "./idls/truth_network.json"; // ✅ Import Truth Network IDL

// 🌐 Solana Devnet RPC
const SOLANA_RPC = "https://api.devnet.solana.com";
const connection = new Connection(SOLANA_RPC, "confirmed");

// // 🎯 Betting Contract Program ID (Update with your deployed program ID)
// const BETTING_PROGRAM_ID = new PublicKey(import.meta.env.BETTING_PROGRAM_ID);

// // 🎯 Truth Network Program ID (Update with your deployed program ID)
// const TRUTH_NETWORK_PROGRAM_ID = new PublicKey(import.meta.env.TRUTH_NETWORK_PROGRAM_ID);

// 🏦 Get Anchor Provider
const getProvider = (wallet) => {
    return new AnchorProvider(connection, wallet, { preflightCommitment: "confirmed" });
};

// 🔹 Initialize Betting Program
const getBettingProgram = (wallet) => {
    return new Program(idlBetting, getProvider(wallet));
};

// 🔹 Initialize Truth Network Program
const getTruthNetworkProgram = (wallet) => {
    return new Program(idlTruth, getProvider(wallet));
};

export { getBettingProgram, getTruthNetworkProgram };
