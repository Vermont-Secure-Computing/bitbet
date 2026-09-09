import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import {
    provider,
    bettingProgram,
    truthProgram,
    ensureTestEnvironment,
    createTruthQuestion,
    createBettingMarket,
    deriveBettor,
    placeBet,
    makeTruthWinner,
} from "../helpers/solbetx-test-helpers";

describe("SBX-40", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-40: independent markets and Truth questions cannot contaminate each other", async () => {
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");

        console.log("");
        console.log("STEP 1: create independent Truth questions and markets");

        const truthA = await createTruthQuestion("SBX-40 Truth A", 10, 20);
        const marketA = await createBettingMarket("SBX-40 Market A", truthA.question, 5);
        const bettorA = deriveBettor(marketA.question);

        const truthB = await createTruthQuestion("SBX-40 Truth B", 10, 20);
        const marketB = await createBettingMarket("SBX-40 Market B", truthB.question, 5);
        const bettorB = deriveBettor(marketB.question);

        console.log("Market A:", marketA.question.toBase58());
        console.log("Truth A:", truthA.question.toBase58());
        console.log("Vault A:", marketA.vault.toBase58());
        console.log("Market B:", marketB.question.toBase58());
        console.log("Truth B:", truthB.question.toBase58());
        console.log("Vault B:", marketB.vault.toBase58());

        assert.notEqual(marketA.question.toBase58(), marketB.question.toBase58());
        assert.notEqual(truthA.question.toBase58(), truthB.question.toBase58());
        assert.notEqual(marketA.vault.toBase58(), marketB.vault.toBase58());
        assert.notEqual(bettorA.toBase58(), bettorB.toBase58());

        console.log("");
        console.log("STEP 2: place different bets in each market");

        await placeBet(
            marketA.question,
            marketA.vault,
            truthA.question,
            truthA.vault,
            bettorA,
            new BN(100_000_000),
            true
        );

        await placeBet(
            marketB.question,
            marketB.vault,
            truthB.question,
            truthB.vault,
            bettorB,
            new BN(200_000_000),
            false
        );

        const aAfterBets = await bettingProgram.account.bettingQuestion.fetch(marketA.question);
        const bAfterBets = await bettingProgram.account.bettingQuestion.fetch(marketB.question);

        console.log("A TRUE pool:", aAfterBets.totalBetsOption1.toString());
        console.log("A FALSE pool:", aAfterBets.totalBetsOption2.toString());
        console.log("B TRUE pool:", bAfterBets.totalBetsOption1.toString());
        console.log("B FALSE pool:", bAfterBets.totalBetsOption2.toString());

        assert.equal(aAfterBets.totalBetsOption1.toString(), "100000000");
        assert.equal(aAfterBets.totalBetsOption2.toString(), "0");
        assert.equal(bAfterBets.totalBetsOption1.toString(), "0");
        assert.equal(bAfterBets.totalBetsOption2.toString(), "200000000");

        console.log("");
        console.log("STEP 3: resolve Truth A as TRUE and Truth B as FALSE");

        await Promise.all([
            makeTruthWinner(truthA.question, truthA.id, 1, 11_000, 10_000),
            makeTruthWinner(truthB.question, truthB.id, 2, 11_000, 10_000),
        ]);

        console.log("STEP 4: settle Market A only");

        const bBeforeASettlement = await bettingProgram.account.bettingQuestion.fetch(marketB.question);
        const vaultBBeforeASettlement = await provider.connection.getBalance(marketB.vault);

        await bettingProgram.methods.fetchAndStoreWinner(truthA.id).accounts({
            bettingQuestion: marketA.question,
            truthNetworkQuestion: truthA.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: marketA.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        const aSettled = await bettingProgram.account.bettingQuestion.fetch(marketA.question);
        const bAfterASettlement = await bettingProgram.account.bettingQuestion.fetch(marketB.question);
        const vaultBAfterASettlement = await provider.connection.getBalance(marketB.vault);

        console.log("A status:", aSettled.status);
        console.log("A winner:", aSettled.winner);
        console.log("A percentage:", aSettled.winningPercentage);
        console.log("B status after A settlement:", bAfterASettlement.status);
        console.log("B winner after A settlement:", bAfterASettlement.winner);

        assert.equal(aSettled.status, "close");
        assert.equal(aSettled.winner, 1);
        assert.equal(aSettled.winningPercentage, 100);

        assert.equal(bAfterASettlement.status, bBeforeASettlement.status);
        assert.equal(bAfterASettlement.winner, bBeforeASettlement.winner);
        assert.equal(
            bAfterASettlement.winningPercentage,
            bBeforeASettlement.winningPercentage
        );
        assert.equal(
            bAfterASettlement.totalPool.toString(),
            bBeforeASettlement.totalPool.toString()
        );
        assert.equal(vaultBAfterASettlement, vaultBBeforeASettlement);

        console.log("");
        console.log("STEP 5: settle Market B");

        const aBeforeBSettlement = await bettingProgram.account.bettingQuestion.fetch(marketA.question);
        const vaultABeforeBSettlement = await provider.connection.getBalance(marketA.vault);

        await bettingProgram.methods.fetchAndStoreWinner(truthB.id).accounts({
            bettingQuestion: marketB.question,
            truthNetworkQuestion: truthB.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: marketB.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        const aFinal = await bettingProgram.account.bettingQuestion.fetch(marketA.question);
        const bFinal = await bettingProgram.account.bettingQuestion.fetch(marketB.question);
        const vaultAAfterBSettlement = await provider.connection.getBalance(marketA.vault);

        console.log("A final:", aFinal.status, aFinal.winner, aFinal.winningPercentage);
        console.log("B final:", bFinal.status, bFinal.winner, bFinal.winningPercentage);

        assert.equal(bFinal.status, "close");
        assert.equal(bFinal.winner, 2);
        assert.equal(bFinal.winningPercentage, 100);

        assert.equal(aFinal.status, aBeforeBSettlement.status);
        assert.equal(aFinal.winner, aBeforeBSettlement.winner);
        assert.equal(aFinal.winningPercentage, aBeforeBSettlement.winningPercentage);
        assert.equal(aFinal.totalPool.toString(), aBeforeBSettlement.totalPool.toString());
        assert.equal(vaultAAfterBSettlement, vaultABeforeBSettlement);

        console.log("");
        console.log("STEP 6: verify permanent Truth linkage and independent accounting");

        assert.equal(aFinal.questionPda.toBase58(), truthA.question.toBase58());
        assert.equal(bFinal.questionPda.toBase58(), truthB.question.toBase58());
        assert.notEqual(aFinal.questionPda.toBase58(), bFinal.questionPda.toBase58());

        assert.equal(aFinal.totalBetsBeforeCommission.toString(), "100000000");
        assert.equal(aFinal.totalBetsOption1.toString(), "100000000");
        assert.equal(aFinal.totalBetsOption2.toString(), "0");
        assert.equal(aFinal.totalPool.toString(), "99000000");

        assert.equal(bFinal.totalBetsBeforeCommission.toString(), "200000000");
        assert.equal(bFinal.totalBetsOption1.toString(), "0");
        assert.equal(bFinal.totalBetsOption2.toString(), "200000000");
        assert.equal(bFinal.totalPool.toString(), "198000000");

        const bettorAFinal = await bettingProgram.account.bettorAccount.fetch(bettorA);
        const bettorBFinal = await bettingProgram.account.bettorAccount.fetch(bettorB);

        assert.equal(bettorAFinal.betAmount.toString(), "100000000");
        assert.equal(bettorAFinal.chosenOption, true);
        assert.equal(bettorBFinal.betAmount.toString(), "200000000");
        assert.equal(bettorBFinal.chosenOption, false);

        console.log("");
        console.log("=== SBX-40 FINAL RESULT ===");
        console.log("Market A Truth:", aFinal.questionPda.toBase58());
        console.log("Market A winner:", aFinal.winner);
        console.log("Market A percentage:", aFinal.winningPercentage);
        console.log("Market A gross:", aFinal.totalBetsBeforeCommission.toString());
        console.log("Market A pool:", aFinal.totalPool.toString());
        console.log("Market B Truth:", bFinal.questionPda.toBase58());
        console.log("Market B winner:", bFinal.winner);
        console.log("Market B percentage:", bFinal.winningPercentage);
        console.log("Market B gross:", bFinal.totalBetsBeforeCommission.toString());
        console.log("Market B pool:", bFinal.totalPool.toString());
        console.log("Cross-market vault mutation:", 0);

        console.log("");
        console.log("SBX-40 MARKET ISOLATION VERIFIED");
    });
});