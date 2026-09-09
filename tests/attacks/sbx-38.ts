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

describe("SBX-38", () => {
    before(async () => {
        await ensureTestEnvironment();
    });

    it("SBX-38: another wallet cannot delete victim's bettor record", async () => {
        const houseWallet = new PublicKey("CQaZgx5jqQrz7c8shCG3vJLiiPGPrawSGhvkgXtGyxL");
        const attacker = Keypair.generate();
        const truth = await createTruthQuestion("SBX-38 unauthorized bettor deletion", 10, 20);
        const market = await createBettingMarket("SBX-38 unauthorized bettor deletion", truth.question, 5);
        const victimBettor = deriveBettor(market.question);

        console.log("");
        console.log("SBX-38 Market:", market.question.toBase58());
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

        console.log("STEP 4: victim claims normally");
        await bettingProgram.methods.claimWinnings().accounts({
            bettingQuestion: market.question,
            bettorAccount: victimBettor,
            user,
            vault: market.vault,
        }).rpc();

        console.log("STEP 5: fund attacker");
        const sig = await provider.connection.requestAirdrop(
            attacker.publicKey,
            LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(sig, "confirmed");

        const marketBefore = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const victimBefore = await bettingProgram.account.bettorAccount.fetchNullable(victimBettor);
        const vaultBefore = await provider.connection.getBalance(market.vault);

        console.log("Victim account exists before:", victimBefore !== null);
        console.log("Records closed before:", marketBefore.bettorRecordsClosed.toString());

        console.log("");
        console.log("STEP 6: attacker attempts to delete victim bettor record");

        let rejected = false;
        let errorCode = "";

        try {
            await bettingProgram.methods.deleteBettorAccount().accounts({
                bettingQuestion: market.question,
                bettorAccount: victimBettor,
                user: attacker.publicKey,
            }).signers([attacker]).rpc();
        } catch (error: any) {
            rejected = true;
            errorCode = getErrorCode(error);
            console.log("Rejected with:", errorCode);
        }

        const marketAfter = await bettingProgram.account.bettingQuestion.fetch(market.question);
        const victimAfter = await bettingProgram.account.bettorAccount.fetchNullable(victimBettor);
        const vaultAfter = await provider.connection.getBalance(market.vault);

        console.log("");
        console.log("=== SBX-38 RESULT ===");
        console.log("Attack rejected:", rejected);
        console.log("Error:", errorCode);
        console.log("Victim account exists after:", victimAfter !== null);
        console.log("Records closed before:", marketBefore.bettorRecordsClosed.toString());
        console.log("Records closed after:", marketAfter.bettorRecordsClosed.toString());
        console.log("Vault change:", vaultAfter - vaultBefore);

        assert.equal(rejected, true, "Unauthorized bettor deletion must be rejected");
        assert.isNotNull(victimBefore, "Victim bettor record must exist before attack");
        assert.isNotNull(victimAfter, "Victim bettor record must remain after attack");
        assert.equal(
            marketAfter.bettorRecordsClosed.toString(),
            marketBefore.bettorRecordsClosed.toString(),
            "Closed-record count must not change"
        );
        assert.equal(vaultAfter, vaultBefore, "Vault must remain unchanged");

        console.log("");
        console.log("SBX-38 UNAUTHORIZED BETTOR DELETION PROTECTION VERIFIED");
    });
});