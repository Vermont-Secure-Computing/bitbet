import { Connection, Transaction, PublicKey } from "@solana/web3.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const isTransientRpcError = (err) => {
  const m = String(err?.message || "").toLowerCase();
  return (
    m.includes("blockhash not found") ||
    m.includes("block height exceeded") ||
    m.includes("node is behind") ||
    m.includes("too many requests") ||
    m.includes("rate limit") ||
    m.includes("service unavailable") ||
    m.includes("gateway timeout") ||
    m.includes("timeout") ||
    m.includes("connection closed") ||
    m.includes("failed to fetch")
  );
};

/** Wait for signature via WS first, then poll as fallback */
export const waitForSig = async (connection, sig, timeoutMs = 90_000) => {
  let subId = null;
  let done = false;
  let lastStatus = null;

  const timeout = setTimeout(() => {
    if (!done) done = true;
  }, timeoutMs);

  try {
    // 1) WebSocket subscription (best-effort)
    try {
      await new Promise((resolve, reject) => {
        subId = connection.onSignature(
          sig,
          (notif) => {
            lastStatus = notif;
            if (notif?.err) {
              const e = new Error("Transaction failed on-chain");
              e.status = notif;
              reject(e);
            } else {
              resolve();
            }
          },
          "confirmed"
        );
      });
      done = true;
      return lastStatus || { confirmationStatus: "confirmed" };
    } catch {
      // fall through to polling
    }

    // 2) Polling fallback
    const start = Date.now();
    while (!done && Date.now() - start < timeoutMs) {
      const { value } = await connection.getSignatureStatuses([sig], {
        searchTransactionHistory: true,
      });
      const st = value?.[0];
      lastStatus = st || lastStatus;

      if (st) {
        if (st.err) {
          const e = new Error("Transaction failed on-chain");
          e.status = st;
          throw e;
        }
        if (
          st.confirmations === null ||
          st.confirmationStatus === "confirmed" ||
          st.confirmationStatus === "finalized"
        ) {
          done = true;
          return st;
        }
      }
      await sleep(1200);
    }

    const e = new Error("Confirmation timeout");
    e.status = lastStatus;
    throw e;
  } finally {
    clearTimeout(timeout);
    if (subId !== null) {
      try {
        await connection.removeSignatureListener(subId);
      } catch {}
    }
  }
};

/**
 * Common send + confirm for a single TransactionInstruction
 * wallet: Wallet Adapter (has sendTransaction)
 */
export const sendAndConfirmIx = async (
  ix,
  { connection, wallet, feePayer, preflightCommitment = "confirmed", waitMs = 90_000 }
) => {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash(preflightCommitment);

  const tx = new Transaction({
    feePayer,
    recentBlockhash: blockhash,
  }).add(ix);

  let sig;
  try {
    sig = await wallet.sendTransaction(tx, connection);
  } catch (sendErr) {
    if (isTransientRpcError(sendErr)) {
      const e = new Error("Network busy; submission uncertain");
      e.code = "TRANSIENT_SEND";
      e.original = sendErr;
      throw e;
    }
    throw sendErr;
  }

  // best-effort quick confirm
  try {
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
  } catch {
    // proceed to waitForSig
  }

  await waitForSig(connection, sig, waitMs);
  return sig;
};
