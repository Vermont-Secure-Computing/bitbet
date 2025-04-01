import { Connection, clusterApiUrl } from "@solana/web3.js";
import { AnchorProvider, Program, setProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "../idls/betting.json";

const BETTING_CONTRACT_PROGRAM_ID = new PublicKey(import.meta.env.VITE_BETTING_PROGRAM_ID);

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

const provider = new AnchorProvider(connection, window.solana, {
  preflightCommitment: "confirmed",
});

setProvider(provider);

const bettingProgram = new Program(idl, provider);

export { connection, provider, bettingProgram, BETTING_CONTRACT_PROGRAM_ID};
