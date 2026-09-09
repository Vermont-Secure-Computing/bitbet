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

describe("SBX-21", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-21: fully settled event cannot be deleted before Truth 30-day retention expires", async () => {
        const betAmount = new BN(100_000_000);
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");

        const truth = await createTruthQuestion("SBX-21 30-day retention", 10, 20);
        const market = await createBettingMarket("SBX-21 30-day retention", truth.question, 5);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-21 Market:", market.question.toBase58());
        console.log("Linked Truth:", truth.question.toBase58());
        console.log("Bettor:", user.toBase58());

        console.log("");
        console.log("STEP 1: bettor places 0.1 SOL TRUE");
        await placeBet(market.question, market.vault, truth.question, truth.vault, bettor, betAmount, true);

        console.log("STEP 2: Truth resolves TRUE");
        await makeTruthWinner(truth.question, truth.id, 1, 11_000, 10_000);

        console.log("STEP 3: SolBetX stores result");
        await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
            bettingQuestion: market.question,
            truthNetworkQuestion: truth.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: market.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        console.log("STEP 4: winner claims");
        await bettingProgram.methods.claimWinnings().accounts({
            bettingQuestion: market.question,
            bettorAccount: bettor,
            user,
            vault: market.vault,
        }).rpc();

        console.log("STEP 5: bettor record is deleted");
        await bettingProgram.methods.deleteBettorAccount().accounts({
            bettingQuestion: market.question,
            bettorAccount: bettor,
            user,
        }).rpc();

        console.log("STEP 6: creator claims commission");
        await bettingProgram.methods.claimCreatorCommission().accounts({
            bettingQuestion: market.question,
            creator: user,
            vault: market.vault,
        }).rpc();

        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const truthBefore = await truthProgram.account.question.fetch(truth.question);
        const bettorAfterDelete = await bettingProgram.account.bettorAccount.fetchNullable(bettor);
        const vaultBefore = await provider.connection.getBalance(market.vault);
        const truthVaultBefore = await provider.connection.getBalance(truth.vault);

        const vaultInfo = await provider.connection.getAccountInfo(market.vault);
        assert.isNotNull(vaultInfo, "SolBetX vault must exist");

        const rentMinimum = await provider.connection.getMinimumBalanceForRentExemption(vaultInfo!.data.length);
        const vaultExcess = vaultBefore - rentMinimum;

        console.log("");
        console.log("Before delete_event:");
        console.log("Market status:", marketBefore.status);
        console.log("Records count:", marketBefore.bettorRecordsCount.toString());
        console.log("Records closed:", marketBefore.bettorRecordsClosed.toString());
        console.log("Truth finalized:", truthBefore.finalized);
        console.log("Bettor account exists:", bettorAfterDelete !== null);
        console.log("SolBetX vault balance:", vaultBefore);
        console.log("SolBetX vault rent minimum:", rentMinimum);
        console.log("SolBetX vault excess:", vaultExcess);

        assert.equal(marketBefore.status, "close", "Market must be settled");
        assert.isTrue(truthBefore.finalized, "Truth must be finalized");
        assert.isNull(bettorAfterDelete, "Bettor record must already be closed");
        assert.equal(
            marketBefore.bettorRecordsClosed.toString(),
            marketBefore.bettorRecordsCount.toString(),
            "All bettor records must be closed"
        );
        assert.isAtMost(vaultExcess, 1000, "SolBetX vault must be settled before delete_event");

        console.log("");
        console.log("STEP 7: creator attempts delete_event before Truth 30-day retention expires");
        console.log("");
        console.log("=== SBX-21 EARLY DELETE TEST ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods.deleteEvent().accounts({
                bettingQuestion: market.question,
                creator: user,
                truthQuestion: truth.question,
                bettingVault: market.vault,
                truthVault: truth.vault,
                truthNetworkProgram: truthProgram.programId,
                systemProgram: SystemProgram.programId,
            }).rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        const marketAfter = await bettingProgram.account.bettingQuestion.fetchNullable(market.question);
        const truthAfter = await truthProgram.account.question.fetchNullable(truth.question);
        const vaultAfterInfo = await provider.connection.getAccountInfo(market.vault);
        const truthVaultAfterInfo = await provider.connection.getAccountInfo(truth.vault);
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const truthVaultAfter = await provider.connection.getBalance(truth.vault);

        console.log("");
        console.log("=== SBX-21 RESULT ===");
        console.log("Delete rejected:", rejected);
        console.log("Error:", errorCode);
        console.log("Market still exists:", marketAfter !== null);
        console.log("Truth still exists:", truthAfter !== null);
        console.log("SolBetX vault still exists:", vaultAfterInfo !== null);
        console.log("Truth vault still exists:", truthVaultAfterInfo !== null);
        console.log("SolBetX vault change during delete:", vaultAfter - vaultBefore);
        console.log("Truth vault change during delete:", truthVaultAfter - truthVaultBefore);

        assert.equal(rejected, true, "delete_event must be rejected before Truth retention expires");
        assert.equal(errorCode, "RentNotExpired", "Expected Truth 30-day retention protection");
        assert.isNotNull(marketAfter, "SolBetX market must remain");
        assert.isNotNull(truthAfter, "Truth question must remain");
        assert.isNotNull(vaultAfterInfo, "SolBetX vault must remain");
        assert.isNotNull(truthVaultAfterInfo, "Truth vault must remain");
        assert.equal(vaultAfter, vaultBefore, "Failed delete_event must not move SolBetX vault funds");
        assert.equal(truthVaultAfter, truthVaultBefore, "Failed delete_event must not move Truth vault funds");
        assert.equal(marketAfter!.status, marketBefore.status, "Market status must not change");
        assert.equal(
            marketAfter!.bettorRecordsClosed.toString(),
            marketBefore.bettorRecordsClosed.toString(),
            "Closed record count must not change"
        );
        assert.isTrue(truthAfter!.finalized, "Truth must remain finalized");

        console.log("");
        console.log("SBX-21 30-DAY RETENTION AND ATOMIC ROLLBACK VERIFIED");
    });
});