/**
 * Takes an Anchor method builder and accounts, runs .simulate() (nice errors),
 * then returns a built TransactionInstruction.
 *
 * Usage:
 *   const ix = await simulateAndBuildIx(
 *     program.methods.placeBet(lamports, isOption1),
 *     { bettingQuestion, vault, ... }
 *   );
 */
export const simulateAndBuildIx = async (methodBuilder, accounts) => {
    try {
      await methodBuilder.accounts(accounts).simulate();
    } catch (simErr) {
      const logs =
        simErr?.logs ||
        simErr?.error?.logs ||
        (Array.isArray(simErr) ? simErr : []);
      const msg = simErr?.message || "Simulation failed";
      const e = new Error(msg);
      e.logs = logs;
      throw e;
    }
    return methodBuilder.accounts(accounts).instruction();
  };
  