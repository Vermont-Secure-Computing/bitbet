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

describe("SBX-25", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-25: winner below 75 percent consensus uses refund path", async () => {
        const betAmount = new BN(100_000_000);
        const expectedRefund = 99_000_000;
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
        const voterB = Keypair.generate();
        const voterC = Keypair.generate();

        for (const voter of [voterB, voterC]) {
            const sig = await provider.connection.requestAirdrop(voter.publicKey, LAMPORTS_PER_SOL);
            const latest = await provider.connection.getLatestBlockhash();
            await provider.connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
        }

        const truth = await createTruthQuestion("SBX-25 below 75 consensus", 10, 20);
        const market = await createBettingMarket("SBX-25 below 75 consensus", truth.question, 5);
        const bettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-25 Market:", market.question.toBase58());
        console.log("Linked Truth:", truth.question.toBase58());
        console.log("Voter A TRUE:", user.toBase58());
        console.log("Voter B TRUE:", voterB.publicKey.toBase58());
        console.log("Voter C FALSE:", voterC.publicKey.toBase58());

        console.log("");
        console.log("STEP 1: bettor places 0.1 SOL FALSE");
        await placeBet(market.question, market.vault, truth.question, truth.vault, bettor, betAmount, false);

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

        console.log("STEP 2: voters B and C join Truth Network");
        for (const [voter, records] of [[voterB, recordsB], [voterC, recordsC]] as const) {
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

        const passwordA = `sbx25-a-${Date.now()}`;
        const passwordB = `sbx25-b-${Date.now()}`;
        const passwordC = `sbx25-c-${Date.now()}`;

        console.log("STEP 3: commit two TRUE votes and one FALSE vote");
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

        await truthProgram.methods.commitVote(makeCommitment(voterC.publicKey, 2, passwordC)).accounts({
            question: truth.question,
            voterRecord: recordsC.voterRecord,
            userRecord: recordsC.userRecord,
            voter: voterC.publicKey,
            systemProgram: SystemProgram.programId,
        }).signers([voterC]).rpc();

        console.log("STEP 4: wait for reveal phase");
        await sleep(11_000);

        console.log("STEP 5: reveal all three votes");
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

        console.log("STEP 6: wait for reveal period to end");
        await sleep(10_000);

        console.log("STEP 7: finalize Truth");
        await truthProgram.methods.finalizeVoting(truth.id).accounts({
            question: truth.question,
        }).rpc();

        console.log("STEP 8: SolBetX stores result");
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
        console.log("Bettor chose TRUE:", bettorBefore.chosenOption);

        console.log("STEP 9: FALSE bettor claims refund");
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
        console.log("=== SBX-25 RESULT ===");
        console.log("Stored winner:", marketStored.winner);
        console.log("Stored percentage:", marketStored.winningPercentage);
        console.log("Bettor chose TRUE:", bettorAfter.chosenOption);
        console.log("Claimed:", bettorAfter.claimed);
        console.log("Stored winnings:", bettorAfter.winnings.toString());
        console.log("Expected refund:", expectedRefund);
        console.log("Vault payout:", payout);

        assert.equal(marketStored.winner, 1, "TRUE must be leading Truth option");
        assert.isBelow(marketStored.winningPercentage, 75, "Consensus must be below 75%");
        assert.equal(bettorAfter.chosenOption, false, "Bettor must be on non-leading FALSE side");
        assert.equal(bettorAfter.claimed, true, "Bettor must receive refund");
        assert.equal(bettorAfter.winnings.toString(), expectedRefund.toString(), "Refund must equal 99% of bet");
        assert.equal(payout, expectedRefund, "Vault reduction must equal refund");

        console.log("");
        console.log("SBX-25 BELOW-75 CONSENSUS REFUND VERIFIED");
    });
});