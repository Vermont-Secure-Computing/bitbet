import { buildClients } from "./rpcClient";
import { getConstants } from "../constants";
import { isTransientRpcError } from "./txUtils"; // you already have it

/**
 * Simulate the given Anchor method builder against rotating RPCs
 * and return { ix, conn, rpc } of the first that works.
 */
export async function simulateAndBuildIxWithFallback({ methodBuilder, accounts, wallet }) {
    const tried = new Set();
    const c = getConstants();

    const candidates = [
        localStorage.getItem("customRpcUrl") || "",
        localStorage.getItem("lastWorkingRpc") || "",
        ...(Array.isArray(c.FALLBACK_RPC_URLS) ? c.FALLBACK_RPC_URLS : []),
        c.DEFAULT_RPC_URL,
    ].filter(Boolean);

    let lastErr = null;

    for (const rpc of candidates) {
        if (tried.has(rpc)) continue;
        tried.add(rpc);

        const { conn } = buildClients(rpc, wallet);

        try {
            const ix = await methodBuilder.accounts(accounts).instruction();
            localStorage.setItem("lastWorkingRpc", rpc);
            return { ix, conn, rpc };
        } catch (err) {
            lastErr = err;
            const m = String(err?.message || "");

            // If it’s a genuine program error, no point rotating RPCs further
            if (!isTransientRpcError(err) && !/blockhash|behind|too many|rate limit|unavailable|timeout/i.test(m)) {
                break;
            }
            // else try next RPC
        }
    }

    throw lastErr;
}
