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
    getErrorCode,
} from "../helpers/solbetx-test-helpers";

describe("SBX-22", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-22: creator cannot claim commission twice", async () => {
        const betAmount = new BN(100_000_000);
        const truth = await createTruthQuestion("SBX-22 creator double commission", 15, 25);
        const market = await createBettingMarket("SBX-22 creator double commission", truth.question, 5);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-22 Market:", market.question.toBase58());
        console.log("Creator:", user.toBase58());

        console.log("");
        console.log("STEP 1: bettor places 0.1 SOL TRUE");
        await placeBet(market.question, market.vault, truth.question, truth.vault, bettor, betAmount, true);

        console.log("STEP 2: wait for betting close");
        await new Promise(resolve => setTimeout(resolve, 6_000));

        const vaultBeforeFirst = await provider.connection.getBalance(market.vault);
        const creatorBeforeFirst = await provider.connection.getBalance(user);

        console.log("STEP 3: creator claims commission first time");
        await bettingProgram.methods.claimCreatorCommission().accounts({
            bettingQuestion: market.question,
            creator: user,
            vault: market.vault,
        }).rpc();

        const stateAfterFirst = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultAfterFirst = await provider.connection.getBalance(market.vault);
        const creatorAfterFirst = await provider.connection.getBalance(user);

        console.log("Creator commission claimed:", stateAfterFirst.creatorCommissionClaimed);
        console.log("First vault reduction:", vaultBeforeFirst - vaultAfterFirst);
        console.log("First creator balance change:", creatorAfterFirst - creatorBeforeFirst);

        console.log("");
        console.log("=== SBX-22 DOUBLE COMMISSION ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods.claimCreatorCommission().accounts({
                bettingQuestion: market.question,
                creator: user,
                vault: market.vault,
            }).rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        const stateAfterSecond = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultAfterSecond = await provider.connection.getBalance(market.vault);
        const creatorAfterSecond = await provider.connection.getBalance(user);

        console.log("");
        console.log("=== SBX-22 RESULT ===");
        console.log("Second claim rejected:", rejected);
        console.log("Error:", errorCode);
        console.log("Vault change on second claim:", vaultAfterSecond - vaultAfterFirst);
        console.log("Creator balance change on second claim:", creatorAfterSecond - creatorAfterFirst);
        console.log("Commission claimed after second attempt:", stateAfterSecond.creatorCommissionClaimed);

        assert.equal(stateAfterFirst.creatorCommissionClaimed, true, "First claim must mark commission claimed");
        assert.equal(rejected, true, "Second creator commission claim must be rejected");
        assert.include(String(errorCode), "CommissionAlreadyClaimed", "Expected CommissionAlreadyClaimed");
        assert.equal(vaultAfterSecond, vaultAfterFirst, "Second claim must not remove SOL from vault");
        assert.equal(creatorAfterSecond, creatorAfterFirst, "Second rejected claim must not pay creator");
        assert.equal(stateAfterSecond.creatorCommissionClaimed, true, "Commission must remain marked claimed");

        console.log("");
        console.log("SBX-22 DOUBLE CREATOR COMMISSION PROTECTION VERIFIED");
    });
});