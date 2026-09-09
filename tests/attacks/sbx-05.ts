import { PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import {
    provider,
    user,
    bettingProgram,
    truthProgram,
    ensureTestEnvironment,
    createTruthQuestion,
    createBettingMarket,
    sleep,
    getErrorCode,
} from "../helpers/solbetx-test-helpers";

describe("SBX-05", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-05 regression: delete_event rejects an unrelated finalized Truth question", async () => {
        const truthA = await createTruthQuestion(
            "SBX-05 legitimate Truth question A",
            10,
            15
        );

        const marketA = await createBettingMarket(
            "SBX-05 delete event target",
            truthA.question,
            5
        );

        const truthB = await createTruthQuestion(
            "SBX-05 unrelated Truth question B",
            10,
            15
        );

        const houseWallet = new PublicKey(
            "CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL"
        );

        if (!(await provider.connection.getAccountInfo(houseWallet))) {
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
        console.log("SBX-05 Market A:", marketA.question.toBase58());
        console.log("Market A linked Truth A:", truthA.question.toBase58());
        console.log("Attacker supplies Truth B:", truthB.question.toBase58());
        console.log("Waiting for close and reveal end...");

        await sleep(17_000);

        await bettingProgram.methods
            .fetchAndStoreWinner(truthA.id)
            .accounts({
                bettingQuestion: marketA.question,
                truthNetworkQuestion: truthA.question,
                truthNetworkProgram: truthProgram.programId,
                houseWallet,
                vault: marketA.vault,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        await truthProgram.methods
            .finalizeVoting(truthB.id)
            .accounts({
                question: truthB.question,
            })
            .rpc();

        await truthProgram.methods
            .drainUnclaimedReward()
            .accounts({
                question: truthB.question,
                vault: truthB.vault,
                feeReceiver: houseWallet,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(
            marketA.question
        );
        const truthABefore = await truthProgram.account.question.fetch(truthA.question);
        const truthBBefore = await truthProgram.account.question.fetch(truthB.question);

        console.log("");
        console.log("Before attack:");
        console.log("Market status:", marketBefore.status);
        console.log("Truth A finalized:", truthABefore.finalized);
        console.log("Truth B finalized:", truthBBefore.finalized);
        console.log("Truth B reward drained:", truthBBefore.rewardDrained);

        assert.equal(marketBefore.status, "close", "Market A must be closed");
        assert.equal(truthABefore.finalized, true, "Truth A should be finalized");
        assert.equal(truthBBefore.finalized, true, "Truth B should be finalized");
        assert.equal(truthBBefore.rewardDrained, true, "Truth B reward must be drained");

        console.log("");
        console.log("=== SBX-05 REGRESSION ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods
                .deleteEvent()
                .accounts({
                    bettingQuestion: marketA.question,
                    creator: user,
                    truthQuestion: truthB.question,
                    bettingVault: marketA.vault,
                    truthVault: truthB.vault,
                    truthNetworkProgram: truthProgram.programId,
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

        const marketAfter = await provider.connection.getAccountInfo(marketA.question);
        const bettingVaultAfter = await provider.connection.getAccountInfo(marketA.vault);
        const truthAAfter = await provider.connection.getAccountInfo(truthA.question);
        const truthBAfter = await provider.connection.getAccountInfo(truthB.question);

        console.log("");
        console.log("=== SBX-05 REGRESSION RESULT ===");
        console.log("Market A exists:", !!marketAfter);
        console.log("Market A vault exists:", !!bettingVaultAfter);
        console.log("Legitimate Truth A exists:", !!truthAAfter);
        console.log("Unrelated Truth B exists:", !!truthBAfter);

        assert.isNotNull(marketAfter, "Rejected attack must not delete Market A");
        assert.isNotNull(
            bettingVaultAfter,
            "Rejected attack must not delete Market A vault"
        );
        assert.isNotNull(
            truthAAfter,
            "Rejected attack must not delete legitimate Truth A"
        );
        assert.isNotNull(
            truthBAfter,
            "Rejected attack must not delete unrelated Truth B"
        );

        const marketStateAfter = await bettingProgram.account.bettingQuestion.fetch(
            marketA.question
        );

        assert.equal(
            marketStateAfter.questionPda.toBase58(),
            truthA.question.toBase58(),
            "Market A must remain linked to Truth A"
        );

        assert.equal(
            marketStateAfter.status,
            marketBefore.status,
            "Rejected attack must not change Market A status"
        );

        console.log("");
        console.log("SBX-05 PATCH VERIFIED");
    });
});