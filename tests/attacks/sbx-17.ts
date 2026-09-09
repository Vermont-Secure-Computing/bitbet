import { BN } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
    provider,
    user,
    bettingProgram,
    ensureTestEnvironment,
    createTruthQuestion,
    createBettingMarket,
    deriveBettor,
    placeBet,
    getErrorCode,
} from "../helpers/solbetx-test-helpers";

describe("SBX-17", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-17: bettor cannot claim while betting is active", async () => {
        const betAmount = new BN(100_000_000);
        const truth = await createTruthQuestion("SBX-17 active market claim", 20, 30);
        const market = await createBettingMarket("SBX-17 active market claim", truth.question, 15);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-17 Market:", market.question.toBase58());
        console.log("Bettor:", user.toBase58());

        console.log("");
        console.log("STEP 1: bettor places 0.1 SOL TRUE");
        await placeBet(market.question, market.vault, truth.question, truth.vault, bettor, betAmount, true);

        const bettorBefore = await bettingProgram.account.bettorAccount.fetch(bettor);
        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultBefore = await provider.connection.getBalance(market.vault);

        console.log("Market status:", marketBefore.status);
        console.log("Claimed before:", bettorBefore.claimed);

        console.log("");
        console.log("=== SBX-17 ACTIVE CLAIM ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods.claimWinnings().accounts({
                bettingQuestion: market.question,
                bettorAccount: bettor,
                user,
                vault: market.vault,
            }).rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        const bettorAfter = await bettingProgram.account.bettorAccount.fetch(bettor);
        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultAfter = await provider.connection.getBalance(market.vault);

        console.log("");
        console.log("=== SBX-17 RESULT ===");
        console.log("Claim rejected:", rejected);
        console.log("Error:", errorCode);
        console.log("Market status before:", marketBefore.status);
        console.log("Market status after:", marketAfter.status);
        console.log("Vault change:", vaultAfter - vaultBefore);
        console.log("Claimed before:", bettorBefore.claimed);
        console.log("Claimed after:", bettorAfter.claimed);
        console.log("Winnings before:", bettorBefore.winnings.toString());
        console.log("Winnings after:", bettorAfter.winnings.toString());

        assert.equal(rejected, true, "Active-market claim must be rejected");
        assert.include(String(errorCode), "WinnerNotStored", "Expected WinnerNotStored");
        assert.equal(vaultAfter, vaultBefore, "Vault must remain unchanged");
        assert.equal(bettorAfter.claimed, false, "Bettor must remain unclaimed");
        assert.equal(bettorAfter.winnings.toString(), "0", "Winnings must remain zero");
        assert.equal(marketAfter.status, marketBefore.status, "Market status must remain unchanged");

        console.log("");
        console.log("SBX-17 ACTIVE MARKET CLAIM PROTECTION VERIFIED");
    });
});