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
    sleep,
    getErrorCode,
} from "../helpers/solbetx-test-helpers";

describe("SBX-02", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-02 regression: claim_winnings rejects claim before result is stored", async () => {
        const betAmount = new BN(100_000_000);

        const truth = await createTruthQuestion(
            "SBX-02 legitimate Truth question A",
            60,
            120
        );

        const market = await createBettingMarket(
            "SBX-02 claim before result stored",
            truth.question,
            6
        );

        const bettorPda = deriveBettor(market.question);

        await placeBet(
            market.question,
            market.vault,
            truth.question,
            truth.vault,
            bettorPda,
            betAmount,
            true
        );

        console.log("");
        console.log("SBX-02 Market:", market.question.toBase58());
        console.log("Bettor:", bettorPda.toBase58());
        console.log("Waiting for betting market to close...");

        await sleep(7_000);

        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(
            market.question
        );
        const bettorBefore = await bettingProgram.account.bettorAccount.fetch(
            bettorPda
        );
        const vaultBefore = await provider.connection.getBalance(market.vault);

        assert.equal(
            marketBefore.status,
            "open",
            "Result must not be stored before attack"
        );

        assert.equal(
            bettorBefore.claimed,
            false,
            "Bettor must be unclaimed before attack"
        );

        console.log("");
        console.log("=== SBX-02 REGRESSION ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods
                .claimWinnings()
                .accounts({
                    bettingQuestion: market.question,
                    bettorAccount: bettorPda,
                    user,
                    vault: market.vault,
                })
                .rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        assert.equal(
            rejected,
            true,
            "Claim before result is stored must be rejected"
        );

        assert.include(
            String(errorCode),
            "WinnerNotStored",
            "Expected WinnerNotStored"
        );

        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(
            market.question
        );
        const bettorAfter = await bettingProgram.account.bettorAccount.fetch(
            bettorPda
        );
        const vaultAfter = await provider.connection.getBalance(market.vault);

        console.log("");
        console.log("=== SBX-02 REGRESSION RESULT ===");
        console.log("Market status:", marketAfter.status);
        console.log("Market winner:", marketAfter.winner);
        console.log("Market percentage:", marketAfter.winningPercentage);
        console.log("Bettor claimed:", bettorAfter.claimed);
        console.log("Bettor winnings:", bettorAfter.winnings.toString());
        console.log("Vault reduction:", vaultBefore - vaultAfter);

        assert.equal(
            marketAfter.status,
            marketBefore.status,
            "Rejected claim must not change market status"
        );

        assert.equal(
            marketAfter.winner,
            marketBefore.winner,
            "Rejected claim must not change winner"
        );

        assert.equal(
            marketAfter.winningPercentage,
            marketBefore.winningPercentage,
            "Rejected claim must not change winning percentage"
        );

        assert.equal(
            bettorAfter.claimed,
            false,
            "Rejected claim must not mark bettor claimed"
        );

        assert.equal(
            bettorAfter.winnings.toString(),
            bettorBefore.winnings.toString(),
            "Rejected claim must not change bettor winnings"
        );

        assert.equal(
            vaultAfter,
            vaultBefore,
            "Rejected claim must not remove SOL from vault"
        );

        console.log("");
        console.log("SBX-02 PATCH VERIFIED");
    });
});