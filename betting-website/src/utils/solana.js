import { Connection, clusterApiUrl } from "@solana/web3.js";
import { AnchorProvider, Program, setProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getIdls } from "../idls";
import constants from "../constants";

const { bettingIDL } = await getIdls();

const BETTING_CONTRACT_PROGRAM_ID = constants.BETTING_CONTRACT_PROGRAM_ID;

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

const provider = new AnchorProvider(connection, window.solana, {
  preflightCommitment: "confirmed",
});

setProvider(provider);

const bettingProgram = new Program(bettingIDL, provider);

export { connection, provider, bettingProgram, BETTING_CONTRACT_PROGRAM_ID};
