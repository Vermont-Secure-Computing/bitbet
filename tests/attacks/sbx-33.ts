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

describe("SBX-33", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-33: creator commission cannot be claimed before betting closes", async () => {
        const truth = await createTruthQuestion("SBX-33 early creator commission", 15, 25);
        const market = await createBettingMarket("SBX-33 early creator commission", truth.question, 10);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-33 Market:", market.question.toBase58());
        console.log("Creator:", user.toBase58());

        console.log("");
        console.log("STEP 1: place 0.1 SOL TRUE");
        await placeBet(
            market.question,
            market.vault,
            truth.question,
            truth.vault,
            bettor,
            new BN(100_000_000),
            true
        );

        const stateBefore = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultBefore = await provider.connection.getBalance(market.vault);
        const creatorBefore = await provider.connection.getBalance(user);

        console.log("Commission claimed before:", stateBefore.creatorCommissionClaimed);

        console.log("");
        console.log("STEP 2: attempt creator commission claim while betting is active");

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

        const stateAfter = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const creatorAfter = await provider.connection.getBalance(user);

        console.log("");
        console.log("=== SBX-33 RESULT ===");
        console.log("Claim rejected:", rejected);
        console.log("Error:", errorCode);
        console.log("Commission claimed before:", stateBefore.creatorCommissionClaimed);
        console.log("Commission claimed after:", stateAfter.creatorCommissionClaimed);
        console.log("Vault change:", vaultAfter - vaultBefore);
        console.log("Creator balance change:", creatorAfter - creatorBefore);

        assert.equal(rejected, true, "Early commission claim must be rejected");
        assert.include(errorCode, "BettingActive", "Expected BettingActive");
        assert.equal(stateBefore.creatorCommissionClaimed, false, "Commission must initially be unclaimed");
        assert.equal(stateAfter.creatorCommissionClaimed, false, "Commission must remain unclaimed");
        assert.equal(vaultAfter, vaultBefore, "Vault must remain unchanged");
        assert.equal(creatorAfter, creatorBefore, "Creator balance must remain unchanged");

        console.log("");
        console.log("SBX-33 EARLY CREATOR COMMISSION PROTECTION VERIFIED");
    });
});