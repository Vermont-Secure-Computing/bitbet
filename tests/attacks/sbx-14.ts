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

describe("SBX-14", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-14: winner cannot claim winnings twice", async () => {
        const betAmount = new BN(100_000_000);
        const expectedPayout = new BN(99_000_000);
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");

        const truth = await createTruthQuestion("SBX-14 double claim protection", 10, 20);
        const market = await createBettingMarket("SBX-14 double claim protection", truth.question, 5);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-14 Market:", market.question.toBase58());
        console.log("Truth question:", truth.question.toBase58());
        console.log("Bettor:", bettor.toBase58());

        console.log("");
        console.log("STEP 1: bettor places 0.1 SOL TRUE");
        await placeBet(market.question, market.vault, truth.question, truth.vault, bettor, betAmount, true);

        console.log("STEP 2: Truth resolves TRUE");
        await makeTruthWinner(truth.question, truth.id, 1, 11_000, 10_000);

        console.log("STEP 3: SolBetX stores Truth result");
        await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
            bettingQuestion: market.question,
            truthNetworkQuestion: truth.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: market.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        console.log("STEP 4: winner claims first time");
        const vaultBeforeFirst = await provider.connection.getBalance(market.vault);

        await bettingProgram.methods.claimWinnings().accounts({
            bettingQuestion: market.question,
            bettorAccount: bettor,
            user,
            vault: market.vault,
        }).rpc();

        const bettorAfterFirst = await bettingProgram.account.bettorAccount.fetch(bettor);
        const vaultAfterFirst = await provider.connection.getBalance(market.vault);
        const firstPayout = vaultBeforeFirst - vaultAfterFirst;

        assert.equal(bettorAfterFirst.claimed, true, "First claim must mark bettor claimed");
        assert.equal(bettorAfterFirst.winnings.toString(), expectedPayout.toString(), "First payout must be correct");
        assert.equal(firstPayout, expectedPayout.toNumber(), "First claim must remove exactly the expected payout");

        console.log("First payout:", firstPayout);
        console.log("Claimed:", bettorAfterFirst.claimed);

        console.log("");
        console.log("=== SBX-14 DOUBLE CLAIM ATTACK ===");

        const vaultBeforeSecond = await provider.connection.getBalance(market.vault);
        const userBeforeSecond = await provider.connection.getBalance(user);
        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods.claimWinnings().accounts({
                bettingQuestion: market.question,
                bettorAccount: bettor,
                user,
                vault: market.vault,
            }).rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        const bettorAfterSecond = await bettingProgram.account.bettorAccount.fetch(bettor);
        const vaultAfterSecond = await provider.connection.getBalance(market.vault);
        const userAfterSecond = await provider.connection.getBalance(user);

        console.log("");
        console.log("=== SBX-14 RESULT ===");
        console.log("Second claim rejected:", rejected);
        console.log("Error:", errorCode);
        console.log("Vault change on second claim:", vaultAfterSecond - vaultBeforeSecond);
        console.log("User balance change:", userAfterSecond - userBeforeSecond);
        console.log("Claimed:", bettorAfterSecond.claimed);
        console.log("Stored winnings:", bettorAfterSecond.winnings.toString());

        assert.equal(rejected, true, "Second claim must be rejected");
        assert.include(String(errorCode), "AlreadyClaimed", "Expected AlreadyClaimed");
        assert.equal(vaultAfterSecond, vaultBeforeSecond, "Second claim must not remove SOL from vault");
        assert.equal(userAfterSecond, userBeforeSecond, "Rejected second claim must not change user balance");
        assert.equal(bettorAfterSecond.claimed, true, "Bettor must remain claimed");
        assert.equal(bettorAfterSecond.winnings.toString(), expectedPayout.toString(), "Stored winnings must not change");

        console.log("");
        console.log("SBX-14 DOUBLE CLAIM PROTECTION VERIFIED");
    });
});