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

describe("SBX-04", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-04 delete_bettor_account rejects deletion before SolBetX has stored the result", async () => {
        const truthA = await createTruthQuestion(
            "SBX-04 legitimate Truth question A",
            60,
            120
        );

        const marketA = await createBettingMarket(
            "SBX-04 bettor deletion target",
            truthA.question,
            6
        );

        const targetBettorPda = deriveBettor(marketA.question);

        await placeBet(
            marketA.question,
            marketA.vault,
            truthA.question,
            truthA.vault,
            targetBettorPda,
            new BN(10_000_000),
            true
        );

        console.log("");
        console.log("SBX-04 Market:", marketA.question.toBase58());
        console.log("Truth question:", truthA.question.toBase58());
        console.log("Bettor:", targetBettorPda.toBase58());
        console.log("Waiting for betting market to close...");

        await sleep(7_000);

        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(
            marketA.question
        );
        const bettorBefore = await bettingProgram.account.bettorAccount.fetch(
            targetBettorPda
        );
        const bettorAccountInfoBefore = await provider.connection.getAccountInfo(
            targetBettorPda
        );

        assert.equal(
            marketBefore.status,
            "open",
            "Result must not be stored before attack"
        );

        assert.equal(
            bettorBefore.claimed,
            false,
            "Bettor must still be unclaimed"
        );

        assert.isNotNull(
            bettorAccountInfoBefore,
            "Bettor account must exist before attack"
        );

        console.log("");
        console.log("=== SBX-04 REGRESSION ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods
                .deleteBettorAccount()
                .accounts({
                    user,
                    bettorAccount: targetBettorPda,
                    bettingQuestion: marketA.question,
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
            "Bettor deletion before result is stored must be rejected"
        );

        assert.include(
            String(errorCode),
            "WinnerNotStored",
            "Expected WinnerNotStored"
        );

        const bettorAccountInfoAfter = await provider.connection.getAccountInfo(
            targetBettorPda
        );
        const bettorAfter = await bettingProgram.account.bettorAccount.fetch(
            targetBettorPda
        );
        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(
            marketA.question
        );

        console.log("");
        console.log("=== SBX-04 REGRESSION RESULT ===");
        console.log("Bettor account exists:", !!bettorAccountInfoAfter);
        console.log("Market status:", marketAfter.status);
        console.log("Market winner:", marketAfter.winner);
        console.log("Market percentage:", marketAfter.winningPercentage);
        console.log("Bettor claimed:", bettorAfter.claimed);
        console.log("Bettor amount:", bettorAfter.betAmount.toString());
        console.log("Bettor records closed:", marketAfter.bettorRecordsClosed.toString());

        assert.isNotNull(
            bettorAccountInfoAfter,
            "Rejected deletion must not delete bettor account"
        );

        assert.equal(
            marketAfter.status,
            marketBefore.status,
            "Rejected deletion must not change market status"
        );

        assert.equal(
            marketAfter.winner,
            marketBefore.winner,
            "Rejected deletion must not change winner"
        );

        assert.equal(
            marketAfter.winningPercentage,
            marketBefore.winningPercentage,
            "Rejected deletion must not change winning percentage"
        );

        assert.equal(
            marketAfter.bettorRecordsClosed.toString(),
            marketBefore.bettorRecordsClosed.toString(),
            "Rejected deletion must not increment bettor_records_closed"
        );

        assert.equal(
            bettorAfter.claimed,
            bettorBefore.claimed,
            "Rejected deletion must not change claimed state"
        );

        assert.equal(
            bettorAfter.chosenOption,
            bettorBefore.chosenOption,
            "Rejected deletion must not change bettor side"
        );

        assert.equal(
            bettorAfter.betAmount.toString(),
            bettorBefore.betAmount.toString(),
            "Rejected deletion must not change bettor amount"
        );

        console.log("");
        console.log("SBX-04 PATCH VERIFIED");
    });
});