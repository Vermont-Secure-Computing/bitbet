import { BN } from "@coral-xyz/anchor";
import { Keypair, SystemProgram } from "@solana/web3.js";
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

describe("SBX-09", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-09 regression: unauthorized wallet cannot claim creator commission", async () => {
        const truth = await createTruthQuestion(
            "SBX-09 Truth question",
            60,
            120
        );

        const market = await createBettingMarket(
            "SBX-09 Market",
            truth.question,
            5
        );

        const bettor = deriveBettor(market.question);
        const betAmount = new BN(1_000_000_000);

        await placeBet(
            market.question,
            market.vault,
            truth.question,
            truth.vault,
            bettor,
            betAmount,
            true
        );

        const attacker = Keypair.generate();
        const airdrop = await provider.connection.requestAirdrop(
            attacker.publicKey,
            100_000_000
        );
        const latest = await provider.connection.getLatestBlockhash();

        await provider.connection.confirmTransaction(
            { signature: airdrop, ...latest },
            "confirmed"
        );

        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(
            market.question
        );
        const vaultBefore = await provider.connection.getBalance(market.vault);
        const attackerBefore = await provider.connection.getBalance(attacker.publicKey);

        console.log("");
        console.log("SBX-09 Market:", market.question.toBase58());
        console.log("Legitimate creator:", marketBefore.creator.toBase58());
        console.log("Attacker:", attacker.publicKey.toBase58());
        console.log("Creator commission:", marketBefore.totalCreatorCommission.toString());
        console.log("Waiting for market close...");

        await sleep(6_000);

        console.log("");
        console.log("=== SBX-09 REGRESSION ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods
                .claimCreatorCommission()
                .accounts({
                    bettingQuestion: market.question,
                    creator: attacker.publicKey,
                    vault: market.vault,
                    systemProgram: SystemProgram.programId,
                })
                .signers([attacker])
                .rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        assert.equal(
            rejected,
            true,
            "Unauthorized wallet must be rejected"
        );

        assert.include(
            String(errorCode),
            "UnauthorizedCreator",
            "Expected UnauthorizedCreator"
        );

        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(
            market.question
        );
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const attackerAfter = await provider.connection.getBalance(attacker.publicKey);

        console.log("");
        console.log("=== SBX-09 REGRESSION RESULT ===");
        console.log("Attacker balance change:", attackerAfter - attackerBefore);
        console.log("Vault reduction:", vaultBefore - vaultAfter);
        console.log("Commission claimed:", marketAfter.creatorCommissionClaimed);

        assert.equal(
            attackerAfter,
            attackerBefore,
            "Attacker balance must not change"
        );

        assert.equal(
            vaultAfter,
            vaultBefore,
            "Market vault must not change"
        );

        assert.equal(
            marketAfter.creatorCommissionClaimed,
            false,
            "Commission must remain unclaimed"
        );

        assert.equal(
            marketAfter.totalCreatorCommission.toString(),
            marketBefore.totalCreatorCommission.toString(),
            "Creator commission amount must remain unchanged"
        );

        console.log("");
        console.log("SBX-09 PATCH VERIFIED");
    });
});