import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import { AnchorProvider, Program, BN, web3 } from "@coral-xyz/anchor";
import truthNetworkIDL from "../idls/truth_network.json";
import bettingIDL from "../idls/betting.json";
import { toast } from "react-toastify";

import ConfirmModal from "./ConfirmModal";

const TRUTH_NETWORK_PROGRAM_ID = new PublicKey(import.meta.env.VITE_TRUTH_PROGRAM_ID);
const BETTING_CONTRACT_PROGRAM_ID = new PublicKey(import.meta.env.VITE_BETTING_PROGRAM_ID);

const connection = new web3.Connection(clusterApiUrl("devnet"), "confirmed");

const CreateQuestion = () => {
    const { wallet, publicKey, signTransaction, signAllTransactions, connected } = useWallet(); 
    const [questionText, setQuestionText] = useState("");
    const [bettingEndTime, setBettingEndTime] = useState(0);
    const [loading, setLoading] = useState(false);
    const [bettingProgram, setBettingProgram] = useState(null);
    const [truthNetworkProgram, setTruthNetworkProgram] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);

    const walletAdapter = {
        publicKey,
        signTransaction,
        signAllTransactions,
    };

    const provider = new AnchorProvider(connection, walletAdapter, {
        preflightCommitment: "processed",
    });

    useEffect(() => {
        console.log("use effect connected: ", connected)
        console.log("public key: ", publicKey)
        if (connected && publicKey) {
            console.log("Wallet Connected:", publicKey.toString());

            const walletAdapter = publicKey && signTransaction ? { 
                publicKey, 
                signTransaction, 
                signAllTransactions, 
                network: "devnet" 
            } : null;
            console.log("wallet adapter: ", walletAdapter)
            const provider = new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" });
            console.log("provider: ", provider)

            if (!truthNetworkIDL.accounts) {
                console.error("Error: truthNetworkIDL is missing 'accounts' definition.");
                return;
            }

            console.log("setting betting program")
            setBettingProgram(new Program(bettingIDL, provider));
            console.log("setting truth network program")
            setTruthNetworkProgram(new Program(truthNetworkIDL, provider));

            console.log("Betting & Truth Network Programs Initialized.");
        }
    }, [connected, publicKey]);


    const handleCreateClick = () => {
        if (questionText.length < 10) 
            return toast.error("Event must be at least 10 characters.");

        if (questionText.length > 150) 
            return toast.error("Event must be at max 150 characters.");

        if (!bettingEndTime || new Date(bettingEndTime) <= new Date()) 
            return toast.error("Close date must be in the future.");

        setShowConfirm(true);
    };


    const createQuestion = async () => {
        if (!publicKey) return alert("Please connect your wallet");
        if (!questionText || !bettingEndTime ) return alert("All fields are required");
        if (!connected) {
            console.error("Wallet is not connected.");
            return alert("Please connect your wallet first.");
        }

        if (!connected || !publicKey) {
            console.error("Wallet is not fully connected.");
            return alert("Please connect your wallet before proceeding.");
        }

        console.log("Creating question...");
        console.log("Public Key:", publicKey.toString());

        try {
            const [questionCounterPDA] = await PublicKey.findProgramAddress(
                [
                    Buffer.from("question_counter"), 
                    publicKey.toBuffer()
                ],
                TRUTH_NETWORK_PROGRAM_ID
            );
            console.log("question counter pda: ", questionCounterPDA.toString())
            let questionCounterAccount = await truthNetworkProgram.account.questionCounter.fetch(questionCounterPDA).catch(() => null);

            if (!questionCounterAccount) {
                console.log("Initializing question counter...");
                const tx = await truthNetworkProgram.methods
                    .initializeCounter()
                    .accounts({
                        questionCounter: questionCounterPDA,
                        asker: publicKey,
                        systemProgram: web3.SystemProgram.programId,
                    })
                    .rpc();

                console.log("Question counter initialized: ", tx);

                questionCounterAccount = await truthNetworkProgram.account.questionCounter.fetch(questionCounterPDA);
            }
            
            const questionCount = questionCounterAccount.count;
            console.log("question count: ", questionCount.count)

            const questionIdBuffer = new BN(questionCount).toArrayLike(Buffer, "le", 8);
            const [questionPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("question"), publicKey.toBuffer(), questionIdBuffer],
                TRUTH_NETWORK_PROGRAM_ID
            );

            const bettingEndTimeTimestamp = new BN(Math.floor(new Date(bettingEndTime).getTime() / 1000));

            const rewardLamports = new BN(100_000_000); // For now, rewards defaults to 0.1 sol
            const selectedTime = new Date(bettingEndTime);
            const bettingTimestamp = Math.floor(selectedTime.getTime() / 1000);

            // Calculate commit and reveal times
            const commitEndTimeTimestamp = new BN(bettingTimestamp + 24 * 60 * 60); // +one day after betting close date
            const revealEndTimeTimestamp = new BN(bettingTimestamp + 48 * 60 * 60); // +two days after betting close date
            // const commitEndTimeTimestamp = new BN(bettingTimestamp + 3 * 60); // +3 minutes for testing purposes
            // const revealEndTimeTimestamp = new BN(bettingTimestamp + 6 * 60); // +6 minutes for testing purposes

            console.log("calculated commit end time: ", commitEndTimeTimestamp)
            console.log("calculated reveal end time: ", revealEndTimeTimestamp)

            const [truthVaultPDA] = await PublicKey.findProgramAddress(
                [Buffer.from("vault"), questionPDA.toBuffer()],
                TRUTH_NETWORK_PROGRAM_ID
              );
            console.log("Truth network Vault PDA: ", truthVaultPDA)

            console.log("Calling truth network create question function")
            const tx = await truthNetworkProgram.methods
                .createQuestion(questionText, rewardLamports, commitEndTimeTimestamp, revealEndTimeTimestamp)
                .accounts({
                    asker: publicKey,
                    questionCounter: questionCounterPDA,
                    question: questionPDA,
                    vault: truthVaultPDA,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();
            console.log("Successfully created question in the truth network with tx: ", tx)
            console.log("Successfully created question in Truth Network:", questionPDA.toString());

            const [bettingQuestionPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("betting_question"),
                    BETTING_CONTRACT_PROGRAM_ID.toBuffer(),
                    questionPDA.toBuffer()
                ],
                BETTING_CONTRACT_PROGRAM_ID
            );

            console.log("Derived BettingQuestion PDA:", bettingQuestionPDA.toString());

            const [bettingVaultPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("bet_vault"),
                    new PublicKey(bettingQuestionPDA).toBuffer()
                ],
                bettingProgram.programId
            );

            console.log("Vault PDA: ", bettingVaultPDA.toBase58());

            // Call Betting Smart Contract Create Question
            // console.log("Calling Betting Smart Contract createBettingQuestion function...");
            // console.log("question pda: ", questionPDA.toString())
            // console.log("questionText: ", questionText)
            // console.log("bettingEndTimeTimestamp: ", bettingEndTimeTimestamp)
            // console.log("Expected signer:", publicKey.toString());
            // console.log("Wallet Debugging:");
            // console.log("=== Wallet Connected:", connected);
            // console.log("=== Public Key:", publicKey ? publicKey.toString() : "No Public Key");
            // console.log("=== Wallet Object:", wallet ? wallet : "No Wallet");
            // console.log("=== Wallet Adapter:", wallet && wallet.adapter ? wallet.adapter : "No Adapter");
            // console.log("=== Wallet Sign Transaction:", signTransaction ? "Yes" : "No");
            // console.log("Final Signing Debug:");
            // console.log("=== BettingQuestion PDA:", bettingQuestionPDA.toString());
            // console.log("=== Creator:", publicKey.toString());
            // console.log("=== Using Signers:", wallet.adapter ? wallet.adapter.publicKey.toString() : "No Signer");

            const txBet = await bettingProgram.methods
                .createBettingQuestion(questionText, bettingEndTimeTimestamp)
                .accounts({
                    bettingQuestion: bettingQuestionPDA,
                    creator: publicKey,
                    questionPda: questionPDA,
                    systemProgram: web3.SystemProgram.programId,
                    vault: bettingVaultPDA
                })
                .rpc();
            

            console.log("Betting Smart Contract Event Created! TX:", txBet);
            console.log("Successfully created event in Betting Contract:", bettingQuestionPDA.toString());
            toast.success("Event successfully created!");
        } catch (error) {
            console.error("Transaction failed:", error);
            alert(`Failed to create event. Error: ${error.message}`);
        }
    };

    return (
        <div className="max-w-lg mx-auto p-6 bg-white shadow-lg text-gray-800 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Create an Event</h2>
            <input
                type="text"
                placeholder="Enter event..."
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                className="w-full p-2 border border-1 border-color-gray-400 text-gray-600 rounded-md mb-3"
            />
            <label>Betting Close Date</label>
            <input 
                type="datetime-local" 
                value={bettingEndTime} 
                onChange={(e) => setBettingEndTime(e.target.value)} 
                placeholder="Betting End Time" 
                className="w-full p-2 border border-1 border-color-gray-400 text-gray-600  rounded-md mb-3"
            />
            <button
                onClick={handleCreateClick}
                className="w-full !bg-blue-600 text-white py-2 rounded-md"
                disabled={loading}
            >
                {loading ? "Creating..." : "Create Event"}
            </button>

            <ConfirmModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={() => {
                    setShowConfirm(false);
                    createQuestion();
                }}
            />
        </div>
    );
};

export default CreateQuestion;
