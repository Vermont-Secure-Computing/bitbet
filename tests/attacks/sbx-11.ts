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
} from "../helpers/solbetx-test-helpers";

describe("SBX-11", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-11: normal winning lifecycle pays the winner correctly", async () => {
        const betAmount = new BN(100_000_000);
        const expectedPayout = new BN(99_000_000);

        const truth = await createTruthQuestion(
            "SBX-11 normal winning lifecycle",
            3,
            6
        );

        const market = await createBettingMarket(
            "SBX-11 normal winning lifecycle",
            truth.question,
            2
        );

        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-11 Market:", market.question.toBase58());
        console.log("Truth question:", truth.question.toBase58());
        console.log("Bettor:", bettor.toBase58());

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

        await makeTruthWinner(
            truth.question,
            truth.id,
            1
        );

        const truthAfter = await truthProgram.account.question.fetch(truth.question);

        assert.equal(
            truthAfter.finalized,
            true,
            "Truth question must be finalized"
        );

        assert.equal(
            truthAfter.winningOption,
            1,
            "Truth winner must be TRUE"
        );

        const houseWallet = new PublicKey(
            "CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL"
        );

        if (!(await provider.connection.getAccountInfo(houseWallet))) {
            const signature = await provider.connection.requestAirdrop(
                houseWallet,
                1_000_000
            );
            const latest = await provider.connection.getLatestBlockhash();

            await provider.connection.confirmTransaction(
                { signature, ...latest },
                "confirmed"
            );
        }

        console.log("STEP 3: SolBetX fetches and stores Truth result");

        await bettingProgram.methods
            .fetchAndStoreWinner(truth.id)
            .accounts({
                bettingQuestion: market.question,
                truthNetworkQuestion: truth.question,
                truthNetworkProgram: truthProgram.programId,
                houseWallet,
                vault: market.vault,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        const marketAfterResult = await bettingProgram.account.bettingQuestion.fetch(
            market.question
        );

        assert.equal(
            marketAfterResult.status,
            "close",
            "Market must be closed after result is stored"
        );

        assert.equal(
            marketAfterResult.winner,
            1,
            "Stored SolBetX winner must be TRUE"
        );

        assert.isAtLeast(
            marketAfterResult.winningPercentage,
            75,
            "Winning percentage must satisfy consensus threshold"
        );

        const bettorBefore = await bettingProgram.account.bettorAccount.fetch(bettor);
        const vaultBefore = await provider.connection.getBalance(market.vault);

        assert.equal(
            bettorBefore.claimed,
            false,
            "Bettor must be unclaimed before payout"
        );

        console.log("STEP 4: winning bettor claims winnings");

        await bettingProgram.methods
            .claimWinnings()
            .accounts({
                bettingQuestion: market.question,
                bettorAccount: bettor,
                user,
                vault: market.vault,
            })
            .rpc();

        const bettorAfter = await bettingProgram.account.bettorAccount.fetch(bettor);
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const vaultReduction = vaultBefore - vaultAfter;

        console.log("");
        console.log("=== SBX-11 RESULT ===");
        console.log("Truth winner:", truthAfter.winningOption);
        console.log("Truth percentage:", truthAfter.winningPercentage);
        console.log("SolBetX winner:", marketAfterResult.winner);
        console.log("SolBetX percentage:", marketAfterResult.winningPercentage);
        console.log("Bet amount:", betAmount.toString());
        console.log("Expected payout:", expectedPayout.toString());
        console.log("Stored winnings:", bettorAfter.winnings.toString());
        console.log("Vault reduction:", vaultReduction);
        console.log("Claimed:", bettorAfter.claimed);

        assert.equal(
            bettorAfter.claimed,
            true,
            "Winner must be marked claimed"
        );

        assert.equal(
            bettorAfter.winnings.toString(),
            expectedPayout.toString(),
            "Stored winnings must equal 99% refund for one-sided market"
        );

        assert.equal(
            vaultReduction,
            expectedPayout.toNumber(),
            "Vault must pay exactly the expected amount"
        );

        console.log("");
        console.log("SBX-11 NORMAL LIFECYCLE VERIFIED");
    });
});