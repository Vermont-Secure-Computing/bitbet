import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import { keccak256 } from "js-sha3";
import { BettingContract } from "../target/types/betting_contract";
import truthNetworkIdl from "../idls/truth_network.json";

describe("SolBetX attack suite", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const bettingProgram =
        anchor.workspace.BettingContract as Program<BettingContract>;

    const truthProgram = new Program(
        truthNetworkIdl as anchor.Idl,
        provider
    );

    const user = provider.wallet.publicKey;

    let questionCounterPda: PublicKey;
    let truthQuestionPda: PublicKey;
    let truthVaultPda: PublicKey;
    let bettingQuestionPda: PublicKey;
    let bettingVaultPda: PublicKey;
    let bettorPda: PublicKey;

    const sleep = (ms: number) =>
        new Promise(resolve => setTimeout(resolve, ms));

    function deriveTruthQuestion(questionId: BN) {
        const idBuffer = questionId.toArrayLike(Buffer, "le", 8);

        const [question] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("question"),
                user.toBuffer(),
                idBuffer,
            ],
            truthProgram.programId
        );

        const [vault] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("vault"),
                question.toBuffer(),
            ],
            truthProgram.programId
        );

        return { question, vault };
    }

    function deriveBettingMarket(truthQuestion: PublicKey) {
        const [question] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("betting_question"),
                bettingProgram.programId.toBuffer(),
                truthQuestion.toBuffer(),
            ],
            bettingProgram.programId
        );

        const [vault] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("bet_vault"),
                question.toBuffer(),
            ],
            bettingProgram.programId
        );

        return { question, vault };
    }

    function deriveBettor(bettingQuestion: PublicKey) {
        const [bettor] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("bettor"),
                user.toBuffer(),
                bettingQuestion.toBuffer(),
            ],
            bettingProgram.programId
        );

        return bettor;
    }

    async function getNextTruthQuestion() {
        const counter =
            await truthProgram.account.questionCounter.fetch(
                questionCounterPda
            );

        const id = new BN(counter.count.toString());
        const { question, vault } = deriveTruthQuestion(id);

        return { id, question, vault };
    }

    async function createTruthQuestion(
        title: string,
        commitSeconds: number,
        revealSeconds: number
    ) {
        const { id, question, vault } =
            await getNextTruthQuestion();

        const now = Math.floor(Date.now() / 1000);

        await truthProgram.methods
            .createQuestion(
                title,
                new BN(100_000_000),
                new BN(now + commitSeconds),
                new BN(now + revealSeconds)
            )
            .accounts({
                questionCounter: questionCounterPda,
                question,
                vault,
                asker: user,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return { id, question, vault };
    }

    async function createBettingMarket(
        title: string,
        truthQuestion: PublicKey,
        closeSeconds: number
    ) {
        const { question, vault } =
            deriveBettingMarket(truthQuestion);

        const closeDate =
            new BN(
                Math.floor(Date.now() / 1000) +
                closeSeconds
            );

        await bettingProgram.methods
            .createBettingQuestion(
                title,
                closeDate
            )
            .accounts({
                bettingQuestion: question,
                creator: user,
                questionPda: truthQuestion,
                bettingContract: bettingProgram.programId,
                vault,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return { question, vault };
    }

    async function placeBet(
        bettingQuestion: PublicKey,
        bettingVault: PublicKey,
        truthQuestion: PublicKey,
        truthVault: PublicKey,
        bettor: PublicKey,
        amount: BN,
        side: boolean
    ) {
        return bettingProgram.methods
            .placeBet(amount, side)
            .accounts({
                bettingQuestion,
                bettorAccount: bettor,
                user,
                vault: bettingVault,
                truthNetworkQuestion: truthQuestion,
                betProgram: bettingProgram.programId,
                truthNetworkProgram: truthProgram.programId,
                systemProgram: SystemProgram.programId,
                truthNetworkVault: truthVault,
            })
            .rpc();
    }

    function getErrorCode(error: any) {
        return (
            error?.error?.errorCode?.code ??
            error?.error?.errorCode?.number?.toString?.() ??
            error?.message ??
            ""
        );
    }

    function deriveTruthUserRecord() {
        const [userRecord] = PublicKey.findProgramAddressSync(
            [Buffer.from("user_record"), user.toBuffer()],
            truthProgram.programId
        );
        return userRecord;
    }

    function deriveTruthVoterRecord(question: PublicKey) {
        const [voterRecord] = PublicKey.findProgramAddressSync(
            [Buffer.from("vote"), user.toBuffer(), question.toBuffer()],
            truthProgram.programId
        );
        return voterRecord;
    }

    async function ensureTruthVoter() {
        const userRecord = deriveTruthUserRecord();
        const existing = await truthProgram.account.userRecord.fetch(userRecord).catch(() => null);

        if (existing) return userRecord;

        const [globalState] = PublicKey.findProgramAddressSync(
            [Buffer.from("global_state")],
            truthProgram.programId
        );

        const global = await truthProgram.account.globalState.fetch(globalState).catch(() => null);

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

        await truthProgram.methods
            .joinNetwork()
            .accounts({
                globalState,
                userRecord,
                invite: null,
                user,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return userRecord;
    }

    async function makeTruthWinner(question: PublicKey, questionId: BN, vote: 1 | 2) {
        const userRecord = await ensureTruthVoter();
        const voterRecord = deriveTruthVoterRecord(question);
        const password = `sbx04-${Date.now()}`;
        const commitment = keccak256.array(`${vote}${password}`);

        await truthProgram.methods
            .commitVote(commitment)
            .accounts({
                question,
                voterRecord,
                userRecord,
                voter: user,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        await sleep(4_000);

        await truthProgram.methods
            .revealVote(password)
            .accounts({
                question,
                voterRecord,
                userRecord,
                voter: user,
            })
            .rpc();

        await sleep(4_000);

        await truthProgram.methods
            .finalizeVoting(questionId)
            .accounts({ question })
            .rpc();
    }

    before(async () => {
        console.log("");
        console.log("=== SBX-01 TEST ENVIRONMENT ===");
        console.log("RPC:", provider.connection.rpcEndpoint);
        console.log("Wallet:", user.toBase58());
        console.log(
            "SolBetX:",
            bettingProgram.programId.toBase58()
        );
        console.log(
            "Truth:",
            truthProgram.programId.toBase58()
        );

        const balance =
            await provider.connection.getBalance(user);

        if (balance < 5 * LAMPORTS_PER_SOL) {
            const signature =
                await provider.connection.requestAirdrop(
                    user,
                    10 * LAMPORTS_PER_SOL
                );

            const latest =
                await provider.connection.getLatestBlockhash();

            await provider.connection.confirmTransaction(
                {
                    signature,
                    ...latest,
                },
                "confirmed"
            );
        }

        console.log(
            "Test wallet balance:",
            (
                (await provider.connection.getBalance(user)) /
                LAMPORTS_PER_SOL
            ).toFixed(4),
            "SOL"
        );

        [questionCounterPda] =
            PublicKey.findProgramAddressSync(
                [
                    Buffer.from("question_counter"),
                    user.toBuffer(),
                ],
                truthProgram.programId
            );

        let counter =
            await truthProgram.account.questionCounter
                .fetch(questionCounterPda)
                .catch(() => null);

        if (!counter) {
            console.log(
                "Creating Truth question counter..."
            );

            await truthProgram.methods
                .initializeCounter()
                .accounts({
                    questionCounter:
                        questionCounterPda,
                    asker: user,
                    systemProgram:
                        SystemProgram.programId,
                })
                .rpc();

            counter =
                await truthProgram.account.questionCounter.fetch(
                    questionCounterPda
                );
        }

        const questionId =
            new BN(counter.count.toString());

        const derivedTruth =
            deriveTruthQuestion(questionId);

        truthQuestionPda = derivedTruth.question;
        truthVaultPda = derivedTruth.vault;

        const now =
            Math.floor(Date.now() / 1000);

        console.log(
            "Creating Truth question:",
            truthQuestionPda.toBase58()
        );

        await truthProgram.methods
            .createQuestion(
                "SBX-01 mixed side betting security test",
                new BN(100_000_000),
                new BN(now + 60 * 60),
                new BN(now + 2 * 60 * 60)
            )
            .accounts({
                questionCounter:
                    questionCounterPda,
                question: truthQuestionPda,
                vault: truthVaultPda,
                asker: user,
                systemProgram:
                    SystemProgram.programId,
            })
            .rpc();

        const derivedMarket =
            deriveBettingMarket(truthQuestionPda);

        bettingQuestionPda =
            derivedMarket.question;

        bettingVaultPda =
            derivedMarket.vault;

        console.log(
            "Creating SolBetX question:",
            bettingQuestionPda.toBase58()
        );

        await bettingProgram.methods
            .createBettingQuestion(
                "SBX-01 mixed side betting security test",
                new BN(now + 30 * 60)
            )
            .accounts({
                bettingQuestion:
                    bettingQuestionPda,
                creator: user,
                questionPda:
                    truthQuestionPda,
                bettingContract:
                    bettingProgram.programId,
                vault: bettingVaultPda,
                systemProgram:
                    SystemProgram.programId,
            })
            .rpc();

        bettorPda =
            deriveBettor(bettingQuestionPda);

        console.log(
            "Bettor PDA:",
            bettorPda.toBase58()
        );
    });

    it(
        "SBX-01 regression: bettor cannot switch sides after first bet",
        async () => {
            const firstTrueBet =
                new BN(10_000_000);

            const secondTrueBet =
                new BN(10_000_000);

            const falseBet =
                new BN(1_000_000_000);

            console.log("");
            console.log(
                "STEP 1: bettor places 0.01 SOL TRUE"
            );

            await placeBet(
                bettingQuestionPda,
                bettingVaultPda,
                truthQuestionPda,
                truthVaultPda,
                bettorPda,
                firstTrueBet,
                true
            );

            console.log(
                "STEP 2: same bettor adds 0.01 SOL TRUE"
            );

            await placeBet(
                bettingQuestionPda,
                bettingVaultPda,
                truthQuestionPda,
                truthVaultPda,
                bettorPda,
                secondTrueBet,
                true
            );

            const beforeAttackBettor =
                await bettingProgram.account.bettorAccount.fetch(
                    bettorPda
                );

            const beforeAttackMarket =
                await bettingProgram.account.bettingQuestion.fetch(
                    bettingQuestionPda
                );

            const expectedTrueTotal =
                firstTrueBet.add(secondTrueBet);

            assert.equal(
                beforeAttackBettor.chosenOption,
                true,
                "Bettor should remain on TRUE"
            );

            assert.equal(
                beforeAttackBettor.betAmount.toString(),
                expectedTrueTotal.toString(),
                "Same-side bets should accumulate"
            );

            assert.equal(
                beforeAttackMarket.totalBetsOption1.toString(),
                expectedTrueTotal.toString(),
                "TRUE market total should contain both TRUE bets"
            );

            assert.equal(
                beforeAttackMarket.totalBetsOption2.toString(),
                "0",
                "FALSE market should still be zero"
            );

            console.log("");
            console.log(
                "STEP 3: attacker tries to place 1 SOL FALSE"
            );

            let rejected = false;
            let errorCode = "";

            try {
                await placeBet(
                    bettingQuestionPda,
                    bettingVaultPda,
                    truthQuestionPda,
                    truthVaultPda,
                    bettorPda,
                    falseBet,
                    false
                );
            } catch (error: any) {
                rejected = true;
                errorCode =
                    getErrorCode(error);

                console.log(
                    "Rejected with:",
                    errorCode
                );
            }

            assert.equal(
                rejected,
                true,
                "Opposite-side bet should be rejected"
            );

            assert.include(
                String(errorCode),
                "CannotChangeBetSide",
                "Expected CannotChangeBetSide error"
            );

            const afterAttackBettor =
                await bettingProgram.account.bettorAccount.fetch(
                    bettorPda
                );

            const afterAttackMarket =
                await bettingProgram.account.bettingQuestion.fetch(
                    bettingQuestionPda
                );

            console.log("");
            console.log(
                "=== SBX-01 REGRESSION RESULT ==="
            );
            console.log(
                "chosenOption:",
                afterAttackBettor.chosenOption
            );
            console.log(
                "betAmount:",
                afterAttackBettor.betAmount.toString()
            );
            console.log(
                "TRUE total:",
                afterAttackMarket.totalBetsOption1.toString()
            );
            console.log(
                "FALSE total:",
                afterAttackMarket.totalBetsOption2.toString()
            );

            assert.equal(
                afterAttackBettor.chosenOption,
                true,
                "Rejected attack must not change chosenOption"
            );

            assert.equal(
                afterAttackBettor.betAmount.toString(),
                expectedTrueTotal.toString(),
                "Rejected attack must not change bettor betAmount"
            );

            assert.equal(
                afterAttackMarket.totalBetsOption1.toString(),
                expectedTrueTotal.toString(),
                "Rejected attack must not change TRUE total"
            );

            assert.equal(
                afterAttackMarket.totalBetsOption2.toString(),
                "0",
                "Rejected attack must not increase FALSE total"
            );

            console.log("");
            console.log(
                "SBX-01 PATCH VERIFIED"
            );
        }
    );

    it(
        "SBX-02 regression: claim_winnings rejects claim before result is stored.",
        async () => {
            const betAmount = new BN(100_000_000);

            const truth = await createTruthQuestion(
                    "SBX-02 legitimate Truth question A",
                    60,
                    120
                );

            const market = await createBettingMarket(
                    "SBX-02 claim before result stored",
                    truth.question,
                    6
                );

            const bettorPda = deriveBettor(market.question);

            await placeBet(
                market.question,
                market.vault,
                truth.question,
                truth.vault,
                bettorPda,
                betAmount,
                true
            );

            console.log("");
            console.log("SBX-02 Market: ", market.question.toBase58());
            console.log("Bettor: ", bettorPda.toBase58());
            console.log("Waiting for betting market to close...");

            await sleep(7_000);

            const marketBefore = await bettingProgram.account.bettingQuestion.fetch(market.question);
            const bettorBefore = await bettingProgram.account.bettorAccount.fetch(bettorPda);
            const vaultBefore = await provider.connection.getBalance(market.vault);

            assert.equal(marketBefore.status, "open", "Result must not stored before attack");

            assert.equal(bettorBefore.claimed, false, "Bettor must be unclaimed before attack");

            console.log("");
            console.log("=== SBX-02 REGRESSION ATTACK ===");

            let rejected = false;
            let errorCode = "";

            try {
                await bettingProgram.methods
                    .claimWinnings()
                    .accounts({
                        bettingQuestion: market.question,
                        bettorAccount: bettorPda,
                        user,
                        vault: market.vault,
                    })
                    .rpc();
            } catch (error: any) {
                rejected = true;
                errorCode = getErrorCode(error);

                console.log("Rejected with: ", errorCode);
            }

            assert.equal(rejected, true, "Claim before result is stored must be rejected");

            assert.include(String(errorCode), "WinnerNotStored", "Expected WinnerNotStored");

            const marketAfter = await bettingProgram.account.bettingQuestion.fetch(market.question);
            const bettorAfter = await bettingProgram.account.bettorAccount.fetch(bettorPda);

            const vaultAfter = await provider.connection.getBalance(market.vault);

            console.log("");
            console.log("=== SBX-02 REGRESSION RESULT ===");
            console.log("Market status:", marketAfter.status);
            console.log("Market winner:", marketAfter.winner);
            console.log("Market percentage:", marketAfter.winningPercentage);
            console.log("Bettor claimed:", bettorAfter.claimed);
            console.log("Bettor winnings:", bettorAfter.winnings.toString());
            console.log("Vault reduction:", vaultBefore - vaultAfter);

            assert.equal(marketAfter.status, marketBefore.status, "Rejected claim must not change market status");

            assert.equal(marketAfter.winner, marketBefore.winner, "Rejected claim must not change winner");

            assert.equal(
                marketAfter.winningPercentage, 
                marketBefore.winningPercentage,
                "Rejected claim must not change winning percentage"
            );

            assert.equal(bettorAfter.claimed, false, "Rejected claim must not mark bettor claimed");

            assert.equal(
                bettorAfter.winnings.toString(),
                bettorBefore.winnings.toString(),
                "Rejected claim must not change bettor winnings"
            );

            assert.equal(
                vaultAfter,
                vaultBefore,
                "Rejected claim must not remove SOL from vault"
            );

            console.log("");
            console.log(
                "SBX-02 PATCH VERIFIED"
            );
        }
    );

    // Can someone make Market A accept the result from a completely different Truth Network question?
    it(
        "SBX-03 regression: fetch_and_store_winner rejects an unrelated Truth question",
        async () => {
            const truthA = await createTruthQuestion(
                "SBX-03 legitimate Truth question A",
                60,
                120
            );

            const marketA = await createBettingMarket(
                "SBX-03 oracle substitution target",
                truthA.question,
                6
            );

            const truthB = await createTruthQuestion(
                "SBX-03 unrelated Truth question B",
                3,
                6
            );

            console.log("");
            console.log("SBX-03 market linked to Truth A:", truthA.question.toBase58());
            console.log("Attacker will supply Truth B:", truthB.question.toBase58());
            console.log("Waiting for market close and Truth B reveal end...");

            await sleep(9_000);

            const truthABefore = await truthProgram.account.question.fetch(
                truthA.question
            );

            const truthBBefore = await truthProgram.account.question.fetch(
                truthB.question
            );

            const marketBefore = await bettingProgram.account.bettingQuestion.fetch(
                marketA.question
            );

            assert.equal(
                truthABefore.finalized,
                false,
                "Legitimate Truth A must still be unresolved"
            );

            assert.equal(
                truthBBefore.finalized,
                false,
                "Unrelated Truth B should not yet be finalized"
            );

            assert.equal(
                marketBefore.status,
                "open",
                "Target market should still be open/unresolved"
            );

            const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
            const houseInfo =await provider.connection.getAccountInfo(houseWallet);

            if (!houseInfo) {
                const signature = await provider.connection.requestAirdrop(
                        houseWallet,
                        1_000_000
                    );

                const latest = await provider.connection.getLatestBlockhash();

                await provider.connection.confirmTransaction(
                    {
                        signature,
                        ...latest,
                    },
                    "confirmed"
                );
            }

            console.log("");
            console.log("=== SBX-03 REGRESSION ATTACK ===");

            let rejected = false;
            let errorCode = "";

            try {
                await bettingProgram.methods
                    .fetchAndStoreWinner(
                        truthB.id
                    )
                    .accounts({
                        bettingQuestion: marketA.question,
                        truthNetworkQuestion: truthB.question,
                        truthNetworkProgram: truthProgram.programId,
                        houseWallet,
                        vault: marketA.vault,
                        systemProgram: SystemProgram.programId,
                    })
                    .rpc();
            } catch (error: any) {
                rejected = true;
                errorCode =
                    getErrorCode(error);

                console.log(
                    "Rejected with:",
                    errorCode
                );
            }

            assert.equal(
                rejected,
                true,
                "Unrelated Truth question must be rejected"
            );

            assert.include(
                String(errorCode),
                "TruthQuestionMismatch",
                "Expected TruthQuestionMismatch"
            );

            const marketAfter = await bettingProgram.account.bettingQuestion.fetch(marketA.question);

            const truthAAfter = await truthProgram.account.question.fetch(truthA.question);

            const truthBAfter = await truthProgram.account.question.fetch(truthB.question);

            console.log("");
            console.log("=== SBX-03 REGRESSION RESULT ===");
            console.log("Market status:", marketAfter.status);
            console.log("Market winner:", marketAfter.winner);
            console.log("Market percentage:", marketAfter.winningPercentage);
            console.log("Truth A finalized:", truthAAfter.finalized);
            console.log("Truth B finalized:", truthBAfter.finalized);

            assert.equal(
                marketAfter.questionPda.toBase58(),
                truthA.question.toBase58(),
                "Market must remain linked to Truth A"
            );

            assert.equal(
                marketAfter.status,
                marketBefore.status,
                "Rejected attack must not change market status"
            );

            assert.equal(
                marketAfter.winner,
                marketBefore.winner,
                "Rejected attack must not change market winner"
            );

            assert.equal(
                marketAfter.winningPercentage,
                marketBefore.winningPercentage,
                "Rejected attack must not change winning percentage"
            );

            assert.equal(
                truthAAfter.finalized,
                truthABefore.finalized,
                "Legitimate Truth A must remain unchanged"
            );

            assert.equal(
                truthBAfter.finalized,
                truthBBefore.finalized,
                "Rejected attack must not finalize unrelated Truth B"
            );

            console.log("");
            console.log("SBX-03 PATCH VERIFIED");
        }
    );

    it("SBX-04 delete_bettor_account rejects deletion before SolBetX has stored the result", async () => {
        const truthA = await createTruthQuestion(
            "SBX-04 legitimate Truth question A",
            60,
            120
        );

        const marketA = await createBettingMarket(
            "SBX-04 bettor deletion target",
            truthA.question,
            6
        );

        const targetBettorPda = deriveBettor(marketA.question);

        await placeBet(
            marketA.question,
            marketA.vault,
            truthA.question,
            truthA.vault,
            targetBettorPda,
            new BN(10_000_000),
            true
        );

        console.log("");
        console.log("SBX-04 Market: ", marketA.question.toBase58());
        console.log("Truth question: ", truthA.question.toBase58());
        console.log("Bettor: ", targetBettorPda.toBase58());
        console.log("Waiting for betting market to close...");

        await sleep(7_000);

        const marketBefore =  await bettingProgram.account.bettingQuestion.fetch(marketA.question);
        const bettorBefore = await bettingProgram.account.bettorAccount.fetch(targetBettorPda);

        const bettorAccountInfoBefore = await provider.connection.getAccountInfo(targetBettorPda);

        assert.equal(
            marketBefore.status,
            "open",
            "Result must not be stored before attack"
        );

        assert.equal(
            bettorBefore.claimed,
            false,
            "Bettor must still be unclaimed"
        );

        assert.isNotNull(
            bettorAccountInfoBefore,
            "Bettor account must exist before attack"
        );

        console.log("");
        console.log("=== SBX-04 REGRESSION ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods
                .deleteBettorAccount()
                .accounts({
                    user,
                    bettorAccount: targetBettorPda,
                    bettingQuestion: marketA.question,
                })
                .rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);

            console.log(
                "Rejected with:",
                errorCode
            );
        }

        assert.equal(
            rejected,
            true,
            "Bettor deletion before result is stored must be rejected"
        );

        assert.include(
            String(errorCode),
            "WinnerNotStored",
            "Expected WinnerNotStored"
        );

        const bettorAccountInfoAfter =await provider.connection.getAccountInfo(
            targetBettorPda
        );

        const bettorAfter =await bettingProgram.account.bettorAccount.fetch(
            targetBettorPda
        );

        const marketAfter =await bettingProgram.account.bettingQuestion.fetch(
            marketA.question
        );

        console.log("");
        console.log("=== SBX-04 REGRESSION RESULT ===");
        console.log("Bettor account exists:", !!bettorAccountInfoAfter);
        console.log("Market status:", marketAfter.status);
        console.log("Market winner:", marketAfter.winner);
        console.log("Market percentage:", marketAfter.winningPercentage);
        console.log("Bettor claimed:", bettorAfter.claimed);
        console.log("Bettor amount:", bettorAfter.betAmount.toString());
        console.log("Bettor records closed:", marketAfter.bettorRecordsClosed.toString());

        assert.isNotNull(
            bettorAccountInfoAfter,
            "Rejected deletion must not delete bettor account"
        );

        assert.equal(
            marketAfter.status,
            marketBefore.status,
            "Rejected deletion must not change market status"
        );

        assert.equal(
            marketAfter.winner,
            marketBefore.winner,
            "Rejected deletion must not change winner"
        );

        assert.equal(
            marketAfter.winningPercentage,
            marketBefore.winningPercentage,
            "Rejected deletion must not change winning percentage"
        );

        assert.equal(
            marketAfter.bettorRecordsClosed.toString(),
            marketBefore.bettorRecordsClosed.toString(),
            "Rejected deletion must not increment bettor_records_closed"
        );

        assert.equal(
            bettorAfter.claimed,
            bettorBefore.claimed,
            "Rejected deletion must not change claimed state"
        );

        assert.equal(
            bettorAfter.chosenOption,
            bettorBefore.chosenOption,
            "Rejected deletion must not change bettor side"
        );

        assert.equal(
            bettorAfter.betAmount.toString(),
            bettorBefore.betAmount.toString(),
            "Rejected deletion must not change bettor amount"
        );

        console.log("");
        console.log("SBX-04 PATCH VERIFIED");
    });

    it("SBX-05 regression: delete_event rejects an unrelated finalized Truth question", async () => {
        const truthA = await createTruthQuestion("SBX-05 legitimate Truth question A", 3, 6);
        const marketA = await createBettingMarket("SBX-05 delete event target", truthA.question, 6);
        const truthB = await createTruthQuestion("SBX-05 unrelated Truth question B", 3, 6);

        const houseWallet = new PublicKey(
            "CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL"
        );

        if (!(await provider.connection.getAccountInfo(houseWallet))) {
            const signature = await provider.connection.requestAirdrop(houseWallet, 1_000_000);
            const latest = await provider.connection.getLatestBlockhash();
            await provider.connection.confirmTransaction(
                { signature, ...latest },
                "confirmed"
            );
        }

        console.log("");
        console.log("SBX-05 Market A:", marketA.question.toBase58());
        console.log("Market A linked Truth A:", truthA.question.toBase58());
        console.log("Attacker supplies Truth B:", truthB.question.toBase58());
        console.log("Waiting for close and reveal end...");

        await sleep(9_000);

        // Legitimately finalize A so Market A becomes closed.
        await bettingProgram.methods
            .fetchAndStoreWinner(truthA.id)
            .accounts({
                bettingQuestion: marketA.question,
                truthNetworkQuestion: truthA.question,
                truthNetworkProgram: truthProgram.programId,
                houseWallet,
                vault: marketA.vault,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        // Finalize unrelated B.
        await truthProgram.methods
            .finalizeVoting(truthB.id)
            .accounts({ question: truthB.question })
            .rpc();

        // Empty B's reward vault so B satisfies delete_event's vault check.
        await truthProgram.methods
            .drainUnclaimedReward()
            .accounts({
                question: truthB.question,
                vault: truthB.vault,
                feeReceiver: houseWallet,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(marketA.question);
        const truthABefore = await truthProgram.account.question.fetch(truthA.question);
        const truthBBefore = await truthProgram.account.question.fetch(truthB.question);

        console.log("");
        console.log("Before attack:");
        console.log("Market status:", marketBefore.status);
        console.log("Truth A finalized:", truthABefore.finalized);
        console.log("Truth B finalized:", truthBBefore.finalized);
        console.log("Truth B reward drained:", truthBBefore.rewardDrained);

        assert.equal(marketBefore.status, "close", "Market A must be closed");
        assert.equal(truthABefore.finalized, true, "Truth A should be finalized");
        assert.equal(truthBBefore.finalized, true, "Truth B should be finalized");
        assert.equal(truthBBefore.rewardDrained, true, "Truth B reward must be drained");

        console.log("");
        console.log("=== SBX-05 REGRESSION ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods
                .deleteEvent()
                .accounts({
                    bettingQuestion: marketA.question,
                    creator: user,
                    truthQuestion: truthB.question,
                    bettingVault: marketA.vault,
                    truthVault: truthB.vault,
                    truthNetworkProgram: truthProgram.programId,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        assert.equal(rejected, true, "Unrelated Truth question must be rejected");
        assert.include(String(errorCode), "TruthQuestionMismatch", "Expected TruthQuestionMismatch");

        const marketAfter = await provider.connection.getAccountInfo(marketA.question);
        const bettingVaultAfter = await provider.connection.getAccountInfo(marketA.vault);
        const truthAAfter = await provider.connection.getAccountInfo(truthA.question);
        const truthBAfter = await provider.connection.getAccountInfo(truthB.question);

        console.log("");
        console.log("=== SBX-05 REGRESSION RESULT ===");
        console.log("Market A exists:", !!marketAfter);
        console.log("Market A vault exists:", !!bettingVaultAfter);
        console.log("Legitimate Truth A exists:", !!truthAAfter);
        console.log("Unrelated Truth B exists:", !!truthBAfter);

        assert.isNotNull(marketAfter, "Rejected attack must not delete Market A");
        assert.isNotNull(bettingVaultAfter, "Rejected attack must not delete Market A vault");
        assert.isNotNull(truthAAfter, "Rejected attack must not delete legitimate Truth A");
        assert.isNotNull(truthBAfter, "Rejected attack must not delete unrelated Truth B");

        const marketStateAfter = await bettingProgram.account.bettingQuestion.fetch(marketA.question);

        assert.equal(
            marketStateAfter.questionPda.toBase58(),
            truthA.question.toBase58(),
            "Market A must remain linked to Truth A"
        );
        assert.equal(
            marketStateAfter.status,
            marketBefore.status,
            "Rejected attack must not change Market A status"
        );

        console.log("");
        console.log("SBX-05 PATCH VERIFIED");
    });

    it("SBX-06 regression: claim_winnings rejects a bettor account from another market", async () => {
        const truthA = await createTruthQuestion("SBX-06 Truth question A", 60, 120);
        const marketA = await createBettingMarket("SBX-06 Market A", truthA.question, 60);
        const bettorA = deriveBettor(marketA.question);
        const betAmount = new BN(10_000_000);

        await placeBet(
            marketA.question,
            marketA.vault,
            truthA.question,
            truthA.vault,
            bettorA,
            betAmount,
            true
        );

        const truthB = await createTruthQuestion("SBX-06 Truth question B", 60, 120);
        const marketB = await createBettingMarket("SBX-06 Market B", truthB.question, 60);

        const bettorBefore = await bettingProgram.account.bettorAccount.fetch(bettorA);
        const vaultBefore = await provider.connection.getBalance(marketB.vault);

        console.log("");
        console.log("SBX-06 bettor belongs to Market A:", marketA.question.toBase58());
        console.log("Attacker supplies Market B:", marketB.question.toBase58());
        console.log("Bettor account:", bettorA.toBase58());
        console.log("");
        console.log("=== SBX-06 REGRESSION ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods
                .claimWinnings()
                .accounts({
                    bettingQuestion: marketB.question,
                    bettorAccount: bettorA,
                    user,
                    truthNetworkQuestion: truthB.question,
                    vault: marketB.vault,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        assert.equal(rejected, true, "Bettor account from Market A must not work with Market B");
        assert.include(String(errorCode), "InvalidBettingQuestion", "Expected InvalidBettingQuestion");

        const bettorAfter = await bettingProgram.account.bettorAccount.fetch(bettorA);
        const vaultAfter = await provider.connection.getBalance(marketB.vault);

        console.log("");
        console.log("=== SBX-06 REGRESSION RESULT ===");
        console.log("Bettor market:", bettorAfter.questionPda.toBase58());
        console.log("Bettor claimed:", bettorAfter.claimed);
        console.log("Bettor winnings:", bettorAfter.winnings.toString());
        console.log("Market B vault reduction:", vaultBefore - vaultAfter);

        assert.equal(
            bettorAfter.questionPda.toBase58(),
            marketA.question.toBase58(),
            "Bettor must remain associated with Market A"
        );
        assert.equal(bettorAfter.claimed, bettorBefore.claimed, "Rejected attack must not mark bettor claimed");
        assert.equal(
            bettorAfter.winnings.toString(),
            bettorBefore.winnings.toString(),
            "Rejected attack must not change bettor winnings"
        );
        assert.equal(vaultAfter, vaultBefore, "Rejected attack must not remove SOL from Market B vault");

        console.log("");
        console.log("SBX-06 PATCH VERIFIED");
    });

    it("SBX-07 regression: place_bet rejects an unrelated Truth vault", async () => {
        const truth = await createTruthQuestion("SBX-07 Truth question", 60, 120);
        const market = await createBettingMarket("SBX-07 Market", truth.question, 60);
        const bettor = deriveBettor(market.question);
        const betAmount = new BN(1_000_000_000);
        const expectedTruthCommission = 10_000_000;

        const attacker = Keypair.generate();

        const airdropSig = await provider.connection.requestAirdrop(
            attacker.publicKey,
            1_000_000
        );

        await provider.connection.confirmTransaction(
            airdropSig,
            "confirmed"
        );

        console.log("");
        console.log("SBX-07 Market:", market.question.toBase58());
        console.log("Legitimate Truth vault:", truth.vault.toBase58());
        console.log("Attacker redirects commission to:", attacker.publicKey.toBase58());
        console.log("");
        console.log("=== SBX-07 REGRESSION ATTACK ===");

        const truthVaultBefore = await provider.connection.getBalance(truth.vault);
        const attackerBefore = await provider.connection.getBalance(attacker.publicKey);
        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const bettorBeforeInfo = await provider.connection.getAccountInfo(bettor);

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods
                .placeBet(betAmount, true)
                .accounts({
                    bettingQuestion: market.question,
                    bettorAccount: bettor,
                    user,
                    vault: market.vault,
                    truthNetworkQuestion: truth.question,
                    betProgram: bettingProgram.programId,
                    truthNetworkProgram: truthProgram.programId,
                    systemProgram: SystemProgram.programId,
                    truthNetworkVault: attacker.publicKey,
                })
                .rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        assert.equal(rejected, true, "Unrelated Truth vault must be rejected");
        assert.include(String(errorCode), "TruthVaultMismatch", "Expected TruthVaultMismatch");

        const truthVaultAfter = await provider.connection.getBalance(truth.vault);
        const attackerAfter = await provider.connection.getBalance(attacker.publicKey);
        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const bettorAfterInfo = await provider.connection.getAccountInfo(bettor);

        console.log("");
        console.log("=== SBX-07 REGRESSION RESULT ===");
        console.log("Truth vault change:", truthVaultAfter - truthVaultBefore);
        console.log("Attacker balance change:", attackerAfter - attackerBefore);
        console.log("Market TRUE change:", marketAfter.totalBetsOption1.sub(marketBefore.totalBetsOption1).toString());
        console.log("Bettor account exists before:", !!bettorBeforeInfo);
        console.log("Bettor account exists after:", !!bettorAfterInfo);

        assert.equal(truthVaultAfter, truthVaultBefore, "Rejected attack must not change legitimate Truth vault");
        assert.equal(attackerAfter, attackerBefore, "Rejected attack must not pay attacker");
        assert.equal(
            marketAfter.totalBetsOption1.toString(),
            marketBefore.totalBetsOption1.toString(),
            "Rejected attack must not change TRUE total"
        );
        assert.equal(
            marketAfter.totalBetsOption2.toString(),
            marketBefore.totalBetsOption2.toString(),
            "Rejected attack must not change FALSE total"
        );
        assert.equal(
            !!bettorAfterInfo,
            !!bettorBeforeInfo,
            "Rejected attack must not create or remove bettor account"
        );

        console.log("");
        console.log("SBX-07 PATCH VERIFIED");
    });

    it("SBX-08 regression: place_bet rejects an unrelated Truth question", async () => {
        const truthA = await createTruthQuestion("SBX-08 legitimate Truth A", 60, 120);
        const marketA = await createBettingMarket("SBX-08 Market A", truthA.question, 60);
        const truthB = await createTruthQuestion("SBX-08 unrelated Truth B", 60, 120);
        const bettor = deriveBettor(marketA.question);
        const betAmount = new BN(1_000_000_000);

        console.log("");
        console.log("SBX-08 Market A linked Truth:", truthA.question.toBase58());
        console.log("Attacker supplies Truth B:", truthB.question.toBase58());
        console.log("Truth B vault:", truthB.vault.toBase58());
        console.log("");
        console.log("=== SBX-08 REGRESSION ATTACK ===");

        const truthAVaultBefore = await provider.connection.getBalance(truthA.vault);
        const truthBVaultBefore = await provider.connection.getBalance(truthB.vault);
        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(marketA.question);
        const bettorBefore = await provider.connection.getAccountInfo(bettor);

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods
                .placeBet(betAmount, true)
                .accounts({
                    bettingQuestion: marketA.question,
                    bettorAccount: bettor,
                    user,
                    vault: marketA.vault,
                    truthNetworkQuestion: truthB.question,
                    betProgram: bettingProgram.programId,
                    truthNetworkProgram: truthProgram.programId,
                    systemProgram: SystemProgram.programId,
                    truthNetworkVault: truthB.vault,
                })
                .rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        assert.equal(rejected, true, "Unrelated Truth question must be rejected");
        assert.include(errorCode, "TruthQuestionMismatch", "Expected TruthQuestionMismatch");

        const truthAVaultAfter = await provider.connection.getBalance(truthA.vault);
        const truthBVaultAfter = await provider.connection.getBalance(truthB.vault);
        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(marketA.question);
        const bettorAfter = await provider.connection.getAccountInfo(bettor);

        console.log("");
        console.log("=== SBX-08 REGRESSION RESULT ===");
        console.log("Truth A vault change:", truthAVaultAfter - truthAVaultBefore);
        console.log("Truth B vault change:", truthBVaultAfter - truthBVaultBefore);
        console.log("Market TRUE change:", marketAfter.totalBetsOption1.sub(marketBefore.totalBetsOption1).toString());
        console.log("Bettor account exists before:", !!bettorBefore);
        console.log("Bettor account exists after:", !!bettorAfter);

        assert.equal(truthAVaultAfter, truthAVaultBefore, "Legitimate Truth vault must not change");
        assert.equal(truthBVaultAfter, truthBVaultBefore, "Unrelated Truth vault must not change");
        assert.equal(
            marketAfter.totalBetsOption1.toString(),
            marketBefore.totalBetsOption1.toString(),
            "Market TRUE total must not change"
        );
        assert.equal(
            marketAfter.totalBetsOption2.toString(),
            marketBefore.totalBetsOption2.toString(),
            "Market FALSE total must not change"
        );
        assert.equal(!!bettorAfter, !!bettorBefore, "Rejected attack must not create a bettor account");

        console.log("");
        console.log("SBX-08 PATCH VERIFIED");
    });

    it("SBX-09 regression: unauthorized wallet cannot claim creator commission", async () => {
        const truth = await createTruthQuestion("SBX-09 Truth question", 60, 120);
        const market = await createBettingMarket("SBX-09 Market", truth.question, 5);
        const bettor = deriveBettor(market.question);
        const betAmount = new BN(1_000_000_000);

        await bettingProgram.methods
            .placeBet(betAmount, true)
            .accounts({
                bettingQuestion: market.question,
                bettorAccount: bettor,
                user,
                vault: market.vault,
                truthNetworkQuestion: truth.question,
                betProgram: bettingProgram.programId,
                truthNetworkProgram: truthProgram.programId,
                systemProgram: SystemProgram.programId,
                truthNetworkVault: truth.vault,
            })
            .rpc();

        const attacker = Keypair.generate();
        const airdrop = await provider.connection.requestAirdrop(
            attacker.publicKey,
            100_000_000
        );
        await provider.connection.confirmTransaction(airdrop, "confirmed");

        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(
            market.question
        );
        const vaultBefore = await provider.connection.getBalance(market.vault);
        const attackerBefore = await provider.connection.getBalance(attacker.publicKey);

        console.log("");
        console.log("SBX-09 Market:", market.question.toBase58());
        console.log("Legitimate creator:", marketBefore.creator.toBase58());
        console.log("Attacker:", attacker.publicKey.toBase58());
        console.log("Creator commission:", marketBefore.totalCreatorCommission.toString());
        console.log("Waiting for market close...");

        await sleep(6000);

        console.log("");
        console.log("=== SBX-09 REGRESSION ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods
                .claimCreatorCommission()
                .accounts({
                    bettingQuestion: market.question,
                    creator: attacker.publicKey,
                    vault: market.vault,
                    systemProgram: SystemProgram.programId,
                })
                .signers([attacker])
                .rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        assert.equal(rejected, true, "Unauthorized wallet must be rejected");
        assert.include(errorCode, "UnauthorizedCreator", "Expected UnauthorizedCreator");

        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const vaultAfter = await provider.connection.getBalance(market.vault);
        const attackerAfter = await provider.connection.getBalance(attacker.publicKey);

        console.log("");
        console.log("=== SBX-09 REGRESSION RESULT ===");
        console.log("Attacker balance change:", attackerAfter - attackerBefore);
        console.log("Vault reduction:", vaultBefore - vaultAfter);
        console.log("Commission claimed:", marketAfter.creatorCommissionClaimed);

        assert.equal(attackerAfter, attackerBefore, "Attacker balance must not change");
        assert.equal(vaultAfter, vaultBefore, "Market vault must not change");
        assert.equal(marketAfter.creatorCommissionClaimed, false, "Commission must remain unclaimed");
        assert.equal(
            marketAfter.totalCreatorCommission.toString(),
            marketBefore.totalCreatorCommission.toString(),
            "Creator commission amount must remain unchanged"
        );

        console.log("");
        console.log("SBX-09 PATCH VERIFIED");
    });

    it("SBX-10: create_betting_question accepts a fake non-Truth question", async () => {
        const fakeTruth = Keypair.generate();

        const sig = await provider.connection.requestAirdrop(
            fakeTruth.publicKey,
            10_000_000
        );
        await provider.connection.confirmTransaction(sig, "confirmed");

        const [market] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("betting_question"),
                bettingProgram.programId.toBuffer(),
                fakeTruth.publicKey.toBuffer(),
            ],
            bettingProgram.programId
        );

        const [vault] = PublicKey.findProgramAddressSync(
            [Buffer.from("bet_vault"), market.toBuffer()],
            bettingProgram.programId
        );

        const closeDate = new BN(
            Math.floor(Date.now() / 1000) + 60
        );

        console.log("");
        console.log("SBX-10 fake Truth account:", fakeTruth.publicKey.toBase58());
        console.log("Fake account owner: System Program");
        console.log("Derived market:", market.toBase58());
        console.log("");
        console.log("=== SBX-10 ATTACK ===");

        await bettingProgram.methods
            .createBettingQuestion(
                "SBX-10 Fake Truth Market",
                closeDate
            )
            .accounts({
                bettingQuestion: market,
                creator: user,
                questionPda: fakeTruth.publicKey,
                bettingContract: bettingProgram.programId,
                vault,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        const created = await bettingProgram.account.bettingQuestion.fetch(market);
        const fakeInfo = await provider.connection.getAccountInfo(fakeTruth.publicKey);

        console.log("");
        console.log("=== SBX-10 RESULT ===");
        console.log("Market created:", !!created);
        console.log("Stored Truth question:", created.questionPda.toBase58());
        console.log("Fake account:", fakeTruth.publicKey.toBase58());
        console.log("Fake owner:", fakeInfo?.owner.toBase58());

        assert.equal(
            created.questionPda.toBase58(),
            fakeTruth.publicKey.toBase58(),
            "Market should reference fake account if vulnerable"
        );

        assert.equal(
            fakeInfo?.owner.toBase58(),
            SystemProgram.programId.toBase58(),
            "Fake Truth account should be system-owned"
        );

        console.log("");
        console.log("SBX-10 REPRODUCED:");
        console.log("Market creation accepted an account that is not a Truth Network Question.");
    });
});