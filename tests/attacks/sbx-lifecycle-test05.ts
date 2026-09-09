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

describe("SBX-LIFECYCLE-05", () => {
    const houseWallet = new PublicKey(
        "CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL"
    );

    before(async () => {
        console.log("");
        console.log("=== SBX LIFECYCLE 05 ===");
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
        password: string
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

    it("rejects deletion before expiry and while Truth is not cleanup-ready", async () => {
        const title = "SBX protected deletion lifecycle";
        const betAmount = new BN(100_000_000);

        const falseBettor = Keypair.generate();
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

        const trueBettor =
            deriveBettor(market.question);

        const falseBettorPda =
            deriveBettorFor(
                falseBettor.publicKey,
                market.question
            );

        console.log("");
        console.log(
            "Truth question:",
            truth.question.toBase58()
        );
        console.log(
            "SolBetX market:",
            market.question.toBase58()
        );

        console.log("STEP 1: TRUE bettor bets 0.1 SOL");

        await placeBet(
            market.question,
            market.vault,
            truth.question,
            truth.vault,
            trueBettor,
            betAmount,
            true
        );

        console.log("STEP 2: FALSE bettor bets 0.1 SOL");

        await placeExternalBet(
            falseBettor,
            falseBettorPda,
            market,
            truth,
            betAmount,
            false
        );

        const voter1 = Keypair.generate();
        const voter2 = Keypair.generate();
        const voter3 = Keypair.generate();

        await fund(voter1.publicKey);
        await fund(voter2.publicKey);
        await fund(voter3.publicKey);

        console.log(
            "STEP 3: 3 Truth voters commit TRUE"
        );

        const record1 = await commitTruthVote(
            voter1,
            truth.question,
            `life05-v1-${Date.now()}`
        );

        const record2 = await commitTruthVote(
            voter2,
            truth.question,
            `life05-v2-${Date.now()}`
        );

        const record3 = await commitTruthVote(
            voter3,
            truth.question,
            `life05-v3-${Date.now()}`
        );

        await sleep(11_000);

        console.log(
            "STEP 4: 3 Truth voters reveal TRUE"
        );

        await revealTruthVote(
            record1,
            truth.question
        );

        await revealTruthVote(
            record2,
            truth.question
        );

        await revealTruthVote(
            record3,
            truth.question
        );

        await sleep(10_000);

        console.log(
            "STEP 5: SolBetX stores finalized Truth result"
        );

        await bettingProgram.methods
            .fetchAndStoreWinner(truth.id)
            .accounts({
                bettingQuestion: market.question,
                truthNetworkQuestion: truth.question,
                truthNetworkProgram:
                    truthProgram.programId,
                houseWallet,
                vault: market.vault,
                systemProgram:
                    SystemProgram.programId,
            })
            .rpc();

        let marketData =
            await bettingProgram.account.bettingQuestion.fetch(
                market.question
            );

        assert.equal(marketData.status, "close");
        assert.equal(marketData.winner, 1);
        assert.equal(
            marketData.winningPercentage,
            100
        );

        console.log(
            "Claim expiry:",
            marketData.claimExpiresAt.toString()
        );

        console.log("");
        console.log(
            "STEP 6: attempt delete BEFORE claim expiry"
        );

        let beforeExpiryError = "";

        try {
            await bettingProgram.methods
                .deleteEvent()
                .accounts({
                    bettingQuestion: market.question,
                    creator: user,
                    houseWallet,
                    truthQuestion: truth.question,
                    bettingVault: market.vault,
                    truthVault: truth.vault,
                    truthNetworkProgram:
                        truthProgram.programId,
                    systemProgram:
                        SystemProgram.programId,
                })
                .rpc();

            assert.fail(
                "deleteEvent must fail before claim expiry"
            );
        } catch (error: any) {
            beforeExpiryError =
                String(getErrorCode(error));

            console.log(
                "Before-expiry deletion rejected with:",
                beforeExpiryError
            );
        }

        assert.include(
            beforeExpiryError,
            "ClaimWindowNotExpired"
        );

        const marketAfterEarlyDelete =
            await provider.connection.getAccountInfo(
                market.question
            );

        const truthAfterEarlyDelete =
            await provider.connection.getAccountInfo(
                truth.question
            );

        assert.isNotNull(
            marketAfterEarlyDelete,
            "SolBetX question must survive rejected early deletion"
        );

        assert.isNotNull(
            truthAfterEarlyDelete,
            "Truth question must survive rejected early deletion"
        );

        console.log(
            "Early deletion correctly rejected"
        );

        console.log("");
        console.log(
            "STEP 7: close known loser before expiry"
        );

        await bettingProgram.methods
            .deleteBettorAccount()
            .accounts({
                bettingQuestion: market.question,
                bettorAccount: falseBettorPda,
                user: falseBettor.publicKey,
            })
            .signers([falseBettor])
            .rpc();

        marketData =
            await bettingProgram.account.bettingQuestion.fetch(
                market.question
            );

        const expiry =
            marketData.claimExpiresAt.toNumber();

        const now =
            Math.floor(Date.now() / 1000);

        const waitMs = Math.max(
            0,
            (expiry - now + 2) * 1000
        );

        console.log(
            `Waiting ${Math.ceil(
                waitMs / 1000
            )}s for claim expiry...`
        );

        await sleep(waitMs);

        console.log("");
        console.log(
            "STEP 8: attempt delete AFTER expiry but BEFORE Truth cleanup"
        );

        const houseBeforeBlockedDelete =
            await provider.connection.getBalance(
                houseWallet
            );

        const vaultBeforeBlockedDelete =
            await provider.connection.getBalance(
                market.vault
            );

        let truthNotReadyError = "";

        try {
            await bettingProgram.methods
                .deleteEvent()
                .accounts({
                    bettingQuestion: market.question,
                    creator: user,
                    houseWallet,
                    truthQuestion: truth.question,
                    bettingVault: market.vault,
                    truthVault: truth.vault,
                    truthNetworkProgram:
                        truthProgram.programId,
                    systemProgram:
                        SystemProgram.programId,
                })
                .rpc();

            assert.fail(
                "deleteEvent must fail while Truth is not cleanup-ready"
            );
        } catch (error: any) {
            truthNotReadyError =
                String(getErrorCode(error));

            console.log(
                "Truth-not-ready deletion rejected with:",
                truthNotReadyError
            );
        }

        assert.include(
            truthNotReadyError,
            "CannotDeleteQuestion"
        );

        const houseAfterBlockedDelete =
            await provider.connection.getBalance(
                houseWallet
            );

        const vaultAfterBlockedDelete =
            await provider.connection.getBalance(
                market.vault
            );

        assert.equal(
            houseAfterBlockedDelete,
            houseBeforeBlockedDelete,
            "Rejected deletion must not transfer SolBetX vault funds"
        );

        assert.equal(
            vaultAfterBlockedDelete,
            vaultBeforeBlockedDelete,
            "Rejected deletion must leave SolBetX vault unchanged"
        );

        marketData =
            await bettingProgram.account.bettingQuestion.fetch(
                market.question
            );

        assert.equal(
            marketData.actionInProgress,
            false,
            "Failed deletion must not leave action_in_progress locked"
        );

        const truthStillExists =
            await provider.connection.getAccountInfo(
                truth.question
            );

        assert.isNotNull(
            truthStillExists,
            "Truth question must remain after rejected CPI deletion"
        );

        console.log(
            "Atomic Truth-not-ready rejection verified"
        );

        console.log("");
        console.log(
            "STEP 9: close expired unclaimed TRUE bettor"
        );

        await bettingProgram.methods
            .deleteBettorAccount()
            .accounts({
                bettingQuestion: market.question,
                bettorAccount: trueBettor,
                user,
            })
            .rpc();

        console.log(
            "STEP 10: drain expired Truth reward"
        );

        await truthProgram.methods
            .drainUnclaimedReward()
            .accounts({
                question: truth.question,
                vault: truth.vault,
                feeReceiver: houseWallet,
                systemProgram:
                    SystemProgram.programId,
            })
            .rpc();

        const truthRecords = [
            record1,
            record2,
            record3,
        ];

        console.log(
            "STEP 11: clean expired Truth voter records"
        );

        for (
            let i = 0;
            i < truthRecords.length;
            i++
        ) {
            const record = truthRecords[i];

            await truthProgram.methods
                .cleanupExpiredVoterRecord(
                    record.voter.publicKey
                )
                .accounts({
                    caller: user,
                    question: truth.question,
                    voterRecord:
                        record.voterRecord,
                    voter:
                        record.voter.publicKey,
                })
                .rpc();

            console.log(
                `Truth voter record ${i + 1} cleaned`
            );
        }

        const truthReady =
            await truthProgram.account.question.fetch(
                truth.question
            );

        assert.equal(
            truthReady.rewardDrained,
            true
        );

        assert.equal(
            truthReady.voterRecordsClosed.toString(),
            truthReady.voterRecordsCount.toString()
        );

        console.log("");
        console.log(
            "STEP 12: delete after all conditions are satisfied"
        );

        const finalVaultBalance =
            await provider.connection.getBalance(
                market.vault
            );

        const finalHouseBefore =
            await provider.connection.getBalance(
                houseWallet
            );

        await bettingProgram.methods
            .deleteEvent()
            .accounts({
                bettingQuestion: market.question,
                creator: user,
                houseWallet,
                truthQuestion: truth.question,
                bettingVault: market.vault,
                truthVault: truth.vault,
                truthNetworkProgram:
                    truthProgram.programId,
                systemProgram:
                    SystemProgram.programId,
            })
            .rpc();

        const finalHouseAfter =
            await provider.connection.getBalance(
                houseWallet
            );

        const finalHouseGain =
            finalHouseAfter -
            finalHouseBefore;

        assert.equal(
            finalHouseGain,
            finalVaultBalance,
            "Final deletion must send remaining SolBetX vault to house"
        );

        const finalMarket =
            await provider.connection.getAccountInfo(
                market.question
            );

        const finalBetVault =
            await provider.connection.getAccountInfo(
                market.vault
            );

        const finalTruth =
            await provider.connection.getAccountInfo(
                truth.question
            );

        const finalTruthVault =
            await provider.connection.getAccountInfo(
                truth.vault
            );

        assert.isNull(finalMarket);
        assert.isNull(finalBetVault);
        assert.isNull(finalTruth);
        assert.isNull(finalTruthVault);

        console.log("");
        console.log(
            "=== SBX LIFECYCLE 05 RESULT ==="
        );
        console.log(
            "Before-expiry error:",
            beforeExpiryError
        );
        console.log(
            "Truth-not-ready error:",
            truthNotReadyError
        );
        console.log(
            "Blocked delete house change:",
            houseAfterBlockedDelete -
                houseBeforeBlockedDelete
        );
        console.log(
            "Blocked delete vault change:",
            vaultAfterBlockedDelete -
                vaultBeforeBlockedDelete
        );
        console.log(
            "Final residual vault:",
            finalVaultBalance
        );
        console.log(
            "Final house gain:",
            finalHouseGain
        );
        console.log("");
        console.log(
            "SBX DELETION GUARDS VERIFIED"
        );
    });
});