import { AnchorProvider, Program, setProvider } from "@coral-xyz/anchor";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import truthIdl from "../idls/truth_network.json";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

const provider = new AnchorProvider(connection, window.solana, {
  preflightCommitment: "confirmed",
});
setProvider(provider);

const program = new Program(truthIdl, provider);

export { connection, provider, program };
