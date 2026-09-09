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

describe("SBX-15", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-15: losing bettor cannot claim winnings", async () => {
        const betAmount = new BN(100_000_000);
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
        const loser = Keypair.generate();

        const airdrop = await provider.connection.requestAirdrop(loser.publicKey, LAMPORTS_PER_SOL);
        const latest = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({ signature: airdrop, ...latest }, "confirmed");

        const truth = await createTruthQuestion("SBX-15 real losing bettor protection", 10, 20);
        const market = await createBettingMarket("SBX-15 real losing bettor protection", truth.question, 5);
        const winnerBettor = deriveBettor(market.question);

        const [loserBettor] = PublicKey.findProgramAddressSync(
            [Buffer.from("bettor"), loser.publicKey.toBuffer(), market.question.toBuffer()],
            bettingProgram.programId
        );

        console.log("");
        console.log("SBX-15 Market:", market.question.toBase58());
        console.log("TRUE bettor:", user.toBase58());
        console.log("FALSE bettor:", loser.publicKey.toBase58());

        console.log("");
        console.log("STEP 1: bettor A places 0.1 SOL TRUE");
        await placeBet(market.question, market.vault, truth.question, truth.vault, winnerBettor, betAmount, true);

        console.log("STEP 2: bettor B places 0.1 SOL FALSE");
        await bettingProgram.methods.placeBet(betAmount, false).accounts({
            bettingQuestion: market.question,
            bettorAccount: loserBettor,
            user: loser.publicKey,
            vault: market.vault,
            truthNetworkQuestion: truth.question,
            betProgram: bettingProgram.programId,
            truthNetworkProgram: truthProgram.programId,
            systemProgram: SystemProgram.programId,
            truthNetworkVault: truth.vault,
        }).signers([loser]).rpc();

        console.log("STEP 3: Truth resolves TRUE");
        await makeTruthWinner(truth.question, truth.id, 1, 11_000, 10_000);

        console.log("STEP 4: SolBetX stores TRUE result");
        await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
            bettingQuestion: market.question,
            truthNetworkQuestion: truth.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: market.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        const marketStored = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const loserBefore = await bettingProgram.account.bettorAccount.fetch(loserBettor);
        const vaultBefore = await provider.connection.getBalance(market.vault);
        const loserBalanceBefore = await provider.connection.getBalance(loser.publicKey);

        console.log("Stored winner:", marketStored.winner);
        console.log("Stored percentage:", marketStored.winningPercentage);
        console.log("Loser chose TRUE:", loserBefore.chosenOption);

        console.log("");
        console.log("=== SBX-15 LOSER CLAIM ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods.claimWinnings().accounts({
                bettingQuestion: market.question,
                bettorAccount: loserBettor,
                user: loser.publicKey,
                vault: market.vault,
            }).signers([loser]).rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        const loserAfter = await bettingProgram.account.bettorAccount.fetch(loserBettor);
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const loserBalanceAfter = await provider.connection.getBalance(loser.publicKey);

        console.log("");
        console.log("=== SBX-15 RESULT ===");
        console.log("Claim rejected:", rejected);
        console.log("Error:", errorCode);
        console.log("Vault change:", vaultAfter - vaultBefore);
        console.log("Loser balance change:", loserBalanceAfter - loserBalanceBefore);
        console.log("Claimed before:", loserBefore.claimed);
        console.log("Claimed after:", loserAfter.claimed);
        console.log("Winnings before:", loserBefore.winnings.toString());
        console.log("Winnings after:", loserAfter.winnings.toString());

        assert.equal(marketStored.winner, 1, "Stored winner must be TRUE");
        assert.equal(loserBefore.chosenOption, false, "Attacker must be FALSE bettor");
        assert.equal(rejected, true, "Losing bettor must be rejected");
        assert.include(String(errorCode), "UserDidNotWin", "Expected UserDidNotWin");
        assert.equal(vaultAfter, vaultBefore, "Vault must remain unchanged");
        assert.equal(loserBalanceAfter, loserBalanceBefore, "Rejected transaction must not cost loser SOL");
        assert.equal(loserAfter.claimed, false, "Loser must remain unclaimed");
        assert.equal(loserAfter.winnings.toString(), "0", "Loser winnings must remain zero");

        console.log("");
        console.log("SBX-15 LOSING BETTOR CLAIM PROTECTION VERIFIED");
    });
});