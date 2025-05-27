import { AnchorProvider, Program, setProvider } from "@coral-xyz/anchor";
import { Connection, clusterApiUrl } from "@solana/web3.js";

import { getIdls } from "../idls";
const { truthNetworkIDL } = await getIdls();

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

const provider = new AnchorProvider(connection, window.solana, {
  preflightCommitment: "confirmed",
});
setProvider(provider);

const program = new Program(truthNetworkIDL, provider);

export { connection, provider, program };
