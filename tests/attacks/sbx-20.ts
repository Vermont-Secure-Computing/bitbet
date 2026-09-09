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

describe("SBX-20", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-20: event cannot be deleted while bettor records remain open", async () => {
        const betAmount = new BN(100_000_000);
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");

        const truth = await createTruthQuestion("SBX-20 open bettor record deletion", 10, 20);
        const market = await createBettingMarket("SBX-20 open bettor record deletion", truth.question, 5);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-20 Market:", market.question.toBase58());
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

        console.log("STEP 4: winner claims winnings");
        await bettingProgram.methods.claimWinnings().accounts({
            bettingQuestion: market.question,
            bettorAccount: bettor,
            user,
            vault: market.vault,
        }).rpc();

        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const bettorBefore = await bettingProgram.account.bettorAccount.fetchNullable(bettor);
        const marketInfoBefore = await provider.connection.getAccountInfo(market.question);
        const vaultInfoBefore = await provider.connection.getAccountInfo(market.vault);
        const vaultBalanceBefore = await provider.connection.getBalance(market.vault);

        console.log("Bettor records count:", marketBefore.bettorRecordsCount);
        console.log("Bettor records closed:", marketBefore.bettorRecordsClosed);
        console.log("Bettor account still exists:", bettorBefore !== null);

        console.log("");
        console.log("=== SBX-20 EARLY EVENT DELETE ATTACK ===");

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
                systemProgram: SystemProgram.programId,
            }).rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        const marketAfter = await bettingProgram.account.bettingQuestion.fetchNullable(market.question);
        const bettorAfter = await bettingProgram.account.bettorAccount.fetchNullable(bettor);
        const marketInfoAfter = await provider.connection.getAccountInfo(market.question);
        const vaultInfoAfter = await provider.connection.getAccountInfo(market.vault);
        const vaultBalanceAfter = await provider.connection.getBalance(market.vault);

        console.log("");
        console.log("=== SBX-20 RESULT ===");
        console.log("Delete rejected:", rejected);
        console.log("Error:", errorCode);
        console.log("Market still exists:", marketAfter !== null);
        console.log("Bettor still exists:", bettorAfter !== null);
        console.log("Vault still exists:", vaultInfoAfter !== null);
        console.log("Vault change:", vaultBalanceAfter - vaultBalanceBefore);

        assert.equal(rejected, true, "Event deletion must be rejected");
        assert.include(String(errorCode), "BettorRecordsStillOpen", "Expected BettorRecordsStillOpen");
        assert.isNotNull(marketAfter, "Betting market must remain");
        assert.isNotNull(bettorAfter, "Open bettor account must remain");
        assert.isNotNull(marketInfoAfter, "Betting market account must remain");
        assert.isNotNull(vaultInfoAfter, "Betting vault must remain");
        assert.equal(vaultBalanceAfter, vaultBalanceBefore, "Vault balance must remain unchanged");
        assert.equal(
            marketAfter!.bettorRecordsClosed.toString(),
            marketBefore.bettorRecordsClosed.toString(),
            "Closed bettor count must remain unchanged"
        );
        assert.isNotNull(marketInfoBefore);
        assert.isNotNull(vaultInfoBefore);

        console.log("");
        console.log("SBX-20 OPEN BETTOR RECORD EVENT DELETE PROTECTION VERIFIED");
    });
});