import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { keccak256 } from "js-sha3";
import { BettingContract } from "../../target/types/betting_contract";
import truthNetworkIdl from "../../idls/truth_network.json";

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const bettingProgram = anchor.workspace.BettingContract as Program<BettingContract>;
export const truthProgram = new Program(truthNetworkIdl as anchor.Idl, provider);
export const user = provider.wallet.publicKey;

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function deriveQuestionCounter() {
    const [questionCounter] = PublicKey.findProgramAddressSync(
        [Buffer.from("question_counter"), user.toBuffer()],
        truthProgram.programId
    );

    return questionCounter;
}

export function deriveTruthQuestion(questionId: BN) {
    const idBuffer = questionId.toArrayLike(Buffer, "le", 8);

    const [question] = PublicKey.findProgramAddressSync(
        [Buffer.from("question"), user.toBuffer(), idBuffer],
        truthProgram.programId
    );

    const [vault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), question.toBuffer()],
        truthProgram.programId
    );

    return { question, vault };
}

export function deriveBettingMarket(truthQuestion: PublicKey) {
    const [question] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("betting_question"),
            bettingProgram.programId.toBuffer(),
            truthQuestion.toBuffer(),
        ],
        bettingProgram.programId
    );

    const [vault] = PublicKey.findProgramAddressSync(
        [Buffer.from("bet_vault"), question.toBuffer()],
        bettingProgram.programId
    );

    return { question, vault };
}

export function deriveBettor(bettingQuestion: PublicKey) {
    const [bettor] = PublicKey.findProgramAddressSync(
        [Buffer.from("bettor"), user.toBuffer(), bettingQuestion.toBuffer()],
        bettingProgram.programId
    );

    return bettor;
}

export async function ensureTestEnvironment() {
    const balance = await provider.connection.getBalance(user);

    if (balance < 5 * LAMPORTS_PER_SOL) {
        const signature = await provider.connection.requestAirdrop(
            user,
            10 * LAMPORTS_PER_SOL
        );

        const latest = await provider.connection.getLatestBlockhash();

        await provider.connection.confirmTransaction(
            { signature, ...latest },
            "confirmed"
        );
    }

    const questionCounter = deriveQuestionCounter();

    const counter = await truthProgram.account.questionCounter
        .fetch(questionCounter)
        .catch(() => null);

    if (!counter) {
        console.log("Creating Truth question counter...");

        await truthProgram.methods
            .initializeCounter()
            .accounts({
                questionCounter,
                asker: user,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
    }
}

export async function getNextTruthQuestion() {
    const questionCounter = deriveQuestionCounter();
    const counter = await truthProgram.account.questionCounter.fetch(questionCounter);
    const id = new BN(counter.count.toString());
    const { question, vault } = deriveTruthQuestion(id);

    return { id, question, vault };
}

export async function createTruthQuestion(
    title: string,
    commitSeconds: number,
    revealSeconds: number
) {
    const { id, question, vault } = await getNextTruthQuestion();
    const now = Math.floor(Date.now() / 1000);
    const questionCounter = deriveQuestionCounter();

    await truthProgram.methods
        .createQuestion(
            title,
            new BN(100_000_000),
            new BN(now + commitSeconds),
            new BN(now + revealSeconds)
        )
        .accounts({
            questionCounter,
            question,
            vault,
            asker: user,
            systemProgram: SystemProgram.programId,
        })
        .rpc();

    return { id, question, vault };
}

export async function createBettingMarket(
    title: string,
    truthQuestion: PublicKey,
    closeSeconds: number
) {
    const { question, vault } = deriveBettingMarket(truthQuestion);
    const closeDate = new BN(Math.floor(Date.now() / 1000) + closeSeconds);

    await bettingProgram.methods
        .createBettingQuestion(title, closeDate)
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

export async function placeBet(
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

export function getErrorCode(error: any) {
    return (
        error?.error?.errorCode?.code ??
        error?.error?.errorCode?.number?.toString?.() ??
        error?.message ??
        ""
    );
}

export function deriveTruthUserRecord() {
    const [userRecord] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_record"), user.toBuffer()],
        truthProgram.programId
    );

    return userRecord;
}

export function deriveTruthVoterRecord(question: PublicKey) {
    const [voterRecord] = PublicKey.findProgramAddressSync(
        [Buffer.from("vote"), user.toBuffer(), question.toBuffer()],
        truthProgram.programId
    );

    return voterRecord;
}

export async function ensureTruthVoter() {
    const userRecord = deriveTruthUserRecord();

    const existing = await truthProgram.account.userRecord
        .fetch(userRecord)
        .catch(() => null);

    if (existing) return userRecord;

    const [globalState] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        truthProgram.programId
    );

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

// export async function makeTruthWinner(
//     question: PublicKey,
//     questionId: BN,
//     vote: 1 | 2
// ) {
//     const userRecord = await ensureTruthVoter();
//     const voterRecord = deriveTruthVoterRecord(question);
//     const password = `sbx-${Date.now()}`;

//     const commitment = Array.from(
//         sha256(
//             Buffer.concat([
//                 Buffer.from("truth-vote-v1"),
//                 question.toBuffer(),
//                 user.toBuffer(),
//                 Buffer.from([vote]),
//                 Buffer.from(password),
//             ])
//         )
//     );

//     await truthProgram.methods
//         .commitVote(commitment)
//         .accounts({
//             question,
//             voterRecord,
//             userRecord,
//             voter: user,
//             systemProgram: SystemProgram.programId,
//         })
//         .rpc();

//     await sleep(4_000);

//     await truthProgram.methods
//         .revealVote(password)
//         .accounts({
//             question,
//             voterRecord,
//             userRecord,
//             voter: user,
//         })
//         .rpc();

//     await sleep(4_000);

//     await truthProgram.methods
//         .finalizeVoting(questionId)
//         .accounts({ question })
//         .rpc();
// }
export async function makeTruthWinner(
    question: PublicKey,
    questionId: BN,
    vote: 1 | 2,
    commitWaitMs = 4_000,
    revealWaitMs = 4_000
) {
    const userRecord = await ensureTruthVoter();
    const voterRecord = deriveTruthVoterRecord(question);
    const password = `sbx-${Date.now()}`;

    const commitmentInput = Buffer.concat([
        Buffer.from("truth-vote-v1", "utf8"),
        question.toBuffer(),
        user.toBuffer(),
        Buffer.from([vote]),
        Buffer.from(password, "utf8"),
    ]);

    const commitment = Buffer.from(keccak256.arrayBuffer(commitmentInput));

    await truthProgram.methods.commitVote(commitment).accounts({
        question,
        voterRecord,
        userRecord,
        voter: user,
        systemProgram: SystemProgram.programId,
    }).rpc();

    await sleep(commitWaitMs);

    await truthProgram.methods.revealVote(password).accounts({
        question,
        voterRecord,
        userRecord,
        voter: user,
    }).rpc();

    await sleep(revealWaitMs);

    await truthProgram.methods.finalizeVoting(questionId).accounts({
        question,
    }).rpc();
}