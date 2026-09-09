import { BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
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

describe("SBX-27", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-27: multiple bettors with different sizes settle correctly", async () => {
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
        const trueB = Keypair.generate();
        const falseC = Keypair.generate();
        const falseD = Keypair.generate();

        for (const wallet of [trueB, falseC, falseD]) {
            const sig = await provider.connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL);
            const latest = await provider.connection.getLatestBlockhash();
            await provider.connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
        }

        const truth = await createTruthQuestion("SBX-27 multi bettor accounting", 10, 20);
        const market = await createBettingMarket("SBX-27 multi bettor accounting", truth.question, 5);
        const trueARecord = deriveBettor(market.question);

        const deriveRecord = (wallet: PublicKey) => PublicKey.findProgramAddressSync(
            [Buffer.from("bettor"), wallet.toBuffer(), market.question.toBuffer()],
            bettingProgram.programId
        )[0];

        const trueBRecord = deriveRecord(trueB.publicKey);
        const falseCRecord = deriveRecord(falseC.publicKey);
        const falseDRecord = deriveRecord(falseD.publicKey);

        const placeFor = async (wallet: Keypair, bettor: PublicKey, amount: number, side: boolean) => {
            await bettingProgram.methods.placeBet(new BN(amount), side).accounts({
                bettingQuestion: market.question,
                bettorAccount: bettor,
                user: wallet.publicKey,
                vault: market.vault,
                truthNetworkQuestion: truth.question,
                betProgram: bettingProgram.programId,
                truthNetworkProgram: truthProgram.programId,
                systemProgram: SystemProgram.programId,
                truthNetworkVault: truth.vault,
            }).signers([wallet]).rpc();
        };

        console.log("");
        console.log("SBX-27 Market:", market.question.toBase58());
        console.log("TRUE A 0.10:", user.toBase58());
        console.log("TRUE B 0.20:", trueB.publicKey.toBase58());
        console.log("FALSE C 0.15:", falseC.publicKey.toBase58());
        console.log("FALSE D 0.05:", falseD.publicKey.toBase58());

        console.log("");
        console.log("STEP 1: place four different-sized bets");
        await placeBet(
            market.question,
            market.vault,
            truth.question,
            truth.vault,
            trueARecord,
            new BN(100_000_000),
            true
        );
        await placeFor(trueB, trueBRecord, 200_000_000, true);
        await placeFor(falseC, falseCRecord, 150_000_000, false);
        await placeFor(falseD, falseDRecord, 50_000_000, false);

        const pooled = await bettingProgram.account.bettingQuestion.fetch(market.question);

        console.log("Gross bets:", pooled.totalBetsBeforeCommission.toString());
        console.log("TRUE pool:", pooled.totalBetsOption1.toString());
        console.log("FALSE pool:", pooled.totalBetsOption2.toString());
        console.log("Net pool:", pooled.totalPool.toString());
        console.log("TRUE odds:", pooled.option1Odds);
        console.log("FALSE odds:", pooled.option2Odds);
        console.log("Bettor records:", pooled.bettorRecordsCount.toString());

        assert.equal(pooled.totalBetsBeforeCommission.toString(), "500000000");
        assert.equal(pooled.totalBetsOption1.toString(), "300000000");
        assert.equal(pooled.totalBetsOption2.toString(), "200000000");
        assert.equal(pooled.totalPool.toString(), "495000000");
        assert.equal(pooled.bettorRecordsCount.toString(), "4");
        assert.closeTo(pooled.option1Odds, 1.65, 0.000000001);

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

        const stored = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultBeforeClaims = await provider.connection.getBalance(market.vault);

        console.log("Stored winner:", stored.winner);
        console.log("Stored percentage:", stored.winningPercentage);
        console.log("Vault before claims:", vaultBeforeClaims);

        console.log("STEP 4: TRUE A claims");
        await bettingProgram.methods.claimWinnings().accounts({
            bettingQuestion: market.question,
            bettorAccount: trueARecord,
            user,
            vault: market.vault,
        }).rpc();

        const trueAAfter = await bettingProgram.account.bettorAccount.fetch(trueARecord);
        const vaultAfterA = await provider.connection.getBalance(market.vault);

        console.log("TRUE A winnings:", trueAAfter.winnings.toString());
        console.log("TRUE A vault payout:", vaultBeforeClaims - vaultAfterA);

        console.log("STEP 5: TRUE B claims");
        await bettingProgram.methods.claimWinnings().accounts({
            bettingQuestion: market.question,
            bettorAccount: trueBRecord,
            user: trueB.publicKey,
            vault: market.vault,
        }).signers([trueB]).rpc();

        const trueBAfter = await bettingProgram.account.bettorAccount.fetch(trueBRecord);
        const vaultAfterB = await provider.connection.getBalance(market.vault);

        console.log("TRUE B winnings:", trueBAfter.winnings.toString());
        console.log("TRUE B vault payout:", vaultAfterA - vaultAfterB);

        console.log("STEP 6: verify FALSE bettors cannot claim");

        let falseCRejected = false;
        let falseDRejected = false;
        let falseCError = "";
        let falseDError = "";

        try {
            await bettingProgram.methods.claimWinnings().accounts({
                bettingQuestion: market.question,
                bettorAccount: falseCRecord,
                user: falseC.publicKey,
                vault: market.vault,
            }).signers([falseC]).rpc();
        } catch (error: any) {
            falseCRejected = true;
            falseCError = getErrorCode(error);
        }

        try {
            await bettingProgram.methods.claimWinnings().accounts({
                bettingQuestion: market.question,
                bettorAccount: falseDRecord,
                user: falseD.publicKey,
                vault: market.vault,
            }).signers([falseD]).rpc();
        } catch (error: any) {
            falseDRejected = true;
            falseDError = getErrorCode(error);
        }

        const falseCAfter = await bettingProgram.account.bettorAccount.fetch(falseCRecord);
        const falseDAfter = await bettingProgram.account.bettorAccount.fetch(falseDRecord);
        const vaultFinal = await provider.connection.getBalance(market.vault);

        const payoutA = vaultBeforeClaims - vaultAfterA;
        const payoutB = vaultAfterA - vaultAfterB;
        const totalWinnerPayout = payoutA + payoutB;

        console.log("");
        console.log("=== SBX-27 RESULT ===");
        console.log("TRUE A winnings:", trueAAfter.winnings.toString());
        console.log("TRUE B winnings:", trueBAfter.winnings.toString());
        console.log("Total winner payout:", totalWinnerPayout);
        console.log("Expected total payout:", 495_000_000);
        console.log("FALSE C rejected:", falseCRejected, falseCError);
        console.log("FALSE D rejected:", falseDRejected, falseDError);
        console.log("FALSE C winnings:", falseCAfter.winnings.toString());
        console.log("FALSE D winnings:", falseDAfter.winnings.toString());
        console.log("Vault change after loser attempts:", vaultFinal - vaultAfterB);

        assert.equal(stored.winner, 1, "TRUE must be stored winner");
        assert.equal(stored.winningPercentage, 100, "Truth consensus must be 100%");
        assert.equal(trueAAfter.claimed, true);
        assert.equal(trueBAfter.claimed, true);
        assert.equal(trueAAfter.winnings.toString(), "165000000", "TRUE A payout must be 0.165 SOL");
        assert.equal(trueBAfter.winnings.toString(), "330000000", "TRUE B payout must be 0.330 SOL");
        assert.equal(payoutA, 165_000_000);
        assert.equal(payoutB, 330_000_000);
        assert.equal(totalWinnerPayout, 495_000_000, "Winner payouts must equal net pool");
        assert.equal(falseCRejected, true);
        assert.equal(falseDRejected, true);
        assert.include(falseCError, "UserDidNotWin");
        assert.include(falseDError, "UserDidNotWin");
        assert.equal(falseCAfter.claimed, false);
        assert.equal(falseDAfter.claimed, false);
        assert.equal(falseCAfter.winnings.toString(), "0");
        assert.equal(falseDAfter.winnings.toString(), "0");
        assert.equal(vaultFinal, vaultAfterB, "Loser attempts must not change vault");

        console.log("");
        console.log("SBX-27 MULTI-BETTOR ACCOUNTING AND SOLVENCY VERIFIED");
    });
});