import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
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
} from "../helpers/solbetx-test-helpers";

describe("SBX-35", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-35: 1 lamport of unsolicited vault dust does not break full lifecycle", async () => {
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
        const truth = await createTruthQuestion("SBX-35 betting vault dust", 10, 20);
        const market = await createBettingMarket("SBX-35 betting vault dust", truth.question, 5);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-35 Market:", market.question.toBase58());
        console.log("Vault:", market.vault.toBase58());

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

        console.log("STEP 2: send 1 lamport of unsolicited dust to SolBetX vault");
        const beforeDust = await provider.connection.getBalance(market.vault);

        await provider.sendAndConfirm(
            new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: user,
                    toPubkey: market.vault,
                    lamports: 1,
                })
            ),
            []
        );

        const afterDust = await provider.connection.getBalance(market.vault);

        console.log("Vault before dust:", beforeDust);
        console.log("Vault after dust:", afterDust);
        console.log("Dust received:", afterDust - beforeDust);

        assert.equal(afterDust - beforeDust, 1, "Vault must receive exactly 1 dust lamport");

        console.log("STEP 3: Truth resolves TRUE");
        await makeTruthWinner(truth.question, truth.id, 1, 11_000, 10_000);

        console.log("STEP 4: store result");
        await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
            bettingQuestion: market.question,
            truthNetworkQuestion: truth.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: market.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        const settled = await bettingProgram.account.bettingQuestion.fetch(market.question);

        console.log("Market status:", settled.status);
        console.log("Stored winner:", settled.winner);
        console.log("Stored percentage:", settled.winningPercentage);

        assert.equal(settled.status, "close");
        assert.equal(settled.winner, 1);
        assert.equal(settled.winningPercentage, 100);

        console.log("STEP 5: winner claims");

        const vaultBeforeClaim = await provider.connection.getBalance(market.vault);

        await bettingProgram.methods.claimWinnings().accounts({
            bettingQuestion: market.question,
            bettorAccount: bettor,
            user,
            vault: market.vault,
        }).rpc();

        const bettorAfterClaim = await bettingProgram.account.bettorAccount.fetch(bettor);
        const vaultAfterClaim = await provider.connection.getBalance(market.vault);

        console.log("Claimed:", bettorAfterClaim.claimed);
        console.log("Winnings:", bettorAfterClaim.winnings.toString());
        console.log("Claim vault reduction:", vaultBeforeClaim - vaultAfterClaim);

        assert.equal(bettorAfterClaim.claimed, true);
        assert.equal(bettorAfterClaim.winnings.toString(), "99000000");

        console.log("STEP 6: delete bettor record");

        await bettingProgram.methods.deleteBettorAccount().accounts({
            bettingQuestion: market.question,
            bettorAccount: bettor,
            user,
        }).rpc();

        console.log("STEP 7: creator claims commission");

        const vaultBeforeCommission = await provider.connection.getBalance(market.vault);

        await bettingProgram.methods.claimCreatorCommission().accounts({
            bettingQuestion: market.question,
            creator: user,
            vault: market.vault,
        }).rpc();

        const marketAfterCommission = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultAfterCommission = await provider.connection.getBalance(market.vault);

        console.log("Creator commission claimed:", marketAfterCommission.creatorCommissionClaimed);
        console.log("Commission vault reduction:", vaultBeforeCommission - vaultAfterCommission);

        assert.equal(
            marketAfterCommission.creatorCommissionClaimed,
            true,
            "Creator commission must be claimed"
        );

        const bettorAfterDelete = await bettingProgram.account.bettorAccount.fetchNullable(bettor);
        const marketBeforeDelete = await bettingProgram.account.bettingQuestion.fetch(market.question);

        console.log("Bettor exists:", bettorAfterDelete !== null);
        console.log("Records:", marketBeforeDelete.bettorRecordsCount.toString());
        console.log("Records closed:", marketBeforeDelete.bettorRecordsClosed.toString());

        assert.isNull(bettorAfterDelete, "Bettor account must be deleted");
        assert.equal(
            marketBeforeDelete.bettorRecordsClosed.toString(),
            marketBeforeDelete.bettorRecordsCount.toString(),
            "All bettor records must be closed"
        );

        console.log("STEP 8: verify remaining SolBetX vault balance");
        const vaultBeforeDelete = await provider.connection.getBalance(market.vault);
        const vaultInfo = await provider.connection.getAccountInfo(market.vault);
        assert.isNotNull(vaultInfo, "Vault must exist before deletion");

        const rentMinimum = await provider.connection.getMinimumBalanceForRentExemption(
            vaultInfo!.data.length
        );
        const excess = vaultBeforeDelete - rentMinimum;

        console.log("Vault balance:", vaultBeforeDelete);
        console.log("Rent minimum:", rentMinimum);
        console.log("Balance above rent:", excess);

        assert.isAtMost(excess, 1000, "1-lamport dust must remain within deletion tolerance");

        console.log("STEP 9: attempt event deletion");

        let deleteRejected = false;
        let deleteError = "";

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
            deleteRejected = true;
            deleteError = error?.error?.errorCode?.code || error?.message || String(error);
            console.log("Delete rejected with:", deleteError);
        }

        const marketAfterDelete = await bettingProgram.account.bettingQuestion.fetchNullable(market.question);
        const vaultAfterDelete = await provider.connection.getAccountInfo(market.vault);

        console.log("");
        console.log("=== SBX-35 FINAL RESULT ===");
        console.log("Balance above rent:", excess);
        console.log("Within SolBetX deletion tolerance:", excess <= 1000);
        console.log("Delete rejected:", deleteRejected);
        console.log("Delete error:", deleteError);
        console.log("Market exists:", marketAfterDelete !== null);
        console.log("Vault exists:", vaultAfterDelete !== null);

        assert.equal(excess, 1, "Only the injected 1-lamport dust should remain above rent");
        assert.isAtMost(excess, 1000, "Dust must remain within SolBetX deletion tolerance");

        if (deleteRejected) {
            assert.include(deleteError, "RentNotExpired", "Expected known Truth rent-expiry blocker");
            assert.isNotNull(marketAfterDelete, "Atomic rollback must preserve market");
            assert.isNotNull(vaultAfterDelete, "Atomic rollback must preserve vault");
        }

        console.log("");
        console.log("SBX-35 SOLBETX VAULT DUST RESISTANCE VERIFIED");
    });
});