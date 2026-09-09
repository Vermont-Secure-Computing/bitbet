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

describe("SBX-06", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-06 regression: claim_winnings rejects a bettor account from another market", async () => {
        const truthA = await createTruthQuestion(
            "SBX-06 Truth question A",
            60,
            120
        );

        const marketA = await createBettingMarket(
            "SBX-06 Market A",
            truthA.question,
            30
        );

        const bettorA = deriveBettor(marketA.question);
        const betAmount = new BN(10_000_000);

        await placeBet(
            marketA.question,
            marketA.vault,
            truthA.question,
            truthA.vault,
            bettorA,
            betAmount,
            true
        );

        const truthB = await createTruthQuestion(
            "SBX-06 Truth question B",
            60,
            120
        );

        const marketB = await createBettingMarket(
            "SBX-06 Market B",
            truthB.question,
            30
        );

        const bettorBefore = await bettingProgram.account.bettorAccount.fetch(bettorA);
        const vaultBefore = await provider.connection.getBalance(marketB.vault);

        console.log("");
        console.log("SBX-06 bettor belongs to Market A:", marketA.question.toBase58());
        console.log("Attacker supplies Market B:", marketB.question.toBase58());
        console.log("Bettor account:", bettorA.toBase58());
        console.log("");
        console.log("=== SBX-06 REGRESSION ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods
                .claimWinnings()
                .accounts({
                    bettingQuestion: marketB.question,
                    bettorAccount: bettorA,
                    user,
                    vault: marketB.vault,
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
            "Bettor account from Market A must not work with Market B"
        );

        assert.isTrue(
            String(errorCode).includes("ConstraintSeeds") ||
            String(errorCode).includes("InvalidBettingQuestion"),
            `Expected ConstraintSeeds or InvalidBettingQuestion, got: ${errorCode}`
        );

        const bettorAfter = await bettingProgram.account.bettorAccount.fetch(bettorA);
        const vaultAfter = await provider.connection.getBalance(marketB.vault);

        console.log("");
        console.log("=== SBX-06 REGRESSION RESULT ===");
        console.log("Rejected with:", errorCode);
        console.log("Bettor market:", bettorAfter.questionPda.toBase58());
        console.log("Bettor claimed:", bettorAfter.claimed);
        console.log("Bettor winnings:", bettorAfter.winnings.toString());
        console.log("Market B vault reduction:", vaultBefore - vaultAfter);

        assert.equal(
            bettorAfter.questionPda.toBase58(),
            marketA.question.toBase58(),
            "Bettor must remain associated with Market A"
        );

        assert.equal(
            bettorAfter.claimed,
            bettorBefore.claimed,
            "Rejected attack must not mark bettor claimed"
        );

        assert.equal(
            bettorAfter.winnings.toString(),
            bettorBefore.winnings.toString(),
            "Rejected attack must not change bettor winnings"
        );

        assert.equal(
            vaultAfter,
            vaultBefore,
            "Rejected attack must not remove SOL from Market B vault"
        );

        console.log("");
        console.log("SBX-06 PATCH VERIFIED");
    });
});