import { BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { keccak256 } from "js-sha3";
import { assert } from "chai";
import {
    provider,
    user,
    bettingProgram,
    truthProgram,
    sleep,
    ensureTestEnvironment,
    createTruthQuestion,
    createBettingMarket,
    deriveBettor,
    placeBet,
    ensureTruthVoter,
    deriveTruthVoterRecord,
} from "../helpers/solbetx-test-helpers";

describe("SBX-24", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-24: tied Truth vote produces refund behavior", async () => {
        const betAmount = new BN(100_000_000);
        const expectedRefund = 99_000_000;
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
        const voterB = Keypair.generate();

        const airdrop = await provider.connection.requestAirdrop(voterB.publicKey, LAMPORTS_PER_SOL);
        const latest = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({ signature: airdrop, ...latest }, "confirmed");

        const truth = await createTruthQuestion("SBX-24 exact tie refund", 10, 20);
        const market = await createBettingMarket("SBX-24 exact tie refund", truth.question, 5);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-24 Market:", market.question.toBase58());
        console.log("Linked Truth:", truth.question.toBase58());
        console.log("Voter A:", user.toBase58());
        console.log("Voter B:", voterB.publicKey.toBase58());

        console.log("");
        console.log("STEP 1: bettor places 0.1 SOL TRUE");
        await placeBet(market.question, market.vault, truth.question, truth.vault, bettor, betAmount, true);

        const userRecordA = await ensureTruthVoter();
        const voterRecordA = deriveTruthVoterRecord(truth.question);

        const [globalState] = PublicKey.findProgramAddressSync(
            [Buffer.from("global_state")],
            truthProgram.programId
        );

        const [userRecordB] = PublicKey.findProgramAddressSync(
            [Buffer.from("user_record"), voterB.publicKey.toBuffer()],
            truthProgram.programId
        );

        const [voterRecordB] = PublicKey.findProgramAddressSync(
            [Buffer.from("vote"), voterB.publicKey.toBuffer(), truth.question.toBuffer()],
            truthProgram.programId
        );

        console.log("STEP 2: voter B joins Truth Network");
        await truthProgram.methods.joinNetwork().accounts({
            globalState,
            userRecord: userRecordB,
            invite: null,
            user: voterB.publicKey,
            systemProgram: SystemProgram.programId,
        }).signers([voterB]).rpc();

        const passwordA = `sbx24-a-${Date.now()}`;
        const passwordB = `sbx24-b-${Date.now()}`;

        const commitmentA = Buffer.from(keccak256.arrayBuffer(Buffer.concat([
            Buffer.from("truth-vote-v1", "utf8"),
            truth.question.toBuffer(),
            user.toBuffer(),
            Buffer.from([1]),
            Buffer.from(passwordA, "utf8"),
        ])));

        const commitmentB = Buffer.from(keccak256.arrayBuffer(Buffer.concat([
            Buffer.from("truth-vote-v1", "utf8"),
            truth.question.toBuffer(),
            voterB.publicKey.toBuffer(),
            Buffer.from([2]),
            Buffer.from(passwordB, "utf8"),
        ])));

        console.log("STEP 3: voter A commits TRUE");
        await truthProgram.methods.commitVote(commitmentA).accounts({
            question: truth.question,
            voterRecord: voterRecordA,
            userRecord: userRecordA,
            voter: user,
            systemProgram: SystemProgram.programId,
        }).rpc();

        console.log("STEP 4: voter B commits FALSE");
        await truthProgram.methods.commitVote(commitmentB).accounts({
            question: truth.question,
            voterRecord: voterRecordB,
            userRecord: userRecordB,
            voter: voterB.publicKey,
            systemProgram: SystemProgram.programId,
        }).signers([voterB]).rpc();

        console.log("STEP 5: wait for reveal phase");
        await sleep(11_000);

        console.log("STEP 6: voter A reveals TRUE");
        await truthProgram.methods.revealVote(passwordA).accounts({
            question: truth.question,
            voterRecord: voterRecordA,
            userRecord: userRecordA,
            voter: user,
        }).rpc();

        console.log("STEP 7: voter B reveals FALSE");
        await truthProgram.methods.revealVote(passwordB).accounts({
            question: truth.question,
            voterRecord: voterRecordB,
            userRecord: userRecordB,
            voter: voterB.publicKey,
        }).signers([voterB]).rpc();

        console.log("STEP 8: wait for reveal period to end");
        await sleep(10_000);

        console.log("STEP 9: finalize tied Truth vote");
        await truthProgram.methods.finalizeVoting(truth.id).accounts({
            question: truth.question,
        }).rpc();

        console.log("STEP 10: SolBetX stores tied result");
        await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
            bettingQuestion: market.question,
            truthNetworkQuestion: truth.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: market.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        const marketStored = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const bettorBefore = await bettingProgram.account.bettorAccount.fetch(bettor);
        const vaultBefore = await provider.connection.getBalance(market.vault);

        console.log("Stored winner:", marketStored.winner);
        console.log("Stored percentage:", marketStored.winningPercentage);
        console.log("Claimed before:", bettorBefore.claimed);

        console.log("STEP 11: bettor claims tie refund");
        await bettingProgram.methods.claimWinnings().accounts({
            bettingQuestion: market.question,
            bettorAccount: bettor,
            user,
            vault: market.vault,
        }).rpc();

        const bettorAfter = await bettingProgram.account.bettorAccount.fetch(bettor);
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const payout = vaultBefore - vaultAfter;

        console.log("");
        console.log("=== SBX-24 RESULT ===");
        console.log("Stored winner:", marketStored.winner);
        console.log("Stored percentage:", marketStored.winningPercentage);
        console.log("Claimed:", bettorAfter.claimed);
        console.log("Stored winnings:", bettorAfter.winnings.toString());
        console.log("Expected refund:", expectedRefund);
        console.log("Vault payout:", payout);

        assert.equal(marketStored.winner, 0, "Tie must store winner 0");
        assert.equal(marketStored.winningPercentage, 50, "Exact tie must store 50%");
        assert.equal(bettorAfter.claimed, true, "Bettor must be able to claim refund");
        assert.equal(bettorAfter.winnings.toString(), expectedRefund.toString(), "Refund must equal 99% of bet");
        assert.equal(payout, expectedRefund, "Vault reduction must equal refund");

        console.log("");
        console.log("SBX-24 TIED TRUTH REFUND BEHAVIOR VERIFIED");
    });
});