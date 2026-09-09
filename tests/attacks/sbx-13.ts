import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
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

describe("SBX-13", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-13: SolBetX cannot fetch a result when its Truth question is unavailable", async () => {
        const betAmount = new BN(100_000_000);
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");

        const truth = await createTruthQuestion("SBX-13 unavailable Truth before fetch", 10, 20);
        const market = await createBettingMarket("SBX-13 unavailable Truth before fetch", truth.question, 5);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-13 Market:", market.question.toBase58());
        console.log("Linked Truth:", truth.question.toBase58());
        console.log("Bettor:", bettor.toBase58());

        console.log("");
        console.log("STEP 1: bettor places 0.1 SOL TRUE");
        await placeBet(market.question, market.vault, truth.question, truth.vault, bettor, betAmount, true);

        console.log("STEP 2: Truth resolves TRUE");
        await makeTruthWinner(truth.question, truth.id, 1, 11_000, 10_000);

        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultBefore = await provider.connection.getBalance(market.vault);
        const houseBefore = await provider.connection.getBalance(houseWallet);

        console.log("STEP 3: simulate unavailable Truth account");
        const unavailableTruth = Keypair.generate().publicKey;

        console.log("Real linked Truth:", truth.question.toBase58());
        console.log("Unavailable account supplied:", unavailableTruth.toBase58());

        console.log("");
        console.log("=== SBX-13 ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
                bettingQuestion: market.question,
                truthNetworkQuestion: unavailableTruth,
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

        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const houseAfter = await provider.connection.getBalance(houseWallet);

        console.log("");
        console.log("=== SBX-13 RESULT ===");
        console.log("Rejected:", rejected);
        console.log("Market status before:", marketBefore.status);
        console.log("Market status after:", marketAfter.status);
        console.log("Winner before:", marketBefore.winner);
        console.log("Winner after:", marketAfter.winner);
        console.log("Percentage before:", marketBefore.winningPercentage);
        console.log("Percentage after:", marketAfter.winningPercentage);
        console.log("Vault change:", vaultAfter - vaultBefore);
        console.log("House change:", houseAfter - houseBefore);

        assert.equal(rejected, true, "Fetch must fail when linked Truth is unavailable");
        assert.equal(marketAfter.status, marketBefore.status, "Market status must not change");
        assert.equal(marketAfter.winner, marketBefore.winner, "Winner must not change");
        assert.equal(marketAfter.winningPercentage, marketBefore.winningPercentage, "Winning percentage must not change");
        assert.equal(vaultAfter, vaultBefore, "SolBetX vault must remain unchanged");
        assert.equal(houseAfter, houseBefore, "House must receive nothing");

        console.log("");
        console.log("SBX-13 UNAVAILABLE TRUTH PROTECTION VERIFIED");
    });
});