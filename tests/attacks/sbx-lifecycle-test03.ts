import { BN } from "@coral-xyz/anchor";
import {
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
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
    deriveBettor,
    placeBet,
    sleep,
    getErrorCode,
} from "../helpers/solbetx-test-helpers";

describe("SBX-LIFECYCLE-03", () => {
    const houseWallet = new PublicKey(
        "CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL"
    );

    before(async () => {
        console.log("");
        console.log("=== SBX LIFECYCLE 03 ===");
        console.log("RPC:", provider.connection.rpcEndpoint);
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

    function deriveBettorFor(
        bettor: PublicKey,
        question: PublicKey
    ) {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from("bettor"),
                bettor.toBuffer(),
                question.toBuffer(),
            ],
            bettingProgram.programId
        )[0];
    }

    async function fund(wallet: PublicKey) {
        const sig = await provider.connection.requestAirdrop(
            wallet,
            LAMPORTS_PER_SOL
        );

        const latest =
            await provider.connection.getLatestBlockhash();

        await provider.connection.confirmTransaction(
            { signature: sig, ...latest },
            "confirmed"
        );
    }

    async function ensureVoter(voter: Keypair) {
        const globalState = deriveGlobalState();
        const userRecord = deriveUserRecord(voter.publicKey);

        const global = await truthProgram.account.globalState
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

        const existing = await truthProgram.account.userRecord
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

    async function commitTruthVote(
        voter: Keypair,
        question: PublicKey,
        password: string
    ) {
        const userRecord = await ensureVoter(voter);
        const voterRecord = deriveVoterRecord(
            voter.publicKey,
            question
        );

        const input = Buffer.concat([
            Buffer.from("truth-vote-v1", "utf8"),
            question.toBuffer(),
            voter.publicKey.toBuffer(),
            Buffer.from([1]),
            Buffer.from(password, "utf8"),
        ]);

        const commitment = Buffer.from(
            keccak256.arrayBuffer(input)
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

    async function revealTruthVote(
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

    it("allows claims before expiry and rejects them after expiry", async () => {
        const title = "SBX local claim expiry lifecycle";
        const betAmount = new BN(100_000_000);

        const secondTrueBettor = Keypair.generate();
        const falseBettor = Keypair.generate();

        await fund(secondTrueBettor.publicKey);
        await fund(falseBettor.publicKey);

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

        const trueBettorA = deriveBettor(market.question);
        const trueBettorB = deriveBettorFor(
            secondTrueBettor.publicKey,
            market.question
        );
        const falseBettorPda = deriveBettorFor(
            falseBettor.publicKey,
            market.question
        );

        console.log("");
        console.log("Truth:", truth.question.toBase58());
        console.log("Market:", market.question.toBase58());

        console.log("STEP 1: TRUE bettor A bets 0.1 SOL");

        await placeBet(
            market.question,
            market.vault,
            truth.question,
            truth.vault,
            trueBettorA,
            betAmount,
            true
        );

        console.log("STEP 2: TRUE bettor B bets 0.1 SOL");

        await bettingProgram.methods
            .placeBet(betAmount, true)
            .accounts({
                bettingQuestion: market.question,
                bettorAccount: trueBettorB,
                user: secondTrueBettor.publicKey,
                vault: market.vault,
                truthNetworkQuestion: truth.question,
                betProgram: bettingProgram.programId,
                truthNetworkProgram: truthProgram.programId,
                systemProgram: SystemProgram.programId,
                truthNetworkVault: truth.vault,
            })
            .signers([secondTrueBettor])
            .rpc();

        console.log("STEP 3: FALSE bettor bets 0.1 SOL");

        await bettingProgram.methods
            .placeBet(betAmount, false)
            .accounts({
                bettingQuestion: market.question,
                bettorAccount: falseBettorPda,
                user: falseBettor.publicKey,
                vault: market.vault,
                truthNetworkQuestion: truth.question,
                betProgram: bettingProgram.programId,
                truthNetworkProgram: truthProgram.programId,
                systemProgram: SystemProgram.programId,
                truthNetworkVault: truth.vault,
            })
            .signers([falseBettor])
            .rpc();

        const voter1 = Keypair.generate();
        const voter2 = Keypair.generate();
        const voter3 = Keypair.generate();

        await fund(voter1.publicKey);
        await fund(voter2.publicKey);
        await fund(voter3.publicKey);

        const password1 = `life03-v1-${Date.now()}`;
        const password2 = `life03-v2-${Date.now()}`;
        const password3 = `life03-v3-${Date.now()}`;

        console.log("STEP 4: 3 Truth voters commit TRUE");

        const record1 = await commitTruthVote(
            voter1,
            truth.question,
            password1
        );
        const record2 = await commitTruthVote(
            voter2,
            truth.question,
            password2
        );
        const record3 = await commitTruthVote(
            voter3,
            truth.question,
            password3
        );

        await sleep(11_000);

        console.log("STEP 5: 3 Truth voters reveal TRUE");

        await revealTruthVote(
            voter1,
            truth.question,
            record1.userRecord,
            record1.voterRecord,
            password1
        );
        await revealTruthVote(
            voter2,
            truth.question,
            record2.userRecord,
            record2.voterRecord,
            password2
        );
        await revealTruthVote(
            voter3,
            truth.question,
            record3.userRecord,
            record3.voterRecord,
            password3
        );

        await sleep(10_000);

        console.log("STEP 6: finalize Truth");

        await truthProgram.methods
            .finalizeVoting(truth.id)
            .accounts({
                question: truth.question,
            })
            .rpc();

        console.log("STEP 7: SolBetX stores result");

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

        let marketData =
            await bettingProgram.account.bettingQuestion.fetch(
                market.question
            );

        console.log("Winner:", marketData.winner);
        console.log(
            "Winning percentage:",
            marketData.winningPercentage
        );
        console.log(
            "Claim expires:",
            marketData.claimExpiresAt.toString()
        );

        assert.equal(marketData.status, "close");
        assert.equal(marketData.winner, 1);
        assert.equal(marketData.winningPercentage, 100);

        console.log(
            "STEP 8: TRUE bettor A claims before expiry"
        );

        await bettingProgram.methods
            .claimWinnings()
            .accounts({
                bettingQuestion: market.question,
                bettorAccount: trueBettorA,
                user,
                vault: market.vault,
            })
            .rpc();

        const winnerA =
            await bettingProgram.account.bettorAccount.fetch(
                trueBettorA
            );

        assert.equal(
            winnerA.claimed,
            true,
            "First TRUE bettor must claim before expiry"
        );

        console.log(
            "Winner A winnings:",
            winnerA.winnings.toString()
        );

        console.log(
            "STEP 9: intentionally leave TRUE bettor B and creator unclaimed"
        );

        const expiry =
            marketData.claimExpiresAt.toNumber();

        const now = Math.floor(Date.now() / 1000);

        const waitMs = Math.max(
            0,
            (expiry - now + 2) * 1000
        );

        console.log(
            `Waiting ${Math.ceil(waitMs / 1000)}s to cross claim expiry...`
        );

        await sleep(waitMs);

        console.log(
            "STEP 10: TRUE bettor B attempts late claim"
        );

        let bettorRejected = false;
        let bettorError = "";

        try {
            await bettingProgram.methods
                .claimWinnings()
                .accounts({
                    bettingQuestion: market.question,
                    bettorAccount: trueBettorB,
                    user: secondTrueBettor.publicKey,
                    vault: market.vault,
                })
                .signers([secondTrueBettor])
                .rpc();
        } catch (error: any) {
            bettorRejected = true;
            bettorError = getErrorCode(error);
            console.log(
                "Late bettor rejected with:",
                bettorError
            );
        }

        assert.equal(
            bettorRejected,
            true,
            "Winning bettor must not claim after expiry"
        );

        assert.include(
            String(bettorError),
            "ClaimWindowExpired"
        );

        const winnerBAfter =
            await bettingProgram.account.bettorAccount.fetch(
                trueBettorB
            );

        assert.equal(
            winnerBAfter.claimed,
            false,
            "Rejected late claim must not mark bettor claimed"
        );

        console.log(
            "STEP 11: creator attempts late commission claim"
        );

        let creatorRejected = false;
        let creatorError = "";

        try {
            await bettingProgram.methods
                .claimCreatorCommission()
                .accounts({
                    bettingQuestion: market.question,
                    creator: user,
                    vault: market.vault,
                })
                .rpc();
        } catch (error: any) {
            creatorRejected = true;
            creatorError = getErrorCode(error);
            console.log(
                "Late creator claim rejected with:",
                creatorError
            );
        }

        assert.equal(
            creatorRejected,
            true,
            "Creator commission must not be claimable after expiry"
        );

        assert.include(
            String(creatorError),
            "ClaimWindowExpired"
        );

        marketData =
            await bettingProgram.account.bettingQuestion.fetch(
                market.question
            );

        assert.equal(
            marketData.creatorCommissionClaimed,
            false,
            "Rejected late creator claim must not change state"
        );

        console.log("");
        console.log("=== SBX LIFECYCLE 03 RESULT ===");
        console.log("Winner A claimed:", winnerA.claimed);
        console.log(
            "Winner B claimed:",
            winnerBAfter.claimed
        );
        console.log(
            "Creator commission claimed:",
            marketData.creatorCommissionClaimed
        );
        console.log(
            "Late bettor error:",
            bettorError
        );
        console.log(
            "Late creator error:",
            creatorError
        );

        console.log("");
        console.log(
            "SBX CLAIM WINDOW EXPIRY VERIFIED"
        );
    });
});