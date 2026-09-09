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
} from "../helpers/solbetx-test-helpers";

describe("SBX-LIFECYCLE-04", () => {
    const houseWallet = new PublicKey(
        "CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL"
    );

    before(async () => {
        console.log("");
        console.log("=== SBX LIFECYCLE 04 ===");
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

    it("cleans expired records and sends residual SolBetX vault funds to house", async () => {
        const title =
            "SBX expired funds house lifecycle";

        const betAmount = new BN(100_000_000);

        const trueBettorB = Keypair.generate();
        const falseBettor = Keypair.generate();

        await fund(trueBettorB.publicKey);
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

        const trueBettorA =
            deriveBettor(market.question);

        const trueBettorBPda =
            deriveBettorFor(
                trueBettorB.publicKey,
                market.question
            );

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

        console.log("STEP 1: bettor A bets TRUE");

        await placeBet(
            market.question,
            market.vault,
            truth.question,
            truth.vault,
            trueBettorA,
            betAmount,
            true
        );

        console.log("STEP 2: bettor B bets TRUE");

        await placeExternalBet(
            trueBettorB,
            trueBettorBPda,
            market,
            truth,
            betAmount,
            true
        );

        console.log("STEP 3: bettor C bets FALSE");

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
            "STEP 4: 3 Truth voters commit TRUE"
        );

        const record1 = await commitTruthVote(
            voter1,
            truth.question,
            `life04-v1-${Date.now()}`
        );

        const record2 = await commitTruthVote(
            voter2,
            truth.question,
            `life04-v2-${Date.now()}`
        );

        const record3 = await commitTruthVote(
            voter3,
            truth.question,
            `life04-v3-${Date.now()}`
        );

        await sleep(11_000);

        console.log(
            "STEP 5: 3 Truth voters reveal TRUE"
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
            "STEP 6: SolBetX finalizes and stores Truth winner"
        );

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

        assert.equal(marketData.status, "close");
        assert.equal(marketData.winner, 1);
        assert.equal(
            marketData.winningPercentage,
            100
        );

        console.log(
            "Winner:",
            marketData.winner
        );
        console.log(
            "Claim expiry:",
            marketData.claimExpiresAt.toString()
        );

        console.log(
            "STEP 7: bettor A claims before expiry"
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

        const bettorAAfter =
            await bettingProgram.account.bettorAccount.fetch(
                trueBettorA
            );

        assert.equal(
            bettorAAfter.claimed,
            true
        );

        console.log(
            "Bettor A payout:",
            bettorAAfter.winnings.toString()
        );

        console.log(
            "STEP 8: close bettor A record"
        );

        await bettingProgram.methods
            .deleteBettorAccount()
            .accounts({
                bettingQuestion: market.question,
                bettorAccount: trueBettorA,
                user,
            })
            .rpc();

        console.log(
            "STEP 9: close losing FALSE bettor record"
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

        console.log(
            "STEP 10: leave bettor B and creator unclaimed"
        );

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

        console.log(
            "STEP 11: close unclaimed winning bettor B after expiry"
        );

        await bettingProgram.methods
            .deleteBettorAccount()
            .accounts({
                bettingQuestion: market.question,
                bettorAccount: trueBettorBPda,
                user: trueBettorB.publicKey,
            })
            .signers([trueBettorB])
            .rpc();

        const bettorBAfter =
            await bettingProgram.account.bettorAccount.fetchNullable(
                trueBettorBPda
            );

        assert.isNull(
            bettorBAfter,
            "Expired unclaimed bettor record must close"
        );

        marketData =
            await bettingProgram.account.bettingQuestion.fetch(
                market.question
            );

        console.log(
            "SolBetX bettor records:",
            marketData.bettorRecordsCount.toString()
        );
        console.log(
            "SolBetX bettor records closed:",
            marketData.bettorRecordsClosed.toString()
        );

        assert.equal(
            marketData.bettorRecordsClosed.toString(),
            marketData.bettorRecordsCount.toString()
        );

        console.log(
            "STEP 12: drain expired Truth reward"
        );

        const truthVaultBeforeDrain =
            await provider.connection.getBalance(
                truth.vault
            );

        const houseBeforeTruthDrain =
            await provider.connection.getBalance(
                houseWallet
            );

        await truthProgram.methods
            .drainUnclaimedReward()
            .accounts({
                question: truth.question,
                vault: truth.vault,
                feeReceiver: houseWallet,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        let truthData =
            await truthProgram.account.question.fetch(
                truth.question
            );

        const houseAfterTruthDrain =
            await provider.connection.getBalance(
                houseWallet
            );

        console.log(
            "Truth reward drained:",
            truthData.rewardDrained
        );
        console.log(
            "Truth vault before drain:",
            truthVaultBeforeDrain
        );
        console.log(
            "House Truth-drain gain:",
            houseAfterTruthDrain -
                houseBeforeTruthDrain
        );

        assert.equal(
            truthData.rewardDrained,
            true
        );

        console.log(
            "STEP 13: clean 3 expired Truth voter records"
        );

        const truthRecords = [
            record1,
            record2,
            record3,
        ];

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
                    voterRecord: record.voterRecord,
                    voter: record.voter.publicKey,
                })
                .rpc();

            console.log(
                `Truth voter record ${i + 1} cleaned`
            );
        }

        truthData =
            await truthProgram.account.question.fetch(
                truth.question
            );

        console.log(
            "Truth voter records:",
            truthData.voterRecordsCount.toString()
        );
        console.log(
            "Truth records closed:",
            truthData.voterRecordsClosed.toString()
        );

        assert.equal(
            truthData.voterRecordsClosed.toString(),
            truthData.voterRecordsCount.toString(),
            "All Truth voter records must be closed"
        );

        for (const record of truthRecords) {
            const info =
                await provider.connection.getAccountInfo(
                    record.voterRecord
                );

            assert.isNull(
                info,
                "Truth voter record must be deleted"
            );
        }

        console.log("");
        console.log(
            "STEP 14: capture balances before SolBetX deletion"
        );

        const bettingVaultBeforeDelete =
            await provider.connection.getBalance(
                market.vault
            );

        const houseBeforeDelete =
            await provider.connection.getBalance(
                houseWallet
            );

        const creatorBeforeDelete =
            await provider.connection.getBalance(
                user
            );

        const bettingQuestionBefore =
            await provider.connection.getAccountInfo(
                market.question
            );

        const truthQuestionBefore =
            await provider.connection.getAccountInfo(
                truth.question
            );

        const truthVaultBeforeDelete =
            await provider.connection.getAccountInfo(
                truth.vault
            );

        assert.isNotNull(bettingQuestionBefore);
        assert.isNotNull(truthQuestionBefore);
        assert.isNotNull(truthVaultBeforeDelete);

        const solbetxQuestionRent =
            bettingQuestionBefore!.lamports;

        const truthQuestionRent =
            truthQuestionBefore!.lamports;

        const truthVaultRent =
            truthVaultBeforeDelete!.lamports;

        const expectedCreatorRentRefund =
            solbetxQuestionRent +
            truthQuestionRent +
            truthVaultRent;

        console.log(
            "Betting vault residual:",
            bettingVaultBeforeDelete
        );
        console.log(
            "SolBetX BettingQuestion rent:",
            solbetxQuestionRent
        );
        console.log(
            "Truth Question rent:",
            truthQuestionRent
        );
        console.log(
            "Truth Vault rent:",
            truthVaultRent
        );
        console.log(
            "Total creator rent refund:",
            expectedCreatorRentRefund
        );
        console.log(
            "House before:",
            houseBeforeDelete
        );

        assert.isAbove(
            bettingVaultBeforeDelete,
            0,
            "Residual vault must contain expired unclaimed funds"
        );

        console.log("");
        console.log(
            "STEP 15: delete SolBetX event"
        );

        const deleteSignature =
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

        const deleteTransaction =
            await provider.connection.getTransaction(
                deleteSignature,
                {
                    commitment: "confirmed",
                    maxSupportedTransactionVersion: 0,
                }
            );

        assert.isNotNull(
            deleteTransaction,
            "Delete transaction must be available"
        );

        const deleteFee =
            deleteTransaction!.meta!.fee;

        const houseAfterDelete =
            await provider.connection.getBalance(
                houseWallet
            );

        const creatorAfterDelete =
            await provider.connection.getBalance(
                user
            );

        const marketAfterDelete =
            await provider.connection.getAccountInfo(
                market.question
            );

        const bettingVaultAfterDelete =
            await provider.connection.getAccountInfo(
                market.vault
            );

        const truthAfterDelete =
            await provider.connection.getAccountInfo(
                truth.question
            );

        const truthVaultAfterDelete =
            await provider.connection.getAccountInfo(
                truth.vault
            );

        const houseGain =
            houseAfterDelete -
            houseBeforeDelete;

        const creatorGain =
            creatorAfterDelete -
            creatorBeforeDelete;

        console.log("");
        console.log(
            "=== SBX LIFECYCLE 04 RESULT ==="
        );
        console.log(
            "Expired SolBetX vault:",
            bettingVaultBeforeDelete
        );
        console.log(
            "House gain:",
            houseGain
        );
        console.log(
            "Creator balance change:",
            creatorGain
        );
        console.log(
            "Expected creator rent refund:",
            expectedCreatorRentRefund
        );
        console.log(
            "SolBetX question exists:",
            marketAfterDelete !== null
        );
        console.log(
            "SolBetX vault exists:",
            bettingVaultAfterDelete !== null
        );
        console.log(
            "Truth question exists:",
            truthAfterDelete !== null
        );
        console.log(
            "Truth vault exists:",
            truthVaultAfterDelete !== null
        );

        assert.equal(
            houseGain,
            bettingVaultBeforeDelete,
            "House must receive the entire remaining SolBetX betting vault"
        );

        console.log(
            "Creator rent refund:",
            expectedCreatorRentRefund
        );
        console.log(
            "Delete transaction fee:",
            deleteFee
        );

        assert.equal(
            creatorGain + deleteFee,
            expectedCreatorRentRefund,
            "Creator must receive only SolBetX + Truth account rent refunds"
        );

        assert.isNull(
            marketAfterDelete,
            "SolBetX BettingQuestion must be deleted"
        );

        /*
         * betting_vault is a zero-data system-owned PDA. Since delete_event
         * sets its lamports to zero it should disappear after the transaction.
         */
        assert.isNull(
            bettingVaultAfterDelete,
            "SolBetX betting vault must be drained"
        );

        assert.isNull(
            truthAfterDelete,
            "Truth question must be deleted through SolBetX CPI"
        );

        assert.isNull(
            truthVaultAfterDelete,
            "Truth vault must be deleted through SolBetX CPI"
        );

        console.log("");
        console.log(
            "SBX EXPIRED FUNDS → HOUSE LIFECYCLE VERIFIED"
        );
    });
});