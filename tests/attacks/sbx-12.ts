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
    deriveTruthUserRecord,
    deriveTruthVoterRecord,
    placeBet,
    makeTruthWinner,
    sleep,
    getErrorCode
} from "../helpers/solbetx-test-helpers";

describe("SBX-12", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-12: winner can claim after Truth question is deleted", async () => {
        const betAmount = new BN(100_000_000);
        const expectedPayout = new BN(99_000_000);
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");

        const truth = await createTruthQuestion("SBX-12 Truth deletion after result storage", 10, 20);
        const market = await createBettingMarket("SBX-12 claim after Truth deletion", truth.question, 5);
        const bettor = deriveBettor(market.question);
        const truthUserRecord = deriveTruthUserRecord();
        const truthVoterRecord = deriveTruthVoterRecord(truth.question);

        console.log("");
        console.log("SBX-12 Market:", market.question.toBase58());
        console.log("Truth question:", truth.question.toBase58());
        console.log("SolBetX bettor:", bettor.toBase58());
        console.log("Truth voter record:", truthVoterRecord.toBase58());

        console.log("");
        console.log("STEP 1: bettor places 0.1 SOL TRUE");

        await placeBet(
            market.question,
            market.vault,
            truth.question,
            truth.vault,
            bettor,
            betAmount,
            true
        );

        console.log("STEP 2: Truth resolves TRUE");

        await makeTruthWinner(truth.question, truth.id, 1, 11_000, 10_000);

        console.log("STEP 3: SolBetX fetches and stores Truth result");

        await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
            bettingQuestion: market.question,
            truthNetworkQuestion: truth.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: market.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        const marketStored = await bettingProgram.account.bettingQuestion.fetch(market.question);

        assert.equal(marketStored.status, "close", "SolBetX result must be stored");
        assert.equal(marketStored.winner, 1, "Stored winner must be TRUE");
        assert.isAtLeast(marketStored.winningPercentage, 75, "Stored result must qualify");

        console.log("Stored SolBetX winner:", marketStored.winner);
        console.log("Stored SolBetX percentage:", marketStored.winningPercentage);

        console.log("STEP 4: Truth voter claims Truth reward");

        await truthProgram.methods.claimReward(`sbx-12-${Date.now()}`).accounts({
            voter: user,
            voterRecord: truthVoterRecord,
            question: truth.question,
            userRecord: truthUserRecord,
            vault: truth.vault,
            feeReceiver: houseWallet,
            systemProgram: SystemProgram.programId,
        }).rpc();

        const truthAfterClaim = await truthProgram.account.question.fetch(truth.question);

        console.log("Truth voter records:", truthAfterClaim.voterRecordsCount.toString());
        console.log("Truth voter records closed:", truthAfterClaim.voterRecordsClosed.toString());

        assert.equal(
            truthAfterClaim.voterRecordsClosed.toString(),
            truthAfterClaim.voterRecordsCount.toString(),
            "All Truth voter records must be closed"
        );

        console.log("STEP 5: wait until deployed Truth allows deletion");

        let truthDeleted = false;

        for (let attempt = 1; attempt <= 60; attempt++) {
            try {
                await truthProgram.methods.deleteExpiredQuestion().accounts({
                    question: truth.question,
                    vault: truth.vault,
                    asker: user,
                    systemProgram: SystemProgram.programId,
                }).rpc();

                truthDeleted = true;
                console.log(`Truth deleted after attempt ${attempt}`);
                break;
            } catch (error: any) {
                const code = getErrorCode(error);

                if (!String(code).includes("RentNotExpired")) {
                    throw error;
                }

                console.log(`Truth rent not expired yet (${attempt}/60)`);
                await sleep(1_000);
            }
        }

        assert.equal(truthDeleted, true, "Truth question should eventually become deletable");

        const truthAfterDelete = await provider.connection.getAccountInfo(truth.question);
        const truthVaultAfterDelete = await provider.connection.getAccountInfo(truth.vault);

        console.log("Truth question exists:", !!truthAfterDelete);
        console.log("Truth vault exists:", !!truthVaultAfterDelete);

        assert.isNull(truthAfterDelete, "Truth question must be deleted");
        assert.isNull(truthVaultAfterDelete, "Truth vault must be deleted");

        console.log("STEP 6: winner claims from SolBetX after Truth deletion");

        const vaultBefore = await provider.connection.getBalance(market.vault);

        await bettingProgram.methods.claimWinnings().accounts({
            bettingQuestion: market.question,
            bettorAccount: bettor,
            user,
            vault: market.vault,
        }).rpc();

        const bettorAfter = await bettingProgram.account.bettorAccount.fetch(bettor);
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const vaultReduction = vaultBefore - vaultAfter;

        console.log("");
        console.log("=== SBX-12 RESULT ===");
        console.log("Truth question deleted:", truthAfterDelete === null);
        console.log("Truth vault deleted:", truthVaultAfterDelete === null);
        console.log("Stored SolBetX winner:", marketStored.winner);
        console.log("Expected payout:", expectedPayout.toString());
        console.log("Stored winnings:", bettorAfter.winnings.toString());
        console.log("Vault reduction:", vaultReduction);
        console.log("Claimed:", bettorAfter.claimed);

        assert.equal(bettorAfter.claimed, true, "Winner must be marked claimed");
        assert.equal(
            bettorAfter.winnings.toString(),
            expectedPayout.toString(),
            "Winner must receive 99% refund/payout"
        );
        assert.equal(
            vaultReduction,
            expectedPayout.toNumber(),
            "SolBetX vault must decrease by exactly the payout"
        );

        console.log("");
        console.log("SBX-12 TRUTH-DELETION CLAIM VERIFIED");
    });
});