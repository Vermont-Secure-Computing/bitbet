import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
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

describe("SBX-39", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-39: another wallet cannot delete the event", async () => {
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
        const attacker = Keypair.generate();
        const truth = await createTruthQuestion("SBX-39 unauthorized event deletion", 10, 20);
        const market = await createBettingMarket("SBX-39 unauthorized event deletion", truth.question, 5);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-39 Market:", market.question.toBase58());
        console.log("Creator:", user.toBase58());
        console.log("Attacker:", attacker.publicKey.toBase58());

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

        console.log("STEP 2: Truth resolves TRUE");
        await makeTruthWinner(truth.question, truth.id, 1, 11_000, 10_000);

        console.log("STEP 3: store result");
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

        console.log("STEP 5: delete bettor record");
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

        console.log("STEP 7: fund attacker");
        const sig = await provider.connection.requestAirdrop(
            attacker.publicKey,
            LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(sig, "confirmed");

        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultBefore = await provider.connection.getBalance(market.vault);
        const truthVaultBefore = await provider.connection.getBalance(truth.vault);

        console.log("Records:", marketBefore.bettorRecordsCount.toString());
        console.log("Records closed:", marketBefore.bettorRecordsClosed.toString());

        console.log("");
        console.log("STEP 8: attacker attempts to delete event");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods.deleteEvent().accounts({
                bettingQuestion: market.question,
                creator: attacker.publicKey,
                vault: market.vault,
                truthQuestion: truth.question,
                truthVault: truth.vault,
                truthNetworkProgram: truthProgram.programId,
            }).signers([attacker]).rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        const marketAfter = await bettingProgram.account.bettingQuestion.fetchNullable(market.question);
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const truthAfter = await truthProgram.account.question.fetchNullable(truth.question);
        const truthVaultAfter = await provider.connection.getBalance(truth.vault);

        console.log("");
        console.log("=== SBX-39 RESULT ===");
        console.log("Attack rejected:", rejected);
        console.log("Error:", errorCode);
        console.log("Market still exists:", marketAfter !== null);
        console.log("Truth still exists:", truthAfter !== null);
        console.log("SolBetX vault change:", vaultAfter - vaultBefore);
        console.log("Truth vault change:", truthVaultAfter - truthVaultBefore);

        assert.equal(rejected, true, "Unauthorized event deletion must be rejected");
        assert.isNotNull(marketAfter, "SolBetX market must remain");
        assert.isNotNull(truthAfter, "Truth question must remain");
        assert.equal(vaultAfter, vaultBefore, "SolBetX vault must remain unchanged");
        assert.equal(truthVaultAfter, truthVaultBefore, "Truth vault must remain unchanged");

        console.log("");
        console.log("SBX-39 UNAUTHORIZED EVENT DELETION PROTECTION VERIFIED");
    });
});