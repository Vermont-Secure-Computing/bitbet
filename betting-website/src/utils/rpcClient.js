import { Connection, ComputeBudgetProgram } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { getIdls } from "../idls";
import { getConstants } from "../constants";

export const pickRpcForWrite = () => {
    const custom = localStorage.getItem("customRpcUrl");
    const last   = localStorage.getItem("lastWorkingRpc");
    const { DEFAULT_RPC_URL } = getConstants();
    return custom || last || DEFAULT_RPC_URL;
};

export const buildClients = (rpcUrl, wallet) => {
    const conn = new Connection(rpcUrl, "confirmed");
    const provider = new AnchorProvider(conn, wallet, { preflightCommitment: "processed" });
    const { bettingIDL, truthNetworkIDL } = getIdls();
    const bettingProgram = new Program(bettingIDL, provider);
    const truthProgram   = new Program(truthNetworkIDL, provider);
    return { conn, bettingProgram, truthProgram, provider };
};

export const computeBudgetIxs = () => ([
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    // ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 2000 }), //for tip
]);
