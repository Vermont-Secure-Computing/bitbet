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

describe("SBX-18", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-18: winning bettor cannot delete account before claiming", async () => {
        const betAmount = new BN(100_000_000);
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");

        const truth = await createTruthQuestion("SBX-18 winner delete before claim", 10, 20);
        const market = await createBettingMarket("SBX-18 winner delete before claim", truth.question, 5);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-18 Market:", market.question.toBase58());
        console.log("Bettor:", user.toBase58());

        console.log("");
        console.log("STEP 1: bettor places 0.1 SOL TRUE");
        await placeBet(market.question, market.vault, truth.question, truth.vault, bettor, betAmount, true);

        console.log("STEP 2: Truth resolves TRUE");
        await makeTruthWinner(truth.question, truth.id, 1, 11_000, 10_000);

        console.log("STEP 3: SolBetX stores TRUE result");
        await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
            bettingQuestion: market.question,
            truthNetworkQuestion: truth.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: market.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const bettorBefore = await bettingProgram.account.bettorAccount.fetch(bettor);
        const vaultBefore = await provider.connection.getBalance(market.vault);

        console.log("Stored winner:", marketBefore.winner);
        console.log("Stored percentage:", marketBefore.winningPercentage);
        console.log("Bettor chose TRUE:", bettorBefore.chosenOption);
        console.log("Claimed:", bettorBefore.claimed);
        console.log("Records closed:", marketBefore.bettorRecordsClosed);

        console.log("");
        console.log("=== SBX-18 EARLY WINNER DELETE ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods.deleteBettorAccount().accounts({
                bettingQuestion: market.question,
                bettorAccount: bettor,
                user,
            }).rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const bettorAfter = await bettingProgram.account.bettorAccount.fetchNullable(bettor);
        const vaultAfter = await provider.connection.getBalance(market.vault);

        console.log("");
        console.log("=== SBX-18 RESULT ===");
        console.log("Delete rejected:", rejected);
        console.log("Error:", errorCode);
        console.log("Bettor account still exists:", bettorAfter !== null);
        console.log("Records closed before:", marketBefore.bettorRecordsClosed);
        console.log("Records closed after:", marketAfter.bettorRecordsClosed);
        console.log("Vault change:", vaultAfter - vaultBefore);

        assert.equal(marketBefore.winner, 1, "Stored winner must be TRUE");
        assert.equal(bettorBefore.chosenOption, true, "Bettor must be winning TRUE bettor");
        assert.equal(bettorBefore.claimed, false, "Winner must not have claimed yet");
        assert.equal(rejected, true, "Unclaimed winner deletion must be rejected");
        assert.include(String(errorCode), "NotReadyToDelete", "Expected NotReadyToDelete");
        assert.isNotNull(bettorAfter, "Winning bettor account must remain open");
        assert.equal(
            marketAfter.bettorRecordsClosed.toString(),
            marketBefore.bettorRecordsClosed.toString(),
            "Closed bettor count must remain unchanged"
        );
        assert.equal(vaultAfter, vaultBefore, "Vault must remain unchanged");

        console.log("");
        console.log("SBX-18 UNCLAIMED WINNER DELETE PROTECTION VERIFIED");
    });
});