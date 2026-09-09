import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
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
    placeBet,
    makeTruthWinner,
    getErrorCode,
} from "../helpers/solbetx-test-helpers";

describe("SBX-37", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-37: another wallet cannot claim victim's winnings", async () => {
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
        const attacker = Keypair.generate();
        const truth = await createTruthQuestion("SBX-37 unauthorized winnings claim", 10, 20);
        const market = await createBettingMarket("SBX-37 unauthorized winnings claim", truth.question, 5);
        const victimBettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-37 Market:", market.question.toBase58());
        console.log("Victim:", user.toBase58());
        console.log("Victim bettor PDA:", victimBettor.toBase58());
        console.log("Attacker:", attacker.publicKey.toBase58());

        console.log("");
        console.log("STEP 1: victim places 0.1 SOL TRUE");
        await placeBet(
            market.question,
            market.vault,
            truth.question,
            truth.vault,
            victimBettor,
            new BN(100_000_000),
            true
        );

        console.log("STEP 2: Truth resolves TRUE");
        await makeTruthWinner(truth.question, truth.id, 1, 11_000, 10_000);

        console.log("STEP 3: store result");
        await bettingProgram.methods.fetchAndStoreWinner(truth.id).accounts({
            bettingQuestion: market.question,
            truthNetworkQuestion: truth.question,
            truthNetworkProgram: truthProgram.programId,
            houseWallet,
            vault: market.vault,
            systemProgram: SystemProgram.programId,
        }).rpc();

        console.log("STEP 4: fund attacker");
        const sig = await provider.connection.requestAirdrop(
            attacker.publicKey,
            LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(sig, "confirmed");

        const victimBefore = await bettingProgram.account.bettorAccount.fetch(victimBettor);
        const vaultBefore = await provider.connection.getBalance(market.vault);

        console.log("Victim claimed before:", victimBefore.claimed);
        console.log("Victim winnings before:", victimBefore.winnings.toString());

        console.log("");
        console.log("STEP 5: attacker attempts to claim victim's winnings");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods.claimWinnings().accounts({
                bettingQuestion: market.question,
                bettorAccount: victimBettor,
                user: attacker.publicKey,
                vault: market.vault,
            }).signers([attacker]).rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        const victimAfter = await bettingProgram.account.bettorAccount.fetch(victimBettor);
        const vaultAfter = await provider.connection.getBalance(market.vault);

        console.log("");
        console.log("=== SBX-37 RESULT ===");
        console.log("Attack rejected:", rejected);
        console.log("Error:", errorCode);
        console.log("Victim claimed before:", victimBefore.claimed);
        console.log("Victim claimed after:", victimAfter.claimed);
        console.log("Victim winnings before:", victimBefore.winnings.toString());
        console.log("Victim winnings after:", victimAfter.winnings.toString());
        console.log("Vault change:", vaultAfter - vaultBefore);

        assert.equal(rejected, true, "Attacker claim must be rejected");
        assert.equal(victimBefore.claimed, false, "Victim must initially be unclaimed");
        assert.equal(victimAfter.claimed, false, "Victim must remain unclaimed");
        assert.equal(
            victimAfter.winnings.toString(),
            victimBefore.winnings.toString(),
            "Victim winnings field must remain unchanged"
        );
        assert.equal(vaultAfter, vaultBefore, "Vault must remain unchanged");

        console.log("");
        console.log("SBX-37 UNAUTHORIZED WINNINGS CLAIM PROTECTION VERIFIED");
    });
});