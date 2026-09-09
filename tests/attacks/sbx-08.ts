import { BN } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import {
    provider,
    user,
    bettingProgram,
    truthProgram,
    ensureTestEnvironment,
    createTruthQuestion,
    createBettingMarket,
    deriveBettor,
    getErrorCode,
} from "../helpers/solbetx-test-helpers";

describe("SBX-08", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-08 regression: place_bet rejects an unrelated Truth question", async () => {
        const truthA = await createTruthQuestion(
            "SBX-08 legitimate Truth A",
            60,
            120
        );

        const marketA = await createBettingMarket(
            "SBX-08 Market A",
            truthA.question,
            30
        );

        const truthB = await createTruthQuestion(
            "SBX-08 unrelated Truth B",
            60,
            120
        );

        const bettor = deriveBettor(marketA.question);
        const betAmount = new BN(1_000_000_000);

        console.log("");
        console.log("SBX-08 Market A linked Truth:", truthA.question.toBase58());
        console.log("Attacker supplies Truth B:", truthB.question.toBase58());
        console.log("Truth B vault:", truthB.vault.toBase58());
        console.log("");
        console.log("=== SBX-08 REGRESSION ATTACK ===");

        const truthAVaultBefore = await provider.connection.getBalance(truthA.vault);
        const truthBVaultBefore = await provider.connection.getBalance(truthB.vault);
        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(
            marketA.question
        );
        const bettorBefore = await provider.connection.getAccountInfo(bettor);

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods
                .placeBet(betAmount, true)
                .accounts({
                    bettingQuestion: marketA.question,
                    bettorAccount: bettor,
                    user,
                    vault: marketA.vault,
                    truthNetworkQuestion: truthB.question,
                    betProgram: bettingProgram.programId,
                    truthNetworkProgram: truthProgram.programId,
                    systemProgram: SystemProgram.programId,
                    truthNetworkVault: truthB.vault,
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

        const truthAVaultAfter = await provider.connection.getBalance(truthA.vault);
        const truthBVaultAfter = await provider.connection.getBalance(truthB.vault);
        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(
            marketA.question
        );
        const bettorAfter = await provider.connection.getAccountInfo(bettor);

        console.log("");
        console.log("=== SBX-08 REGRESSION RESULT ===");
        console.log("Truth A vault change:", truthAVaultAfter - truthAVaultBefore);
        console.log("Truth B vault change:", truthBVaultAfter - truthBVaultBefore);
        console.log(
            "Market TRUE change:",
            marketAfter.totalBetsOption1.sub(marketBefore.totalBetsOption1).toString()
        );
        console.log("Bettor account exists before:", !!bettorBefore);
        console.log("Bettor account exists after:", !!bettorAfter);

        assert.equal(
            truthAVaultAfter,
            truthAVaultBefore,
            "Legitimate Truth vault must not change"
        );

        assert.equal(
            truthBVaultAfter,
            truthBVaultBefore,
            "Unrelated Truth vault must not change"
        );

        assert.equal(
            marketAfter.totalBetsOption1.toString(),
            marketBefore.totalBetsOption1.toString(),
            "Market TRUE total must not change"
        );

        assert.equal(
            marketAfter.totalBetsOption2.toString(),
            marketBefore.totalBetsOption2.toString(),
            "Market FALSE total must not change"
        );

        assert.equal(
            !!bettorAfter,
            !!bettorBefore,
            "Rejected attack must not create a bettor account"
        );

        console.log("");
        console.log("SBX-08 PATCH VERIFIED");
    });
});