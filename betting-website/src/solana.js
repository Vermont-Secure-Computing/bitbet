import { AnchorProvider, Program, web3 } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idlBetting from "./idls/betting.json"; 
import idlTruth from "./idls/truth_network.json";

// Solana Devnet RPC
const SOLANA_RPC = "https://api.devnet.solana.com";
const connection = new Connection(SOLANA_RPC, "confirmed");

// Get Anchor Provider
const getProvider = (wallet) => {
    return new AnchorProvider(connection, wallet, { preflightCommitment: "confirmed" });
};

// Initialize Betting Program
const getBettingProgram = (wallet) => {
    return new Program(idlBetting, getProvider(wallet));
};

// Initialize Truth Network Program
const getTruthNetworkProgram = (wallet) => {
    return new Program(idlTruth, getProvider(wallet));
};

export { getBettingProgram, getTruthNetworkProgram };
