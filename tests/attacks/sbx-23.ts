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
} from "../helpers/solbetx-test-helpers";

describe("SBX-23", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-23: no Truth votes produces refund behavior", async () => {
        const betAmount = new BN(100_000_000);
        const expectedRefund = 99_000_000;
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");

        const truth = await createTruthQuestion("SBX-23 no votes refund", 5, 10);
        const market = await createBettingMarket("SBX-23 no votes refund", truth.question, 3);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-23 Market:", market.question.toBase58());
        console.log("Linked Truth:", truth.question.toBase58());
        console.log("Bettor:", user.toBase58());

        console.log("");
        console.log("STEP 1: bettor places 0.1 SOL TRUE");
        await placeBet(market.question, market.vault, truth.question, truth.vault, bettor, betAmount, true);

        console.log("STEP 2: nobody votes; wait for Truth reveal period to end");
        await new Promise(resolve => setTimeout(resolve, 11_000));

        console.log("STEP 3: finalize Truth with zero votes");
        await truthProgram.methods.finalizeVoting(truth.id).accounts({
            question: truth.question,
        }).rpc();

        const truthStored = await truthProgram.account.question.fetch(truth.question);

        console.log("Truth finalized:", truthStored.finalized);

        console.log("STEP 4: SolBetX stores no-vote result");
        await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
            bettingQuestion: market.question,
            truthNetworkQuestion: truth.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: market.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        const marketStored = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const bettorBefore = await bettingProgram.account.bettorAccount.fetch(bettor);
        const vaultBefore = await provider.connection.getBalance(market.vault);

        console.log("SolBetX winner:", marketStored.winner);
        console.log("SolBetX percentage:", marketStored.winningPercentage);
        console.log("Claimed before:", bettorBefore.claimed);

        console.log("STEP 5: bettor claims refund");
        await bettingProgram.methods.claimWinnings().accounts({
            bettingQuestion: market.question,
            bettorAccount: bettor,
            user,
            vault: market.vault,
        }).rpc();

        const bettorAfter = await bettingProgram.account.bettorAccount.fetch(bettor);
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const payout = vaultBefore - vaultAfter;

        console.log("");
        console.log("=== SBX-23 RESULT ===");
        console.log("Stored winner:", marketStored.winner);
        console.log("Stored percentage:", marketStored.winningPercentage);
        console.log("Claimed:", bettorAfter.claimed);
        console.log("Stored winnings:", bettorAfter.winnings.toString());
        console.log("Expected refund:", expectedRefund);
        console.log("Vault payout:", payout);

        assert.equal(truthStored.finalized, true, "Truth must be finalized");
        assert.equal(marketStored.winner, 0, "SolBetX must store winner 0");
        assert.equal(marketStored.winningPercentage, 0, "No-vote percentage must be 0");
        assert.equal(bettorAfter.claimed, true, "Bettor must be able to claim refund");
        assert.equal(bettorAfter.winnings.toString(), expectedRefund.toString(), "Refund must equal 99% of bet");
        assert.equal(payout, expectedRefund, "Vault reduction must equal refund");

        console.log("");
        console.log("SBX-23 NO-VOTE REFUND BEHAVIOR VERIFIED");
    });
});