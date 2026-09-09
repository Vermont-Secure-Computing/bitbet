import { PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import {
    provider,
    bettingProgram,
    truthProgram,
    ensureTestEnvironment,
    createTruthQuestion,
    createBettingMarket,
    sleep,
    getErrorCode,
} from "../helpers/solbetx-test-helpers";

describe("SBX-03", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-03 regression: fetch_and_store_winner rejects an unrelated Truth question", async () => {
        const truthA = await createTruthQuestion(
            "SBX-03 legitimate Truth question A",
            60,
            120
        );

        const marketA = await createBettingMarket(
            "SBX-03 oracle substitution target",
            truthA.question,
            6
        );

        const truthB = await createTruthQuestion(
            "SBX-03 unrelated Truth question B",
            3,
            6
        );

        console.log("");
        console.log("SBX-03 market linked to Truth A:", truthA.question.toBase58());
        console.log("Attacker will supply Truth B:", truthB.question.toBase58());
        console.log("Waiting for market close and Truth B reveal end...");

        await sleep(9_000);

        const truthABefore = await truthProgram.account.question.fetch(truthA.question);
        const truthBBefore = await truthProgram.account.question.fetch(truthB.question);
        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(
            marketA.question
        );

        assert.equal(
            truthABefore.finalized,
            false,
            "Legitimate Truth A must still be unresolved"
        );

        assert.equal(
            truthBBefore.finalized,
            false,
            "Unrelated Truth B should not yet be finalized"
        );

        assert.equal(
            marketBefore.status,
            "open",
            "Target market should still be open/unresolved"
        );

        const houseWallet = new PublicKey(
            "CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL"
        );

        const houseInfo = await provider.connection.getAccountInfo(houseWallet);

        if (!houseInfo) {
            const signature = await provider.connection.requestAirdrop(
                houseWallet,
                1_000_000
            );

            const latest = await provider.connection.getLatestBlockhash();

            await provider.connection.confirmTransaction(
                { signature, ...latest },
                "confirmed"
            );
        }

        console.log("");
        console.log("=== SBX-03 REGRESSION ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods
                .fetchAndStoreWinner(truthB.id)
                .accounts({
                    bettingQuestion: marketA.question,
                    truthNetworkQuestion: truthB.question,
                    truthNetworkProgram: truthProgram.programId,
                    houseWallet,
                    vault: marketA.vault,
                    systemProgram: SystemProgram.programId,
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
            "Unrelated Truth question must be rejected"
        );

        assert.include(
            String(errorCode),
            "TruthQuestionMismatch",
            "Expected TruthQuestionMismatch"
        );

        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(
            marketA.question
        );
        const truthAAfter = await truthProgram.account.question.fetch(truthA.question);
        const truthBAfter = await truthProgram.account.question.fetch(truthB.question);

        console.log("");
        console.log("=== SBX-03 REGRESSION RESULT ===");
        console.log("Market status:", marketAfter.status);
        console.log("Market winner:", marketAfter.winner);
        console.log("Market percentage:", marketAfter.winningPercentage);
        console.log("Truth A finalized:", truthAAfter.finalized);
        console.log("Truth B finalized:", truthBAfter.finalized);

        assert.equal(
            marketAfter.questionPda.toBase58(),
            truthA.question.toBase58(),
            "Market must remain linked to Truth A"
        );

        assert.equal(
            marketAfter.status,
            marketBefore.status,
            "Rejected attack must not change market status"
        );

        assert.equal(
            marketAfter.winner,
            marketBefore.winner,
            "Rejected attack must not change market winner"
        );

        assert.equal(
            marketAfter.winningPercentage,
            marketBefore.winningPercentage,
            "Rejected attack must not change winning percentage"
        );

        assert.equal(
            truthAAfter.finalized,
            truthABefore.finalized,
            "Legitimate Truth A must remain unchanged"
        );

        assert.equal(
            truthBAfter.finalized,
            truthBBefore.finalized,
            "Rejected attack must not finalize unrelated Truth B"
        );

        console.log("");
        console.log("SBX-03 PATCH VERIFIED");
    });
});