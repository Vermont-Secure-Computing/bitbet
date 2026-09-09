import { BN } from "@coral-xyz/anchor";
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
    deriveBettor,
    placeBet,
    makeTruthWinner,
    getErrorCode,
} from "../helpers/solbetx-test-helpers";

describe("SBX-32", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-32: repeated fetch_and_store_winner is idempotent", async () => {
        const betAmount = new BN(100_000_000);
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");

        const truth = await createTruthQuestion("SBX-32 double result storage", 10, 20);
        const market = await createBettingMarket("SBX-32 double result storage", truth.question, 5);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-32 Market:", market.question.toBase58());
        console.log("Linked Truth:", truth.question.toBase58());
        console.log("Bettor:", user.toBase58());

        console.log("");
        console.log("STEP 1: bettor places 0.1 SOL TRUE");
        await placeBet(market.question, market.vault, truth.question, truth.vault, bettor, betAmount, true);

        console.log("STEP 2: Truth resolves TRUE");
        await makeTruthWinner(truth.question, truth.id, 1, 11_000, 10_000);

        const vaultBeforeFirst = await provider.connection.getBalance(market.vault);
        const houseBeforeFirst = await provider.connection.getBalance(houseWallet);

        console.log("STEP 3: first fetch_and_store_winner");
        await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
            bettingQuestion: market.question,
            truthNetworkQuestion: truth.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: market.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        const stateAfterFirst = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultAfterFirst = await provider.connection.getBalance(market.vault);
        const houseAfterFirst = await provider.connection.getBalance(houseWallet);

        console.log("Stored winner:", stateAfterFirst.winner);
        console.log("Stored percentage:", stateAfterFirst.winningPercentage);
        console.log("Market status:", stateAfterFirst.status);
        console.log("First vault reduction:", vaultBeforeFirst - vaultAfterFirst);
        console.log("First house increase:", houseAfterFirst - houseBeforeFirst);

        console.log("");
        console.log("=== SBX-32 SECOND RESULT STORAGE ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
                bettingQuestion: market.question,
                truthNetworkQuestion: truth.question,
                truthNetworkProgram: truthProgram.programId,
                houseWallet,
                vault: market.vault,
                systemProgram: SystemProgram.programId,
            }).rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        const stateAfterSecond = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultAfterSecond = await provider.connection.getBalance(market.vault);
        const houseAfterSecond = await provider.connection.getBalance(houseWallet);

        console.log("");
        console.log("=== SBX-32 RESULT ===");
        console.log("Second fetch rejected:", rejected);
        console.log("Error:", errorCode);
        console.log("Winner before:", stateAfterFirst.winner);
        console.log("Winner after:", stateAfterSecond.winner);
        console.log("Percentage before:", stateAfterFirst.winningPercentage);
        console.log("Percentage after:", stateAfterSecond.winningPercentage);
        console.log("Status before:", stateAfterFirst.status);
        console.log("Status after:", stateAfterSecond.status);
        console.log("Vault change on second attempt:", vaultAfterSecond - vaultAfterFirst);
        console.log("House change on second attempt:", houseAfterSecond - houseAfterFirst);

        assert.equal(stateAfterFirst.winner, 1, "First fetch must store TRUE winner");
        assert.equal(stateAfterFirst.winningPercentage, 100, "First fetch must store 100%");
        assert.equal(rejected, false, "Second fetch should complete idempotently");
        assert.equal(stateAfterSecond.winner, stateAfterFirst.winner, "Winner must not change");
        assert.equal(
            stateAfterSecond.winningPercentage,
            stateAfterFirst.winningPercentage,
            "Winning percentage must not change"
        );
        assert.equal(stateAfterSecond.status, stateAfterFirst.status, "Market status must not change");
        assert.equal(vaultAfterSecond, vaultAfterFirst, "Second fetch must not remove SOL from vault");
        assert.equal(houseAfterSecond, houseAfterFirst, "Second fetch must not pay house again");

        console.log("");
        console.log("SBX-32 IDEMPOTENT RESULT STORAGE VERIFIED");
    });
});