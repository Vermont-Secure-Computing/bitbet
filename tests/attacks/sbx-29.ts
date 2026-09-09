import { BN } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
    user,
    bettingProgram,
    ensureTestEnvironment,
    createTruthQuestion,
    createBettingMarket,
    deriveBettor,
    placeBet,
} from "../helpers/solbetx-test-helpers";

describe("SBX-29", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-29: bet exactly 0.01 SOL minimum is accepted", async () => {
        const amount = new BN(10_000_000);
        const truth = await createTruthQuestion("SBX-29 exact minimum bet", 15, 25);
        const market = await createBettingMarket("SBX-29 exact minimum bet", truth.question, 10);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-29 Market:", market.question.toBase58());
        console.log("Bettor:", user.toBase58());

        console.log("");
        console.log("STEP 1: place exactly 0.01 SOL TRUE");

        await placeBet(
            market.question,
            market.vault,
            truth.question,
            truth.vault,
            bettor,
            amount,
            true
        );

        const bettorAfter = await bettingProgram.account.bettorAccount.fetch(bettor);
        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(market.question);

        console.log("");
        console.log("=== SBX-29 RESULT ===");
        console.log("Bet accepted: true");
        console.log("Chosen TRUE:", bettorAfter.chosenOption);
        console.log("Bettor amount:", bettorAfter.betAmount.toString());
        console.log("Gross bets:", marketAfter.totalBetsBeforeCommission.toString());
        console.log("TRUE pool:", marketAfter.totalBetsOption1.toString());
        console.log("FALSE pool:", marketAfter.totalBetsOption2.toString());
        console.log("Net pool:", marketAfter.totalPool.toString());
        console.log("Bettor records:", marketAfter.bettorRecordsCount.toString());

        assert.equal(bettorAfter.chosenOption, true, "Bettor must be on TRUE");
        assert.equal(bettorAfter.betAmount.toString(), "10000000", "Bet amount must equal exactly 0.01 SOL");
        assert.equal(marketAfter.totalBetsBeforeCommission.toString(), "10000000", "Gross bets must equal 0.01 SOL");
        assert.equal(marketAfter.totalBetsOption1.toString(), "10000000", "TRUE pool must equal 0.01 SOL");
        assert.equal(marketAfter.totalBetsOption2.toString(), "0", "FALSE pool must remain zero");
        assert.equal(marketAfter.totalPool.toString(), "9900000", "Net pool must equal 9,900,000 lamports");
        assert.equal(marketAfter.bettorRecordsCount.toString(), "1", "Exactly one bettor record must exist");
        assert.equal(bettorAfter.claimed, false);
        assert.equal(bettorAfter.winnings.toString(), "0");

        console.log("");
        console.log("SBX-29 EXACT MINIMUM BET VERIFIED");
    });
});