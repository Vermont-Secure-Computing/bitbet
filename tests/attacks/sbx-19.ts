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

describe("SBX-19", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-19: losing bettor can be deleted using stored result without Truth account", async () => {
        const betAmount = new BN(100_000_000);
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
        const loser = Keypair.generate();

        const airdrop = await provider.connection.requestAirdrop(loser.publicKey, LAMPORTS_PER_SOL);
        const latest = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({ signature: airdrop, ...latest }, "confirmed");

        const truth = await createTruthQuestion("SBX-19 stored result cleanup", 10, 20);
        const market = await createBettingMarket("SBX-19 stored result cleanup", truth.question, 5);
        const winnerBettor = deriveBettor(market.question);
        const [loserBettor] = PublicKey.findProgramAddressSync(
            [Buffer.from("bettor"), loser.publicKey.toBuffer(), market.question.toBuffer()],
            bettingProgram.programId
        );

        console.log("");
        console.log("SBX-19 Market:", market.question.toBase58());
        console.log("Linked Truth:", truth.question.toBase58());
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

        console.log("STEP 4: SolBetX stores result");
        await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
            bettingQuestion: market.question,
            truthNetworkQuestion: truth.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: market.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const loserBefore = await bettingProgram.account.bettorAccount.fetch(loserBettor);
        const vaultBefore = await provider.connection.getBalance(market.vault);

        console.log("Stored winner:", marketBefore.winner);
        console.log("Stored percentage:", marketBefore.winningPercentage);
        console.log("Loser chose TRUE:", loserBefore.chosenOption);
        console.log("Loser claimed:", loserBefore.claimed);
        console.log("Records closed before:", marketBefore.bettorRecordsClosed);

        console.log("");
        console.log("=== SBX-19 TRUTH-INDEPENDENT CLEANUP ===");
        console.log("Deleting loser bettor without supplying any Truth account");

        await bettingProgram.methods.deleteBettorAccount().accounts({
            bettingQuestion: market.question,
            bettorAccount: loserBettor,
            user: loser.publicKey,
        }).signers([loser]).rpc();

        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const loserAfter = await bettingProgram.account.bettorAccount.fetchNullable(loserBettor);
        const vaultAfter = await provider.connection.getBalance(market.vault);

        console.log("");
        console.log("=== SBX-19 RESULT ===");
        console.log("Bettor account exists after delete:", loserAfter !== null);
        console.log("Records closed before:", marketBefore.bettorRecordsClosed);
        console.log("Records closed after:", marketAfter.bettorRecordsClosed);
        console.log("Vault change:", vaultAfter - vaultBefore);

        assert.equal(marketBefore.winner, 1, "Stored winner must be TRUE");
        assert.equal(loserBefore.chosenOption, false, "Deleted bettor must be losing FALSE bettor");
        assert.equal(loserBefore.claimed, false, "Loser should not need to claim");
        assert.isNull(loserAfter, "Losing bettor account must be closed");
        assert.equal(
            marketAfter.bettorRecordsClosed.toString(),
            marketBefore.bettorRecordsClosed.add(new BN(1)).toString(),
            "Closed bettor count must increase by one"
        );
        assert.equal(vaultAfter, vaultBefore, "Betting vault must not be touched by bettor deletion");

        console.log("");
        console.log("SBX-19 STORED-RESULT BETTOR CLEANUP VERIFIED");
    });
});