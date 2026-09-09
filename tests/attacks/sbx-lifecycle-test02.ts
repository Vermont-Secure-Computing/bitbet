import { BN } from "@coral-xyz/anchor";
import {
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";
import { assert } from "chai";
import { keccak256 } from "js-sha3";
import {
    provider,
    user,
    bettingProgram,
    truthProgram,
    ensureTestEnvironment,
    createTruthQuestion,
    createBettingMarket,
    sleep,
} from "../helpers/solbetx-test-helpers";

describe("SBX-LIFECYCLE-02", () => {
    const houseWallet = new PublicKey(
        "CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL"
    );

    before(async () => {
        console.log("");
        console.log("=== SBX LIFECYCLE 02 ===");
        console.log("RPC:", provider.connection.rpcEndpoint);
        console.log("Wallet:", user.toBase58());
        console.log("SolBetX:", bettingProgram.programId.toBase58());
        console.log("Truth:", truthProgram.programId.toBase58());

        await ensureTestEnvironment();
    });

    function deriveGlobalState() {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("global_state")],
            truthProgram.programId
        )[0];
    }

    function deriveUserRecord(voter: PublicKey) {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("user_record"), voter.toBuffer()],
            truthProgram.programId
        )[0];
    }

    function deriveVoterRecord(
        voter: PublicKey,
        question: PublicKey
    ) {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from("vote"),
                voter.toBuffer(),
                question.toBuffer(),
            ],
            truthProgram.programId
        )[0];
    }

    async function fundWallet(wallet: PublicKey) {
        await provider.sendAndConfirm(
            new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: user,
                    toPubkey: wallet,
                    lamports: LAMPORTS_PER_SOL,
                })
            ),
            []
        );
    }

    async function ensureVoter(voter: Keypair) {
        const globalState = deriveGlobalState();
        const userRecord = deriveUserRecord(voter.publicKey);

        const global =
            await truthProgram.account.globalState
                .fetch(globalState)
                .catch(() => null);

        if (!global) {
            await truthProgram.methods
                .initializeGlobalState()
                .accounts({
                    globalState,
                    payer: user,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
        }

        const existing =
            await truthProgram.account.userRecord
                .fetch(userRecord)
                .catch(() => null);

        if (!existing) {
            await truthProgram.methods
                .joinNetwork()
                .accounts({
                    globalState,
                    userRecord,
                    invite: null,
                    user: voter.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([voter])
                .rpc();
        }

        return userRecord;
    }

    async function commitVote(
        voter: Keypair,
        question: PublicKey,
        vote: 1 | 2,
        password: string
    ) {
        const userRecord = await ensureVoter(voter);
        const voterRecord = deriveVoterRecord(
            voter.publicKey,
            question
        );

        const commitmentInput = Buffer.concat([
            Buffer.from("truth-vote-v1", "utf8"),
            question.toBuffer(),
            voter.publicKey.toBuffer(),
            Buffer.from([vote]),
            Buffer.from(password, "utf8"),
        ]);

        const commitment = Buffer.from(
            keccak256.arrayBuffer(commitmentInput)
        );

        await truthProgram.methods
            .commitVote(commitment)
            .accounts({
                question,
                voterRecord,
                userRecord,
                voter: voter.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([voter])
            .rpc();

        return { userRecord, voterRecord };
    }

    async function revealVote(
        voter: Keypair,
        question: PublicKey,
        userRecord: PublicKey,
        voterRecord: PublicKey,
        password: string
    ) {
        await truthProgram.methods
            .revealVote(password)
            .accounts({
                question,
                voterRecord,
                userRecord,
                voter: voter.publicKey,
            })
            .signers([voter])
            .rpc();
    }

    it("finalizes Truth with 3 voters and stores the winner in SolBetX", async () => {
        const title = "SBX local 3 voter lifecycle";

        const truth = await createTruthQuestion(
            title,
            10,
            20
        );

        const market = await createBettingMarket(
            title,
            truth.question,
            5
        );

        console.log("");
        console.log("Truth question:", truth.question.toBase58());
        console.log("SolBetX market:", market.question.toBase58());

        const voter1 = Keypair.generate();
        const voter2 = Keypair.generate();
        const voter3 = Keypair.generate();

        console.log("");
        console.log("Funding 3 local Truth voters...");

        await fundWallet(voter1.publicKey);
        await fundWallet(voter2.publicKey);
        await fundWallet(voter3.publicKey);

        const password1 = `sbx-v1-${Date.now()}`;
        const password2 = `sbx-v2-${Date.now()}`;
        const password3 = `sbx-v3-${Date.now()}`;

        console.log("STEP 1: 3 voters commit TRUE");

        const record1 = await commitVote(
            voter1,
            truth.question,
            1,
            password1
        );

        const record2 = await commitVote(
            voter2,
            truth.question,
            1,
            password2
        );

        const record3 = await commitVote(
            voter3,
            truth.question,
            1,
            password3
        );

        let truthData =
            await truthProgram.account.question.fetch(
                truth.question
            );

        console.log(
            "Committed voters:",
            truthData.committedVoters.toString()
        );

        assert.equal(
            truthData.committedVoters.toString(),
            "3"
        );

        console.log("Waiting for commit phase to end...");
        await sleep(11_000);

        console.log("STEP 2: 3 voters reveal TRUE");

        await revealVote(
            voter1,
            truth.question,
            record1.userRecord,
            record1.voterRecord,
            password1
        );

        await revealVote(
            voter2,
            truth.question,
            record2.userRecord,
            record2.voterRecord,
            password2
        );

        await revealVote(
            voter3,
            truth.question,
            record3.userRecord,
            record3.voterRecord,
            password3
        );

        truthData =
            await truthProgram.account.question.fetch(
                truth.question
            );

        console.log(
            "Revealed voters:",
            truthData.revealedVotersCount.toString()
        );

        console.log(
            "TRUE votes:",
            truthData.votesOption1.toString()
        );

        console.log(
            "FALSE votes:",
            truthData.votesOption2.toString()
        );

        assert.equal(
            truthData.revealedVotersCount.toString(),
            "3"
        );

        assert.equal(
            truthData.votesOption1.toString(),
            "3"
        );

        assert.equal(
            truthData.votesOption2.toString(),
            "0"
        );

        console.log("Waiting for reveal phase to end...");
        await sleep(10_000);

        console.log("STEP 3: finalize Truth");

        await truthProgram.methods
            .finalizeVoting(truth.id)
            .accounts({
                question: truth.question,
            })
            .rpc();

        truthData =
            await truthProgram.account.question.fetch(
                truth.question
            );

        console.log("Truth finalized:", truthData.finalized);
        console.log("Truth winner:", truthData.winningOption);
        console.log(
            "Truth percentage:",
            truthData.winningPercent
        );

        assert.equal(truthData.finalized, true);
        assert.equal(truthData.winningOption, 1);
        assert.equal(truthData.winningPercent, 100);

        console.log("STEP 4: SolBetX fetches Truth result");

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

        const settled =
            await bettingProgram.account.bettingQuestion.fetch(
                market.question
            );

        console.log("");
        console.log("=== STORED SOLBETX RESULT ===");
        console.log("Status:", settled.status);
        console.log("Winner:", settled.winner);
        console.log(
            "Winning percentage:",
            settled.winningPercentage
        );
        console.log(
            "Claim expires at:",
            settled.claimExpiresAt.toString()
        );

        const expectedExpiry = new BN(
            truthData.revealEndTime.toString()
        ).add(new BN(120));

        assert.equal(settled.status, "close");
        assert.equal(settled.winner, 1);
        assert.equal(settled.winningPercentage, 100);

        assert.equal(
            settled.claimExpiresAt.toString(),
            expectedExpiry.toString(),
            "SolBetX claim deadline must remain Truth reveal_end_time + 120"
        );

        console.log("");
        console.log("SBX 3-VOTER TRUTH → SOLBETX LIFECYCLE VERIFIED");
    });
});