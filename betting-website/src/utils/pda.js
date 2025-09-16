import { PublicKey } from "@solana/web3.js";

export const findVaultPda = (bettingQuestionPDA, bettingPid) =>
    PublicKey.findProgramAddressSync(
        [Buffer.from("bet_vault"), bettingQuestionPDA.toBuffer()],
        bettingPid
    )[0];

export const findBettorPda = (user, bettingQuestionPDA, bettingPid) =>
    PublicKey.findProgramAddressSync(
        [Buffer.from("bettor"), user.toBuffer(), bettingQuestionPDA.toBuffer()],
        bettingPid
    )[0];

export const findBettingQuestionPda = (truthQuestion, bettingPid) =>
    PublicKey.findProgramAddressSync(
        [Buffer.from("betting_question"), bettingPid.toBuffer(), truthQuestion.toBuffer()],
        bettingPid
    )[0];
