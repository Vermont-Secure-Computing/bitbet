import { Transaction, VersionedTransaction, TransactionMessage } from "@solana/web3.js";

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

/**
 * Send + confirm a list of instructions on the given connection.
 * Works with wallet-adapter wallets that support signTransaction.
 */
export async function sendAndConfirmIxs({ ixs, connection, wallet, feePayer }) {
  // Normalize wallet fields (supports either useWallet() object or a thin adapter)
  const wp = wallet || {};
  const publicKey       = wp.publicKey || wp?.adapter?.publicKey;
  const sendTransaction = wp.sendTransaction || wp?.adapter?.sendTransaction;
  const signTransaction = wp.signTransaction || wp?.adapter?.signTransaction;

  const payer = feePayer || publicKey;
  if (!payer) throw new Error("Missing feePayer/publicKey");
  if (!sendTransaction && !signTransaction)
    throw new Error("Wallet cannot sign transactions");

  // Try v0 first
  try {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("finalized");

    const msg = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions: ixs,
    }).compileToV0Message();

    const vtx = new VersionedTransaction(msg);

    let sig;
    if (sendTransaction) {
      // Wallet signs & sends
      sig = await sendTransaction(vtx, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });
    } else {
      // Manual sign + raw send
      const signed = await signTransaction(vtx);
      const raw = signed.serialize();
      sig = await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        maxRetries: 3,
      });
    }

    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    return sig;
  } catch (e) {
    // Fallback to legacy
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("finalized");
    const ltx = new Transaction({ recentBlockhash: blockhash, feePayer: payer });
    ixs.forEach((ix) => ltx.add(ix));

    let sig;
    if (sendTransaction) {
      sig = await sendTransaction(ltx, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });
    } else {
      const signed = await signTransaction(ltx);
      const raw = signed.serialize();
      sig = await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        maxRetries: 3,
      });
    }

    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    return sig;
  }
}
