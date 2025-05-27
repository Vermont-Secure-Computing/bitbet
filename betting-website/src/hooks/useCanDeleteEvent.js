import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { getConstants } from "../constants";

export function useCanDeleteEvent(questionData, publicKey, connection) {

    const constants = getConstants();
    const BETTING_CONTRACT_PROGRAM_ID = constants.BETTING_CONTRACT_PROGRAM_ID;
    const [canDelete, setCanDelete] = useState(false);

    useEffect(() => {
        if (!questionData || !publicKey) return;

        (async () => {
        try {
            const now = Math.floor(Date.now() / 1000);

            const isFinalized = questionData.truth.finalized;
            const revealEnded = questionData.truth.revealEndTime <= now;

            const truthVault = new PublicKey(questionData.truth.vaultAddress);
            const truthVaultInfo = await connection.getAccountInfo(truthVault);
            const truthMinRent = await connection.getMinimumBalanceForRentExemption(8);
            const truthOnlyRent = (truthVaultInfo?.lamports || 0) - truthMinRent < 1000;
            const rentExpired = questionData.truth.rentExpiration <= now;

            const betVault = new PublicKey(questionData.betting.vault);
            const betVaultInfo = await connection.getAccountInfo(betVault);
            const betMinRent = await connection.getMinimumBalanceForRentExemption(0);
            const betOnlyRent = (betVaultInfo?.lamports || 0) - betMinRent < 1000;

            const [bettorPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("bettor"), publicKey.toBuffer(), betVault.toBuffer()],
                BETTING_CONTRACT_PROGRAM_ID
            );

            const hasBettorAccount = await connection.getAccountInfo(bettorPda);

            const creatorCheck = publicKey.toBase58() === questionData.betting.creator;
            const askerCheck = publicKey.toBase58() === questionData.truth.asker;

            const committedCheck = questionData.truth.committedVoters === 0 ||
            (questionData.truth.voterRecordsClosed === questionData.truth.voterRecordsCount &&
            (questionData.truth.totalDistributed >= questionData.truth.snapshotReward ||
                questionData.truth.originalReward === 0));

            const allow =
                isFinalized &&
                revealEnded &&
                truthOnlyRent &&
                betOnlyRent &&
                rentExpired &&
                creatorCheck &&
                askerCheck &&
                !hasBettorAccount &&
                committedCheck;

            setCanDelete(allow);
        } catch (e) {
            console.warn("Error checking event deletion eligibility:", e);
            setCanDelete(false);
        }
        })();
    }, [questionData, publicKey, connection]);

    return canDelete;
}
