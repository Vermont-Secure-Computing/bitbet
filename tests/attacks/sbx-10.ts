import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import {
    provider,
    user,
    bettingProgram,
    ensureTestEnvironment,
    getErrorCode,
} from "../helpers/solbetx-test-helpers";

describe("SBX-10", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-10 regression: create_betting_question rejects a fake non-Truth question", async () => {
        const fakeTruth = Keypair.generate();

        const sig = await provider.connection.requestAirdrop(
            fakeTruth.publicKey,
            10_000_000
        );
        const latest = await provider.connection.getLatestBlockhash();

        await provider.connection.confirmTransaction(
            { signature: sig, ...latest },
            "confirmed"
        );

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

        const fakeInfoBefore = await provider.connection.getAccountInfo(
            fakeTruth.publicKey
        );
        const marketBefore = await provider.connection.getAccountInfo(market);
        const vaultBefore = await provider.connection.getAccountInfo(vault);

        assert.isNotNull(
            fakeInfoBefore,
            "Fake account must exist before attack"
        );

        assert.equal(
            fakeInfoBefore?.owner.toBase58(),
            SystemProgram.programId.toBase58(),
            "Fake Truth account must be System Program owned"
        );

        assert.isNull(
            marketBefore,
            "Market must not exist before attack"
        );

        assert.isNull(
            vaultBefore,
            "Market vault must not exist before attack"
        );

        console.log("");
        console.log("SBX-10 fake Truth account:", fakeTruth.publicKey.toBase58());
        console.log("Fake account owner:", fakeInfoBefore?.owner.toBase58());
        console.log("Derived market:", market.toBase58());
        console.log("");
        console.log("=== SBX-10 REGRESSION ATTACK ===");

        let rejected = false;
        let errorCode = "";

        try {
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
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        assert.equal(
            rejected,
            true,
            "Fake non-Truth question must be rejected"
        );

        assert.include(
            String(errorCode),
            "AccountOwnedByWrongProgram",
            "Expected AccountOwnedByWrongProgram"
        );

        const fakeInfoAfter = await provider.connection.getAccountInfo(
            fakeTruth.publicKey
        );
        const marketAfter = await provider.connection.getAccountInfo(market);
        const vaultAfter = await provider.connection.getAccountInfo(vault);

        console.log("");
        console.log("=== SBX-10 REGRESSION RESULT ===");
        console.log("Fake account still exists:", !!fakeInfoAfter);
        console.log("Fake owner:", fakeInfoAfter?.owner.toBase58());
        console.log("Market created:", !!marketAfter);
        console.log("Market vault created:", !!vaultAfter);

        assert.isNotNull(
            fakeInfoAfter,
            "Rejected attack must not remove fake account"
        );

        assert.equal(
            fakeInfoAfter?.owner.toBase58(),
            SystemProgram.programId.toBase58(),
            "Fake account must remain System Program owned"
        );

        assert.isNull(
            marketAfter,
            "Rejected attack must not create SolBetX market"
        );

        assert.isNull(
            vaultAfter,
            "Rejected attack must not create SolBetX vault"
        );

        console.log("");
        console.log("SBX-10 PATCH VERIFIED");
    });
});