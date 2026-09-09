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

describe("SBX-30", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-30: bet one lamport below minimum is rejected with no state change", async () => {
        const amount = new BN(9_999_999);
        const truth = await createTruthQuestion("SBX-30 below minimum bet", 15, 25);
        const market = await createBettingMarket("SBX-30 below minimum bet", truth.question, 10);
        const bettor = deriveBettor(market.question);

        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultBefore = await provider.connection.getBalance(market.vault);
        const truthVaultBefore = await provider.connection.getBalance(truth.vault);

        console.log("");
        console.log("SBX-30 Market:", market.question.toBase58());
        console.log("Bettor:", user.toBase58());

        console.log("");
        console.log("=== SBX-30 BELOW-MINIMUM BET ATTACK ===");
        console.log("Attempted bet:", amount.toString());

        let rejected = false;
        let errorCode = "";

        try {
            await placeBet(
                market.question,
                market.vault,
                truth.question,
                truth.vault,
                bettor,
                amount,
                true
            );
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const bettorAfter = await bettingProgram.account.bettorAccount.fetchNullable(bettor);
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const truthVaultAfter = await provider.connection.getBalance(truth.vault);

        console.log("");
        console.log("=== SBX-30 RESULT ===");
        console.log("Bet rejected:", rejected);
        console.log("Error:", errorCode);
        console.log("Bettor account exists:", bettorAfter !== null);
        console.log("Gross bets:", marketAfter.totalBetsBeforeCommission.toString());
        console.log("TRUE pool:", marketAfter.totalBetsOption1.toString());
        console.log("FALSE pool:", marketAfter.totalBetsOption2.toString());
        console.log("Net pool:", marketAfter.totalPool.toString());
        console.log("Bettor records:", marketAfter.bettorRecordsCount.toString());
        console.log("Betting vault change:", vaultAfter - vaultBefore);
        console.log("Truth vault change:", truthVaultAfter - truthVaultBefore);

        assert.equal(rejected, true, "Below-minimum bet must be rejected");
        assert.include(errorCode, "MinimumBetNotMet", "Expected MinimumBetNotMet");
        assert.isNull(bettorAfter, "Rejected bet must not leave a bettor account");
        assert.equal(marketAfter.totalBetsBeforeCommission.toString(), marketBefore.totalBetsBeforeCommission.toString());
        assert.equal(marketAfter.totalBetsOption1.toString(), marketBefore.totalBetsOption1.toString());
        assert.equal(marketAfter.totalBetsOption2.toString(), marketBefore.totalBetsOption2.toString());
        assert.equal(marketAfter.totalPool.toString(), marketBefore.totalPool.toString());
        assert.equal(marketAfter.bettorRecordsCount.toString(), marketBefore.bettorRecordsCount.toString());
        assert.equal(vaultAfter, vaultBefore, "Betting vault must remain unchanged");
        assert.equal(truthVaultAfter, truthVaultBefore, "Truth vault must remain unchanged");

        console.log("");
        console.log("SBX-30 BELOW-MINIMUM BET PROTECTION VERIFIED");
    });
});