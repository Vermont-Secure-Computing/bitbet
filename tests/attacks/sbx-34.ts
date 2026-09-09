import { BN } from "@coral-xyz/anchor";
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
    sleep,
} from "../helpers/solbetx-test-helpers";

describe("SBX-34", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-34: event cannot be deleted before result is stored", async () => {
        const truth = await createTruthQuestion("SBX-34 delete before result", 15, 25);
        const market = await createBettingMarket("SBX-34 delete before result", truth.question, 3);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-34 Market:", market.question.toBase58());
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

        console.log("STEP 2: wait for betting to close without storing result");
        await sleep(4_000);

        const stateBefore = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultBefore = await provider.connection.getBalance(market.vault);
        const truthVaultBefore = await provider.connection.getBalance(truth.vault);

        console.log("Market status before:", stateBefore.status);

        console.log("");
        console.log("STEP 3: attempt delete_event before result storage");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods.deleteEvent().accounts({
                bettingQuestion: market.question,
                creator: user,
                vault: market.vault,
                truthQuestion: truth.question,
                truthVault: truth.vault,
                truthNetworkProgram: truthProgram.programId,
            }).rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        const stateAfter = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const bettorAfter = await bettingProgram.account.bettorAccount.fetchNullable(bettor);
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const truthVaultAfter = await provider.connection.getBalance(truth.vault);

        console.log("");
        console.log("=== SBX-34 RESULT ===");
        console.log("Delete rejected:", rejected);
        console.log("Error:", errorCode);
        console.log("Market still exists:", stateAfter !== null);
        console.log("Market status:", stateAfter.status);
        console.log("Bettor still exists:", bettorAfter !== null);
        console.log("Vault change:", vaultAfter - vaultBefore);
        console.log("Truth vault change:", truthVaultAfter - truthVaultBefore);

        assert.equal(rejected, true, "Delete before result storage must be rejected");
        assert.include(errorCode, "BettingActive", "Expected BettingActive");
        assert.equal(stateAfter.status, stateBefore.status, "Market status must remain unchanged");
        assert.isNotNull(bettorAfter, "Bettor account must remain");
        assert.equal(vaultAfter, vaultBefore, "Betting vault must remain unchanged");
        assert.equal(truthVaultAfter, truthVaultBefore, "Truth vault must remain unchanged");

        console.log("");
        console.log("SBX-34 PRE-RESULT EVENT DELETION PROTECTION VERIFIED");
    });
});