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

describe("SBX-LIFECYCLE-06", () => {
    const houseWallet = new PublicKey(
        "CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL"
    );

    before(async () => {
        console.log("");
        console.log("=== SBX LIFECYCLE 06 ===");
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

    function deriveTruthUserRecord(voter: PublicKey) {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("user_record"), voter.toBuffer()],
            truthProgram.programId
        )[0];
    }

    function deriveTruthVoterRecord(
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
        const signature =
            await provider.connection.requestAirdrop(
                wallet,
                LAMPORTS_PER_SOL
            );

        const latest =
            await provider.connection.getLatestBlockhash();

        await provider.connection.confirmTransaction(
            { signature, ...latest },
            "confirmed"
        );
    }

    async function ensureTruthVoter(voter: Keypair) {
        const globalState = deriveGlobalState();
        const userRecord =
            deriveTruthUserRecord(voter.publicKey);

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

    async function commitTruthVote(
        voter: Keypair,
        question: PublicKey,
        password: string,
        vote: number
    ) {
        const userRecord =
            await ensureTruthVoter(voter);

        const voterRecord =
            deriveTruthVoterRecord(
                voter.publicKey,
                question
            );

        const input = Buffer.concat([
            Buffer.from("truth-vote-v1", "utf8"),
            question.toBuffer(),
            voter.publicKey.toBuffer(),
            Buffer.from([vote]),
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

        return {
            voter,
            userRecord,
            voterRecord,
            password,
        };
    }

    async function revealTruthVote(
        record: {
            voter: Keypair;
            userRecord: PublicKey;
            voterRecord: PublicKey;
            password: string;
        },
        question: PublicKey
    ) {
        await truthProgram.methods
            .revealVote(record.password)
            .accounts({
                question,
                voterRecord: record.voterRecord,
                userRecord: record.userRecord,
                voter: record.voter.publicKey,
            })
            .signers([record.voter])
            .rpc();
    }

    async function placeExternalBet(
        bettor: Keypair,
        bettorPda: PublicKey,
        market: {
            question: PublicKey;
            vault: PublicKey;
        },
        truth: {
            question: PublicKey;
            vault: PublicKey;
        },
        amount: BN,
        side: boolean
    ) {
        await bettingProgram.methods
            .placeBet(amount, side)
            .accounts({
                bettingQuestion: market.question,
                bettorAccount: bettorPda,
                user: bettor.publicKey,
                vault: market.vault,
                truthNetworkQuestion: truth.question,
                betProgram: bettingProgram.programId,
                truthNetworkProgram: truthProgram.programId,
                systemProgram: SystemProgram.programId,
                truthNetworkVault: truth.vault,
            })
            .signers([bettor])
            .rpc();
    }

    it("preserves both refund paths before expiry and rejects refunds after expiry", async () => {
        const betAmount = new BN(100_000_000);
        const expectedRefund = 99_000_000;

        const oneVoter1 = Keypair.generate();
        const oneVoter2 = Keypair.generate();
        const oneVoter3 = Keypair.generate();

        const lowVoter1 = Keypair.generate();
        const lowVoter2 = Keypair.generate();
        const lowVoter3 = Keypair.generate();

        const truthVoters = [
            oneVoter1,
            oneVoter2,
            oneVoter3,
            lowVoter1,
            lowVoter2,
            lowVoter3,
        ];

        for (const voter of truthVoters) {
            await fund(voter.publicKey);
            await ensureTruthVoter(voter);
        }

        const oneSideLateBettor = Keypair.generate();
        const lowConfidenceLateBettor = Keypair.generate();

        await fund(oneSideLateBettor.publicKey);
        await fund(lowConfidenceLateBettor.publicKey);

        console.log("");
        console.log(
            "STEP 1: create one-sided and low-confidence Truth questions"
        );

        const oneSideTruth =
            await createTruthQuestion(
                "SBX L06 one-sided refund",
                12,
                30
            );

        const lowConfidenceTruth =
            await createTruthQuestion(
                "SBX L06 low-confidence refund",
                12,
                30
            );

        const oneSideMarket =
            await createBettingMarket(
                "SBX L06 one-sided refund",
                oneSideTruth.question,
                5
            );

        const lowConfidenceMarket =
            await createBettingMarket(
                "SBX L06 low-confidence refund",
                lowConfidenceTruth.question,
                5
            );

        console.log(
            "One-sided market:",
            oneSideMarket.question.toBase58()
        );

        console.log(
            "Low-confidence market:",
            lowConfidenceMarket.question.toBase58()
        );

        /*
        * Market A:
        * two TRUE bets, zero FALSE bets.
        * Truth will resolve TRUE 100%.
        */
        const oneSideBettorA =
            deriveBettor(oneSideMarket.question);

        const oneSideBettorB =
            deriveBettorFor(
                oneSideLateBettor.publicKey,
                oneSideMarket.question
            );

        console.log("");
        console.log(
            "STEP 2: create one-sided market bets"
        );

        await placeBet(
            oneSideMarket.question,
            oneSideMarket.vault,
            oneSideTruth.question,
            oneSideTruth.vault,
            oneSideBettorA,
            betAmount,
            true
        );

        await placeExternalBet(
            oneSideLateBettor,
            oneSideBettorB,
            oneSideMarket,
            oneSideTruth,
            betAmount,
            true
        );

        /*
        * Market B:
        * one TRUE and one FALSE bet.
        * Truth will resolve 2 TRUE / 1 FALSE = 66.67%.
        */
        const lowConfidenceBettorA =
            deriveBettor(
                lowConfidenceMarket.question
            );

        const lowConfidenceBettorB =
            deriveBettorFor(
                lowConfidenceLateBettor.publicKey,
                lowConfidenceMarket.question
            );

        console.log(
            "STEP 3: create low-confidence market bets"
        );

        await placeBet(
            lowConfidenceMarket.question,
            lowConfidenceMarket.vault,
            lowConfidenceTruth.question,
            lowConfidenceTruth.vault,
            lowConfidenceBettorA,
            betAmount,
            true
        );

        await placeExternalBet(
            lowConfidenceLateBettor,
            lowConfidenceBettorB,
            lowConfidenceMarket,
            lowConfidenceTruth,
            betAmount,
            false
        );

        console.log("");
        console.log(
            "STEP 4: commit 3 TRUE votes for one-sided market"
        );

        const oneSideRecord1 =
            await commitTruthVote(
                oneVoter1,
                oneSideTruth.question,
                `life06-one-v1-${Date.now()}`,
                1
            );

        const oneSideRecord2 =
            await commitTruthVote(
                oneVoter2,
                oneSideTruth.question,
                `life06-one-v2-${Date.now()}`,
                1
            );

        const oneSideRecord3 =
            await commitTruthVote(
                oneVoter3,
                oneSideTruth.question,
                `life06-one-v3-${Date.now()}`,
                1
            );

        console.log(
            "STEP 5: commit 2 TRUE + 1 FALSE for low-confidence market"
        );

        const lowRecord1 =
            await commitTruthVote(
                lowVoter1,
                lowConfidenceTruth.question,
                `life06-low-v1-${Date.now()}`,
                1
            );

        const lowRecord2 =
            await commitTruthVote(
                lowVoter2,
                lowConfidenceTruth.question,
                `life06-low-v2-${Date.now()}`,
                1
            );

        const lowRecord3 =
            await commitTruthVote(
                lowVoter3,
                lowConfidenceTruth.question,
                `life06-low-v3-${Date.now()}`,
                2
            );

        await sleep(13_000);

        console.log("");
        console.log(
            "STEP 6: reveal all Truth votes"
        );

        console.log("Reveal one-sided voter 1");
        await revealTruthVote(
            oneSideRecord1,
            oneSideTruth.question
        );

        console.log("Reveal one-sided voter 2");
        await revealTruthVote(
            oneSideRecord2,
            oneSideTruth.question
        );

        console.log("Reveal one-sided voter 3");
        await revealTruthVote(
            oneSideRecord3,
            oneSideTruth.question
        );

        console.log("Reveal low-confidence voter 1 TRUE");
        await revealTruthVote(
            lowRecord1,
            lowConfidenceTruth.question
        );

        console.log("Reveal low-confidence voter 2 TRUE");
        await revealTruthVote(
            lowRecord2,
            lowConfidenceTruth.question
        );

        console.log("Reveal low-confidence voter 3 FALSE");
        await revealTruthVote(
            lowRecord3,
            lowConfidenceTruth.question
        );

        console.log("All Truth votes revealed");
        const oneSideTruthData =
            await truthProgram.account.question.fetch(
                oneSideTruth.question
            );

        const lowConfidenceTruthData =
            await truthProgram.account.question.fetch(
                lowConfidenceTruth.question
            );

        const revealEnd = Math.max(
            oneSideTruthData.revealEndTime.toNumber(),
            lowConfidenceTruthData.revealEndTime.toNumber()
        );

        const nowAfterReveal =
            Math.floor(Date.now() / 1000);

        const revealWaitMs = Math.max(
            0,
            (revealEnd - nowAfterReveal + 2) * 1000
        );

        console.log(
            `Waiting ${Math.ceil(
                revealWaitMs / 1000
            )}s for Truth reveal periods to end...`
        );

        await sleep(revealWaitMs);

        console.log("");
        console.log(
            "STEP 7: SolBetX stores both Truth results"
        );

        await bettingProgram.methods
            .fetchAndStoreWinner(oneSideTruth.id)
            .accounts({
                bettingQuestion:
                    oneSideMarket.question,
                truthNetworkQuestion:
                    oneSideTruth.question,
                truthNetworkProgram:
                    truthProgram.programId,
                houseWallet,
                vault: oneSideMarket.vault,
                systemProgram:
                    SystemProgram.programId,
            })
            .rpc();

        await bettingProgram.methods
            .fetchAndStoreWinner(
                lowConfidenceTruth.id
            )
            .accounts({
                bettingQuestion:
                    lowConfidenceMarket.question,
                truthNetworkQuestion:
                    lowConfidenceTruth.question,
                truthNetworkProgram:
                    truthProgram.programId,
                houseWallet,
                vault: lowConfidenceMarket.vault,
                systemProgram:
                    SystemProgram.programId,
            })
            .rpc();

        let oneSideData =
            await bettingProgram.account.bettingQuestion.fetch(
                oneSideMarket.question
            );

        let lowConfidenceData =
            await bettingProgram.account.bettingQuestion.fetch(
                lowConfidenceMarket.question
            );

        console.log(
            "One-sided winner:",
            oneSideData.winner
        );
        console.log(
            "One-sided confidence:",
            oneSideData.winningPercentage
        );
        console.log(
            "One-sided TRUE total:",
            oneSideData.totalBetsOption1.toString()
        );
        console.log(
            "One-sided FALSE total:",
            oneSideData.totalBetsOption2.toString()
        );

        console.log(
            "Low-confidence winner:",
            lowConfidenceData.winner
        );
        console.log(
            "Low-confidence percentage:",
            lowConfidenceData.winningPercentage
        );

        assert.equal(
            oneSideData.status,
            "close"
        );
        assert.equal(
            oneSideData.winner,
            1
        );
        assert.equal(
            oneSideData.winningPercentage,
            100
        );
        assert.equal(
            oneSideData.totalBetsOption2.toString(),
            "0",
            "One-sided test must have zero FALSE bets"
        );

        assert.equal(
            lowConfidenceData.status,
            "close"
        );
        assert.isBelow(
            lowConfidenceData.winningPercentage,
            75,
            "Low-confidence Truth result must be below 75%"
        );

        console.log("");
        console.log(
            "STEP 8: claim one-sided refund BEFORE expiry"
        );

        await bettingProgram.methods
            .claimWinnings()
            .accounts({
                bettingQuestion:
                    oneSideMarket.question,
                bettorAccount:
                    oneSideBettorA,
                user,
                vault:
                    oneSideMarket.vault,
            })
            .rpc();

        const oneSideClaimed =
            await bettingProgram.account.bettorAccount.fetch(
                oneSideBettorA
            );

        console.log(
            "One-sided refund:",
            oneSideClaimed.winnings.toString()
        );

        assert.equal(
            oneSideClaimed.claimed,
            true
        );

        assert.equal(
            oneSideClaimed.winnings.toString(),
            expectedRefund.toString(),
            "One-sided refund must be 99% of bet"
        );

        console.log(
            "STEP 9: claim low-confidence refund BEFORE expiry"
        );

        await bettingProgram.methods
            .claimWinnings()
            .accounts({
                bettingQuestion:
                    lowConfidenceMarket.question,
                bettorAccount:
                    lowConfidenceBettorA,
                user,
                vault:
                    lowConfidenceMarket.vault,
            })
            .rpc();

        const lowConfidenceClaimed =
            await bettingProgram.account.bettorAccount.fetch(
                lowConfidenceBettorA
            );

        console.log(
            "Low-confidence refund:",
            lowConfidenceClaimed.winnings.toString()
        );

        assert.equal(
            lowConfidenceClaimed.claimed,
            true
        );

        assert.equal(
            lowConfidenceClaimed.winnings.toString(),
            expectedRefund.toString(),
            "Low-confidence refund must be 99% of bet"
        );

        /*
        * Leave:
        * - oneSideBettorB unclaimed
        * - lowConfidenceBettorB unclaimed
        */
        oneSideData =
            await bettingProgram.account.bettingQuestion.fetch(
                oneSideMarket.question
            );

        lowConfidenceData =
            await bettingProgram.account.bettingQuestion.fetch(
                lowConfidenceMarket.question
            );

        const latestExpiry = Math.max(
            oneSideData.claimExpiresAt.toNumber(),
            lowConfidenceData.claimExpiresAt.toNumber()
        );

        const now =
            Math.floor(Date.now() / 1000);

        const waitMs = Math.max(
            0,
            (latestExpiry - now + 2) * 1000
        );

        console.log("");
        console.log(
            `STEP 10: waiting ${Math.ceil(
                waitMs / 1000
            )}s for both claim windows to expire...`
        );

        await sleep(waitMs);

        console.log("");
        console.log(
            "STEP 11: reject one-sided refund AFTER expiry"
        );

        let oneSideLateError = "";

        try {
            await bettingProgram.methods
                .claimWinnings()
                .accounts({
                    bettingQuestion:
                        oneSideMarket.question,
                    bettorAccount:
                        oneSideBettorB,
                    user:
                        oneSideLateBettor.publicKey,
                    vault:
                        oneSideMarket.vault,
                })
                .signers([oneSideLateBettor])
                .rpc();

            assert.fail(
                "Expired one-sided refund must fail"
            );
        } catch (error: any) {
            oneSideLateError =
                String(getErrorCode(error));

            console.log(
                "Expired one-sided refund rejected with:",
                oneSideLateError
            );
        }

        assert.include(
            oneSideLateError,
            "ClaimWindowExpired"
        );

        console.log(
            "STEP 12: reject low-confidence refund AFTER expiry"
        );

        let lowConfidenceLateError = "";

        try {
            await bettingProgram.methods
                .claimWinnings()
                .accounts({
                    bettingQuestion:
                        lowConfidenceMarket.question,
                    bettorAccount:
                        lowConfidenceBettorB,
                    user:
                        lowConfidenceLateBettor.publicKey,
                    vault:
                        lowConfidenceMarket.vault,
                })
                .signers([lowConfidenceLateBettor])
                .rpc();

            assert.fail(
                "Expired low-confidence refund must fail"
            );
        } catch (error: any) {
            lowConfidenceLateError =
                String(getErrorCode(error));

            console.log(
                "Expired low-confidence refund rejected with:",
                lowConfidenceLateError
            );
        }

        assert.include(
            lowConfidenceLateError,
            "ClaimWindowExpired"
        );

        /*
        * Failed claims must not modify the bettor records.
        */
        const oneSideLateAccount =
            await bettingProgram.account.bettorAccount.fetch(
                oneSideBettorB
            );

        const lowConfidenceLateAccount =
            await bettingProgram.account.bettorAccount.fetch(
                lowConfidenceBettorB
            );

        assert.equal(
            oneSideLateAccount.claimed,
            false,
            "Expired one-sided bettor must remain unclaimed"
        );

        assert.equal(
            lowConfidenceLateAccount.claimed,
            false,
            "Expired low-confidence bettor must remain unclaimed"
        );

        assert.equal(
            oneSideLateAccount.winnings.toString(),
            "0"
        );

        assert.equal(
            lowConfidenceLateAccount.winnings.toString(),
            "0"
        );

        console.log("");
        console.log(
            "=== SBX LIFECYCLE 06 RESULT ==="
        );
        console.log(
            "One-sided confidence:",
            oneSideData.winningPercentage
        );
        console.log(
            "One-sided refund:",
            oneSideClaimed.winnings.toString()
        );
        console.log(
            "Low-confidence percentage:",
            lowConfidenceData.winningPercentage
        );
        console.log(
            "Low-confidence refund:",
            lowConfidenceClaimed.winnings.toString()
        );
        console.log(
            "Expired one-sided error:",
            oneSideLateError
        );
        console.log(
            "Expired low-confidence error:",
            lowConfidenceLateError
        );
        console.log("");
        console.log(
            "SBX REFUND LIFECYCLE VERIFIED"
        );
    });
});