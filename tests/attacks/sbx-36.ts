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

describe("SBX-36", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-36: 1 lamport of unsolicited Truth vault dust does not break settlement", async () => {
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
        const truth = await createTruthQuestion("SBX-36 Truth vault dust", 10, 20);
        const market = await createBettingMarket("SBX-36 Truth vault dust", truth.question, 5);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-36 Market:", market.question.toBase58());
        console.log("Truth:", truth.question.toBase58());
        console.log("Truth vault:", truth.vault.toBase58());

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

        console.log("STEP 2: send 1 lamport of unsolicited dust to Truth vault");
        const truthVaultBeforeDust = await provider.connection.getBalance(truth.vault);

        await provider.sendAndConfirm(
            new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: user,
                    toPubkey: truth.vault,
                    lamports: 1,
                })
            ),
            []
        );

        const truthVaultAfterDust = await provider.connection.getBalance(truth.vault);

        console.log("Truth vault before dust:", truthVaultBeforeDust);
        console.log("Truth vault after dust:", truthVaultAfterDust);
        console.log("Dust received:", truthVaultAfterDust - truthVaultBeforeDust);

        assert.equal(
            truthVaultAfterDust - truthVaultBeforeDust,
            1,
            "Truth vault must receive exactly 1 dust lamport"
        );

        console.log("STEP 3: Truth resolves TRUE");
        await makeTruthWinner(truth.question, truth.id, 1, 11_000, 10_000);

        console.log("STEP 4: SolBetX stores Truth result");
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

        assert.equal(settled.status, "close", "Market must close normally");
        assert.equal(settled.winner, 1, "TRUE must be stored as winner");
        assert.equal(settled.winningPercentage, 100, "Winning percentage must be 100%");

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

        assert.equal(bettorAfterClaim.claimed, true, "Winner must claim normally");
        assert.equal(bettorAfterClaim.winnings.toString(), "99000000");
        assert.equal(vaultBeforeClaim - vaultAfterClaim, 99_000_000);

        console.log("STEP 6: delete bettor record");
        await bettingProgram.methods.deleteBettorAccount().accounts({
            bettingQuestion: market.question,
            bettorAccount: bettor,
            user,
        }).rpc();

        const bettorAfterDelete = await bettingProgram.account.bettorAccount.fetchNullable(bettor);
        const stateAfterDelete = await bettingProgram.account.bettingQuestion.fetch(market.question);

        console.log("Bettor exists:", bettorAfterDelete !== null);
        console.log("Records:", stateAfterDelete.bettorRecordsCount.toString());
        console.log("Records closed:", stateAfterDelete.bettorRecordsClosed.toString());

        assert.isNull(bettorAfterDelete, "Bettor account must be deleted");
        assert.equal(
            stateAfterDelete.bettorRecordsClosed.toString(),
            stateAfterDelete.bettorRecordsCount.toString(),
            "All bettor records must be closed"
        );

        console.log("STEP 7: creator claims commission");
        await bettingProgram.methods.claimCreatorCommission().accounts({
            bettingQuestion: market.question,
            creator: user,
            vault: market.vault,
        }).rpc();

        const afterCommission = await bettingProgram.account.bettingQuestion.fetch(market.question);

        console.log("Creator commission claimed:", afterCommission.creatorCommissionClaimed);
        assert.equal(afterCommission.creatorCommissionClaimed, true);

        console.log("STEP 8: inspect Truth vault after complete SolBetX settlement");

        const truthVaultFinal = await provider.connection.getBalance(truth.vault);

        console.log("Truth vault before dust:", truthVaultBeforeDust);
        console.log("Truth vault after dust:", truthVaultAfterDust);
        console.log("Truth vault final:", truthVaultFinal);

        assert.isAtLeast(
            truthVaultFinal,
            1,
            "Truth vault must remain valid after unsolicited dust"
        );

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

        const marketAfterAttempt = await bettingProgram.account.bettingQuestion.fetchNullable(
            market.question
        );

        console.log("");
        console.log("=== SBX-36 FINAL RESULT ===");
        console.log("Truth dust received:", truthVaultAfterDust - truthVaultBeforeDust);
        console.log("Settlement succeeded:", settled.status === "close");
        console.log("Winner claimed:", bettorAfterClaim.claimed);
        console.log("Bettor cleaned:", bettorAfterDelete === null);
        console.log("Creator commission claimed:", afterCommission.creatorCommissionClaimed);
        console.log("Delete rejected:", deleteRejected);
        console.log("Delete error:", deleteError);
        console.log("Market exists:", marketAfterAttempt !== null);

        assert.equal(truthVaultAfterDust - truthVaultBeforeDust, 1);
        assert.equal(settled.status, "close");
        assert.equal(bettorAfterClaim.claimed, true);
        assert.isNull(bettorAfterDelete);

        if (deleteRejected) {
            assert.include(
                deleteError,
                "RentNotExpired",
                "Expected known Truth rent-expiry blocker"
            );
            assert.isNotNull(
                marketAfterAttempt,
                "Failed Truth cleanup must atomically preserve SolBetX market"
            );
        }

        console.log("");
        console.log("SBX-36 TRUTH VAULT DUST RESISTANCE VERIFIED");
    });
});