import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
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
    getErrorCode,
} from "../helpers/solbetx-test-helpers";

describe("SBX-01", () => {
    before(async () => {
        console.log("");
        console.log("=== SBX-01 TEST ENVIRONMENT ===");
        console.log("RPC:", provider.connection.rpcEndpoint);
        console.log("Wallet:", user.toBase58());
        console.log("SolBetX:", bettingProgram.programId.toBase58());
        console.log("Truth:", truthProgram.programId.toBase58());

        await ensureTestEnvironment();

        const balance = await provider.connection.getBalance(user);
        console.log(
            "Test wallet balance:",
            (balance / LAMPORTS_PER_SOL).toFixed(4),
            "SOL"
        );
    });

    it("SBX-01 regression: bettor cannot switch sides after first bet", async () => {
        const truth = await createTruthQuestion(
            "SBX-01 mixed side betting security test",
            60 * 60,
            2 * 60 * 60
        );

        console.log("Creating Truth question:", truth.question.toBase58());

        const market = await createBettingMarket(
            "SBX-01 mixed side betting security test",
            truth.question,
            30 * 60
        );

        console.log("Creating SolBetX question:", market.question.toBase58());

        const bettor = deriveBettor(market.question);
        console.log("Bettor PDA:", bettor.toBase58());

        const firstTrueBet = new BN(10_000_000);
        const secondTrueBet = new BN(10_000_000);
        const falseBet = new BN(1_000_000_000);

        console.log("");
        console.log("STEP 1: bettor places 0.01 SOL TRUE");

        await placeBet(
            market.question,
            market.vault,
            truth.question,
            truth.vault,
            bettor,
            firstTrueBet,
            true
        );

        console.log("STEP 2: same bettor adds 0.01 SOL TRUE");

        await placeBet(
            market.question,
            market.vault,
            truth.question,
            truth.vault,
            bettor,
            secondTrueBet,
            true
        );

        const beforeAttackBettor = await bettingProgram.account.bettorAccount.fetch(bettor);
        const beforeAttackMarket = await bettingProgram.account.bettingQuestion.fetch(
            market.question
        );
        const expectedTrueTotal = firstTrueBet.add(secondTrueBet);

        assert.equal(
            beforeAttackBettor.chosenOption,
            true,
            "Bettor should remain on TRUE"
        );

        assert.equal(
            beforeAttackBettor.betAmount.toString(),
            expectedTrueTotal.toString(),
            "Same-side bets should accumulate"
        );

        assert.equal(
            beforeAttackMarket.totalBetsOption1.toString(),
            expectedTrueTotal.toString(),
            "TRUE market total should contain both TRUE bets"
        );

        assert.equal(
            beforeAttackMarket.totalBetsOption2.toString(),
            "0",
            "FALSE market should still be zero"
        );

        console.log("");
        console.log("STEP 3: attacker tries to place 1 SOL FALSE");

        let rejected = false;
        let errorCode = "";

        try {
            await placeBet(
                market.question,
                market.vault,
                truth.question,
                truth.vault,
                bettor,
                falseBet,
                false
            );
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        assert.equal(
            rejected,
            true,
            "Opposite-side bet should be rejected"
        );

        assert.include(
            String(errorCode),
            "CannotChangeBetSide",
            "Expected CannotChangeBetSide error"
        );

        const afterAttackBettor = await bettingProgram.account.bettorAccount.fetch(bettor);
        const afterAttackMarket = await bettingProgram.account.bettingQuestion.fetch(
            market.question
        );

        console.log("");
        console.log("=== SBX-01 REGRESSION RESULT ===");
        console.log("chosenOption:", afterAttackBettor.chosenOption);
        console.log("betAmount:", afterAttackBettor.betAmount.toString());
        console.log("TRUE total:", afterAttackMarket.totalBetsOption1.toString());
        console.log("FALSE total:", afterAttackMarket.totalBetsOption2.toString());

        assert.equal(
            afterAttackBettor.chosenOption,
            true,
            "Rejected attack must not change chosenOption"
        );

        assert.equal(
            afterAttackBettor.betAmount.toString(),
            expectedTrueTotal.toString(),
            "Rejected attack must not change bettor betAmount"
        );

        assert.equal(
            afterAttackMarket.totalBetsOption1.toString(),
            expectedTrueTotal.toString(),
            "Rejected attack must not change TRUE total"
        );

        assert.equal(
            afterAttackMarket.totalBetsOption2.toString(),
            "0",
            "Rejected attack must not increase FALSE total"
        );

        console.log("");
        console.log("SBX-01 PATCH VERIFIED");
    });
});