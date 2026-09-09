import { BN } from "@coral-xyz/anchor";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import {
    provider,
    user,
    bettingProgram,
    truthProgram,
    ensureTestEnvironment,
    createTruthQuestion,
    createBettingMarket,
    deriveBettor,
    getErrorCode,
} from "../helpers/solbetx-test-helpers";

describe("SBX-07", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-07 regression: place_bet rejects an unrelated Truth vault", async () => {
        const truth = await createTruthQuestion(
            "SBX-07 Truth question",
            60,
            120
        );

        const market = await createBettingMarket(
            "SBX-07 Market",
            truth.question,
            30
        );

        const bettor = deriveBettor(market.question);
        const betAmount = new BN(1_000_000_000);
        const attacker = Keypair.generate();

        const airdropSig = await provider.connection.requestAirdrop(
            attacker.publicKey,
            1_000_000
        );

        const latest = await provider.connection.getLatestBlockhash();

        await provider.connection.confirmTransaction(
            { signature: airdropSig, ...latest },
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
        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(
            market.question
        );
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

        assert.equal(
            rejected,
            true,
            "Unrelated Truth vault must be rejected"
        );

        assert.include(
            String(errorCode),
            "TruthVaultMismatch",
            "Expected TruthVaultMismatch"
        );

        const truthVaultAfter = await provider.connection.getBalance(truth.vault);
        const attackerAfter = await provider.connection.getBalance(attacker.publicKey);
        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(
            market.question
        );
        const bettorAfterInfo = await provider.connection.getAccountInfo(bettor);

        console.log("");
        console.log("=== SBX-07 REGRESSION RESULT ===");
        console.log("Truth vault change:", truthVaultAfter - truthVaultBefore);
        console.log("Attacker balance change:", attackerAfter - attackerBefore);
        console.log(
            "Market TRUE change:",
            marketAfter.totalBetsOption1.sub(marketBefore.totalBetsOption1).toString()
        );
        console.log("Bettor account exists before:", !!bettorBeforeInfo);
        console.log("Bettor account exists after:", !!bettorAfterInfo);

        assert.equal(
            truthVaultAfter,
            truthVaultBefore,
            "Rejected attack must not change legitimate Truth vault"
        );

        assert.equal(
            attackerAfter,
            attackerBefore,
            "Rejected attack must not pay attacker"
        );

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
});