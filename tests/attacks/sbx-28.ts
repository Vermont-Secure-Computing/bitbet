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
} from "../helpers/solbetx-test-helpers";

describe("SBX-28", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-28: repeated same-side bets accumulate correctly", async () => {
        const truth = await createTruthQuestion("SBX-28 repeated same-side bets", 15, 25);
        const market = await createBettingMarket("SBX-28 repeated same-side bets", truth.question, 10);
        const bettor = deriveBettor(market.question);
        const bets = [10_000_000, 20_000_000, 30_000_000, 40_000_000];

        console.log("");
        console.log("SBX-28 Market:", market.question.toBase58());
        console.log("Bettor:", user.toBase58());
        console.log("Bettor PDA:", bettor.toBase58());

        console.log("");
        console.log("STEP 1: place four TRUE bets");

        for (const amount of bets) {
            await placeBet(
                market.question,
                market.vault,
                truth.question,
                truth.vault,
                bettor,
                new BN(amount),
                true
            );

            const record = await bettingProgram.account.bettorAccount.fetch(bettor);
            const state = await bettingProgram.account.bettingQuestion.fetch(market.question);

            console.log(
                `Bet ${amount}: bettor total=${record.betAmount.toString()} records=${state.bettorRecordsCount.toString()}`
            );
        }

        const bettorAfter = await bettingProgram.account.bettorAccount.fetch(bettor);
        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultBalance = await provider.connection.getBalance(market.vault);

        console.log("");
        console.log("=== SBX-28 RESULT ===");
        console.log("Chosen TRUE:", bettorAfter.chosenOption);
        console.log("Bettor accumulated bet:", bettorAfter.betAmount.toString());
        console.log("Gross market bets:", marketAfter.totalBetsBeforeCommission.toString());
        console.log("TRUE pool:", marketAfter.totalBetsOption1.toString());
        console.log("FALSE pool:", marketAfter.totalBetsOption2.toString());
        console.log("Net pool:", marketAfter.totalPool.toString());
        console.log("Bettor records:", marketAfter.bettorRecordsCount.toString());
        console.log("Bettor records closed:", marketAfter.bettorRecordsClosed.toString());
        console.log("Vault balance:", vaultBalance);

        assert.equal(bettorAfter.bettorAddress.toBase58(), user.toBase58(), "Bettor address must remain correct");
        assert.equal(bettorAfter.questionPda.toBase58(), market.question.toBase58(), "Bettor must remain linked to market");
        assert.equal(bettorAfter.chosenOption, true, "Bettor must remain on TRUE");
        assert.equal(bettorAfter.betAmount.toString(), "100000000", "Bets must accumulate to 0.1 SOL");
        assert.equal(marketAfter.totalBetsBeforeCommission.toString(), "100000000", "Gross bets must equal 0.1 SOL");
        assert.equal(marketAfter.totalBetsOption1.toString(), "100000000", "TRUE pool must equal 0.1 SOL");
        assert.equal(marketAfter.totalBetsOption2.toString(), "0", "FALSE pool must remain zero");
        assert.equal(marketAfter.totalPool.toString(), "99000000", "Net pool must equal 99% of gross bets");
        assert.equal(marketAfter.bettorRecordsCount.toString(), "1", "Repeated bets must create only one bettor record");
        assert.equal(marketAfter.bettorRecordsClosed.toString(), "0", "Bettor record must remain open");
        assert.equal(bettorAfter.claimed, false, "Bettor must remain unclaimed");
        assert.equal(bettorAfter.winnings.toString(), "0", "Winnings must remain zero before settlement");

        console.log("");
        console.log("SBX-28 SAME-SIDE BET ACCUMULATION VERIFIED");
    });
});