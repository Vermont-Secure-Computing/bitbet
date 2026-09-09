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

describe("SBX-26", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-26: exactly 75 percent consensus uses winner path", async () => {
        const betAmount = new BN(100_000_000);
        const expectedWinnerPayout = 198_000_000;
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
        const falseBettor = Keypair.generate();
        const voterB = Keypair.generate();
        const voterC = Keypair.generate();
        const voterD = Keypair.generate();

        for (const wallet of [falseBettor, voterB, voterC, voterD]) {
            const sig = await provider.connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL);
            const latest = await provider.connection.getLatestBlockhash();
            await provider.connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
        }

        const truth = await createTruthQuestion("SBX-26 exactly 75 consensus", 10, 20);
        const market = await createBettingMarket("SBX-26 exactly 75 consensus", truth.question, 5);
        const trueBettor = deriveBettor(market.question);

        const [falseBettorPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("bettor"), falseBettor.publicKey.toBuffer(), market.question.toBuffer()],
            bettingProgram.programId
        );

        console.log("");
        console.log("SBX-26 Market:", market.question.toBase58());
        console.log("Linked Truth:", truth.question.toBase58());
        console.log("TRUE bettor:", user.toBase58());
        console.log("FALSE bettor:", falseBettor.publicKey.toBase58());
        console.log("Voter A TRUE:", user.toBase58());
        console.log("Voter B TRUE:", voterB.publicKey.toBase58());
        console.log("Voter C TRUE:", voterC.publicKey.toBase58());
        console.log("Voter D FALSE:", voterD.publicKey.toBase58());

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

        const [globalState] = PublicKey.findProgramAddressSync(
            [Buffer.from("global_state")],
            truthProgram.programId
        );

        const userRecordA = await ensureTruthVoter();
        const voterRecordA = deriveTruthVoterRecord(truth.question);

        const getRecords = (voter: PublicKey) => {
            const [userRecord] = PublicKey.findProgramAddressSync(
                [Buffer.from("user_record"), voter.toBuffer()],
                truthProgram.programId
            );
            const [voterRecord] = PublicKey.findProgramAddressSync(
                [Buffer.from("vote"), voter.toBuffer(), truth.question.toBuffer()],
                truthProgram.programId
            );
            return { userRecord, voterRecord };
        };

        const recordsB = getRecords(voterB.publicKey);
        const recordsC = getRecords(voterC.publicKey);
        const recordsD = getRecords(voterD.publicKey);

        console.log("STEP 3: voters B, C and D join Truth Network");
        for (const [voter, records] of [
            [voterB, recordsB],
            [voterC, recordsC],
            [voterD, recordsD],
        ] as const) {
            await truthProgram.methods.joinNetwork().accounts({
                globalState,
                userRecord: records.userRecord,
                invite: null,
                user: voter.publicKey,
                systemProgram: SystemProgram.programId,
            }).signers([voter]).rpc();
        }

        const makeCommitment = (voter: PublicKey, vote: 1 | 2, password: string) =>
            Buffer.from(keccak256.arrayBuffer(Buffer.concat([
                Buffer.from("truth-vote-v1", "utf8"),
                truth.question.toBuffer(),
                voter.toBuffer(),
                Buffer.from([vote]),
                Buffer.from(password, "utf8"),
            ])));

        const passwordA = `sbx26-a-${Date.now()}`;
        const passwordB = `sbx26-b-${Date.now()}`;
        const passwordC = `sbx26-c-${Date.now()}`;
        const passwordD = `sbx26-d-${Date.now()}`;

        console.log("STEP 4: commit three TRUE votes and one FALSE vote");
        await truthProgram.methods.commitVote(makeCommitment(user, 1, passwordA)).accounts({
            question: truth.question,
            voterRecord: voterRecordA,
            userRecord: userRecordA,
            voter: user,
            systemProgram: SystemProgram.programId,
        }).rpc();

        await truthProgram.methods.commitVote(makeCommitment(voterB.publicKey, 1, passwordB)).accounts({
            question: truth.question,
            voterRecord: recordsB.voterRecord,
            userRecord: recordsB.userRecord,
            voter: voterB.publicKey,
            systemProgram: SystemProgram.programId,
        }).signers([voterB]).rpc();

        await truthProgram.methods.commitVote(makeCommitment(voterC.publicKey, 1, passwordC)).accounts({
            question: truth.question,
            voterRecord: recordsC.voterRecord,
            userRecord: recordsC.userRecord,
            voter: voterC.publicKey,
            systemProgram: SystemProgram.programId,
        }).signers([voterC]).rpc();

        await truthProgram.methods.commitVote(makeCommitment(voterD.publicKey, 2, passwordD)).accounts({
            question: truth.question,
            voterRecord: recordsD.voterRecord,
            userRecord: recordsD.userRecord,
            voter: voterD.publicKey,
            systemProgram: SystemProgram.programId,
        }).signers([voterD]).rpc();

        console.log("STEP 5: wait for reveal phase");
        await sleep(11_000);

        console.log("STEP 6: reveal all four votes");
        await truthProgram.methods.revealVote(passwordA).accounts({
            question: truth.question,
            voterRecord: voterRecordA,
            userRecord: userRecordA,
            voter: user,
        }).rpc();

        await truthProgram.methods.revealVote(passwordB).accounts({
            question: truth.question,
            voterRecord: recordsB.voterRecord,
            userRecord: recordsB.userRecord,
            voter: voterB.publicKey,
        }).signers([voterB]).rpc();

        await truthProgram.methods.revealVote(passwordC).accounts({
            question: truth.question,
            voterRecord: recordsC.voterRecord,
            userRecord: recordsC.userRecord,
            voter: voterC.publicKey,
        }).signers([voterC]).rpc();

        await truthProgram.methods.revealVote(passwordD).accounts({
            question: truth.question,
            voterRecord: recordsD.voterRecord,
            userRecord: recordsD.userRecord,
            voter: voterD.publicKey,
        }).signers([voterD]).rpc();

        console.log("STEP 7: wait for reveal period to end");
        await sleep(10_000);

        console.log("STEP 8: finalize Truth");
        await truthProgram.methods.finalizeVoting(truth.id).accounts({
            question: truth.question,
        }).rpc();

        console.log("STEP 9: SolBetX stores result");
        await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
            bettingQuestion: market.question,
            truthNetworkQuestion: truth.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: market.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        const marketStored = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const trueBefore = await bettingProgram.account.bettorAccount.fetch(trueBettor);
        const falseBefore = await bettingProgram.account.bettorAccount.fetch(falseBettorPda);
        const vaultBefore = await provider.connection.getBalance(market.vault);

        console.log("Stored winner:", marketStored.winner);
        console.log("Stored percentage:", marketStored.winningPercentage);
        console.log("TRUE bettor claimed:", trueBefore.claimed);
        console.log("FALSE bettor claimed:", falseBefore.claimed);

        console.log("STEP 10: TRUE bettor claims winner payout");
        await bettingProgram.methods.claimWinnings().accounts({
            bettingQuestion: market.question,
            bettorAccount: trueBettor,
            user,
            vault: market.vault,
        }).rpc();

        const trueAfter = await bettingProgram.account.bettorAccount.fetch(trueBettor);
        const falseAfter = await bettingProgram.account.bettorAccount.fetch(falseBettorPda);
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const payout = vaultBefore - vaultAfter;

        console.log("");
        console.log("=== SBX-26 RESULT ===");
        console.log("Stored winner:", marketStored.winner);
        console.log("Stored percentage:", marketStored.winningPercentage);
        console.log("TRUE claimed:", trueAfter.claimed);
        console.log("TRUE winnings:", trueAfter.winnings.toString());
        console.log("Expected winner payout:", expectedWinnerPayout);
        console.log("FALSE claimed:", falseAfter.claimed);
        console.log("FALSE winnings:", falseAfter.winnings.toString());
        console.log("Vault payout:", payout);

        assert.equal(marketStored.winner, 1, "TRUE must be stored winner");
        assert.equal(marketStored.winningPercentage, 75, "Consensus must be exactly 75%");
        assert.equal(trueAfter.claimed, true, "TRUE winner must successfully claim");
        assert.equal(trueAfter.winnings.toString(), expectedWinnerPayout.toString(), "TRUE bettor must receive winner payout");
        assert.equal(payout, expectedWinnerPayout, "Vault reduction must equal winner payout");
        assert.equal(falseAfter.claimed, false, "FALSE loser must remain unclaimed");
        assert.equal(falseAfter.winnings.toString(), "0", "FALSE loser must have zero winnings");

        console.log("");
        console.log("SBX-26 EXACT-75 WINNER PATH VERIFIED");
    });
});