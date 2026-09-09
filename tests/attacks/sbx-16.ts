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
} from "../helpers/solbetx-test-helpers";

describe("SBX-16", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-16: winner can claim after creator commission was already claimed", async () => {
        const betAmount = new BN(100_000_000);
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
        const falseBettor = Keypair.generate();

        const airdrop = await provider.connection.requestAirdrop(falseBettor.publicKey, LAMPORTS_PER_SOL);
        const latest = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({ signature: airdrop, ...latest }, "confirmed");

        const truth = await createTruthQuestion("SBX-16 commission before winner claim", 10, 20);
        const market = await createBettingMarket("SBX-16 commission before winner claim", truth.question, 5);
        const trueBettor = deriveBettor(market.question);
        const [falseBettorPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("bettor"), falseBettor.publicKey.toBuffer(), market.question.toBuffer()],
            bettingProgram.programId
        );

        console.log("");
        console.log("SBX-16 Market:", market.question.toBase58());
        console.log("TRUE bettor:", user.toBase58());
        console.log("FALSE bettor:", falseBettor.publicKey.toBase58());

        console.log("");
        console.log("STEP 1: bettor A places 0.1 SOL TRUE");
        await placeBet(market.question, market.vault, truth.question, truth.vault, trueBettor, betAmount, true);

        console.log("STEP 2: bettor B places 0.1 SOL FALSE");
        await bettingProgram.methods.placeBet(betAmount, false).accounts({
            bettingQuestion: market.question,
            bettorAccount: falseBettorPda,
            user: falseBettor.publicKey,
            vault: market.vault,
            truthNetworkQuestion: truth.question,
            betProgram: bettingProgram.programId,
            truthNetworkProgram: truthProgram.programId,
            systemProgram: SystemProgram.programId,
            truthNetworkVault: truth.vault,
        }).signers([falseBettor]).rpc();

        console.log("STEP 3: wait for betting close");
        await new Promise(resolve => setTimeout(resolve, 6_000));

        console.log("STEP 4: creator claims commission");
        await bettingProgram.methods.claimCreatorCommission().accounts({
            bettingQuestion: market.question,
            creator: user,
            vault: market.vault,
        }).rpc();

        const afterCommission = await bettingProgram.account.bettingQuestion.fetch(market.question);
        assert.equal(afterCommission.creatorCommissionClaimed, true, "Creator commission must be marked claimed");

        console.log("STEP 5: Truth resolves TRUE");
        await makeTruthWinner(truth.question, truth.id, 1, 5_000, 10_000);

        console.log("STEP 6: SolBetX stores TRUE result");
        await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
            bettingQuestion: market.question,
            truthNetworkQuestion: truth.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: market.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        const marketStored = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const winnerBefore = await bettingProgram.account.bettorAccount.fetch(trueBettor);
        const vaultBefore = await provider.connection.getBalance(market.vault);

        console.log("Stored winner:", marketStored.winner);
        console.log("Stored percentage:", marketStored.winningPercentage);

        console.log("STEP 7: TRUE winner claims");
        await bettingProgram.methods.claimWinnings().accounts({
            bettingQuestion: market.question,
            bettorAccount: trueBettor,
            user,
            vault: market.vault,
        }).rpc();

        const winnerAfter = await bettingProgram.account.bettorAccount.fetch(trueBettor);
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const payout = vaultBefore - vaultAfter;

        console.log("");
        console.log("=== SBX-16 RESULT ===");
        console.log("Creator commission claimed:", afterCommission.creatorCommissionClaimed);
        console.log("Winner claimed:", winnerAfter.claimed);
        console.log("Stored winnings:", winnerAfter.winnings.toString());
        console.log("Vault payout:", payout);

        assert.equal(marketStored.winner, 1, "Stored winner must be TRUE");
        assert.equal(winnerAfter.claimed, true, "Winner must successfully claim");
        assert.isAbove(Number(winnerAfter.winnings.toString()), 0, "Winner must receive winnings");
        assert.equal(payout, Number(winnerAfter.winnings.toString()), "Vault reduction must equal winner payout");

        console.log("");
        console.log("SBX-16 COMMISSION/PAYOUT ACCOUNTING VERIFIED");
    });
});