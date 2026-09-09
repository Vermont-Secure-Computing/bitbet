import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import {
    provider,
    user,
    bettingProgram,
    truthProgram,
    ensureTestEnvironment,
    createTruthQuestion,
    createBettingMarket,
} from "../helpers/solbetx-test-helpers";

describe("SBX-LIFECYCLE-01", () => {
    before(async () => {
        console.log("");
        console.log("=== SBX LIFECYCLE 01 ===");
        console.log("RPC:", provider.connection.rpcEndpoint);
        console.log("Wallet:", user.toBase58());
        console.log("SolBetX:", bettingProgram.programId.toBase58());
        console.log("Truth:", truthProgram.programId.toBase58());

        await ensureTestEnvironment();

        const balance = await provider.connection.getBalance(user);

        console.log(
            "Balance:",
            (balance / LAMPORTS_PER_SOL).toFixed(4),
            "SOL"
        );
    });

    it("sets claim expiry to Truth reveal end + 120 seconds", async () => {
        const title = "SBX local lifecycle deadline test";

        const truth = await createTruthQuestion(
            title,
            30,
            60
        );

        console.log("");
        console.log("Truth question:", truth.question.toBase58());

        const truthData =
            await truthProgram.account.question.fetch(
                truth.question
            );

        console.log(
            "Truth commitEndTime:",
            truthData.commitEndTime.toString()
        );

        console.log(
            "Truth revealEndTime:",
            truthData.revealEndTime.toString()
        );

        const market = await createBettingMarket(
            title,
            truth.question,
            20
        );

        console.log(
            "SolBetX question:",
            market.question.toBase58()
        );

        const bettingData =
            await bettingProgram.account.bettingQuestion.fetch(
                market.question
            );

        console.log(
            "SolBetX claimExpiresAt:",
            bettingData.claimExpiresAt.toString()
        );

        const expectedExpiry = new BN(
            truthData.revealEndTime.toString()
        ).add(new BN(120));

        console.log("");
        console.log(
            "Expected expiry:",
            expectedExpiry.toString()
        );

        console.log(
            "Actual expiry:  ",
            bettingData.claimExpiresAt.toString()
        );

        assert.equal(
            bettingData.claimExpiresAt.toString(),
            expectedExpiry.toString(),
            "claim_expires_at must equal Truth reveal_end_time + 120 seconds"
        );

        console.log("");
        console.log("SBX CLAIM DEADLINE LINK VERIFIED");
    });
});