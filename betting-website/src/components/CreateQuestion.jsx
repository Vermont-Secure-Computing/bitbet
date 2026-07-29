import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, BN, web3 } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import { BsLock } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import InfoWithTooltip from "./InfoWithTooltip";
import ConfirmModal from "./ConfirmModal";
import { getConstants } from "../constants";
import { getIdls } from "../idls";

import { sendAndConfirmIxs } from "../utils/txUtils";
import { computeBudgetIxs } from "../utils/rpcClient"
import { parseAnchorLogHint } from "../utils/logUtils";

const CreateQuestion = ({setActiveTab}) => {
    const constants = getConstants();
    const BETTING_CONTRACT_PROGRAM_ID = constants.BETTING_CONTRACT_PROGRAM_ID;
    const TRUTH_NETWORK_PROGRAM_ID = constants.TRUTH_NETWORK_PROGRAM_ID;

    const { bettingIDL, truthNetworkIDL } = getIdls();
    const navigate = useNavigate();
    const { wallet, publicKey, signTransaction, signAllTransactions, sendTransaction, connected } = useWallet(); 
    const [questionText, setQuestionText] = useState("");
    const [bettingEndTime, setBettingEndTime] = useState(0);
    const [loading, setLoading] = useState(false);
    const [bettingProgram, setBettingProgram] = useState(null);
    const [truthNetworkProgram, setTruthNetworkProgram] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);

    const [commitEndTime, setCommitEndTime] = useState("");
    const [revealEndTime, setRevealEndTime] = useState("");
    const [showCommitInput, setShowCommitInput] = useState(false);

    // Setup Provider & Programs
    const rpcUrl = constants.DEFAULT_RPC_URL;
    const connection = new web3.Connection(rpcUrl, "confirmed");

    const walletAdapter = {
        publicKey,
        signTransaction,
        signAllTransactions,
    };

    const provider = new AnchorProvider(connection, walletAdapter, {
        preflightCommitment: "processed",
    });

    useEffect(() => {
        if (connected && publicKey) {

            const walletAdapter = publicKey && signTransaction ? { 
                publicKey, 
                signTransaction, 
                signAllTransactions, 
                network: "mainnet" 
            } : null;
            const provider = new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" });

            if (!truthNetworkIDL.accounts) {
                console.error("Error: truthNetworkIDL is missing 'accounts' definition.");
                return;
            }

            setBettingProgram(new Program(bettingIDL, provider));
            setTruthNetworkProgram(new Program(truthNetworkIDL, provider));

            console.log("Betting & Truth Network Programs Initialized.");
        }
    }, [connected, publicKey]);


    const getMinDateTime = () => {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
      
        const year = now.getFullYear();
        const month = pad(now.getMonth() + 1);
        const day = pad(now.getDate());
        const hours = pad(now.getHours());
        const minutes = pad(now.getMinutes());
      
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const handleCreateClick = () => {
        const now = new Date();
        const close = new Date(bettingEndTime);
        const commit = new Date(commitEndTime);
        const reveal = new Date(revealEndTime);

        console.log("close: ", close)
        console.log("commit: ", commit)
        console.log("reveal: ", reveal)
    
        // Basic validations
        if (questionText.length < 10) 
            return toast.error("Event must be at least 10 characters.");
    
        if (questionText.length > 150) 
            return toast.error("Event must be at max 150 characters.");
    
        if (!bettingEndTime || close <= now) 
            return toast.error("Close date must be in the future.");
    
        //Commit must be at least 1 dat after betting close
        if (commit.getTime() - close.getTime() < 1 * 24 * 60 * 60 * 1000) {
            return toast.error("Commit End Time must be at least 1 day after Betting Close Date.");
        }
    
        // Reveal must be at least 1 day after commit end
        if (reveal.getTime() - commit.getTime() < 1 * 24 * 60 * 60 * 1000) {
            return toast.error("Reveal End Time must be at least 1 day after Commit End Time.");
        }
    
        setShowConfirm(true);
    };


    const createQuestion = async () => {
        
        if (!publicKey) return alert("Please connect your wallet");
        
        if (!connected) {
            console.error("Wallet is not connected.");
            return alert("Please connect your wallet first.");
        }

        if (!connected || !publicKey) {
            console.error("Wallet is not fully connected.");
            return alert("Please connect your wallet before proceeding.");
        }

        if (!questionText || !bettingEndTime ) return alert("All fields are required");

        if (!truthNetworkProgram || !bettingProgram) {
            return alert("Programs not ready yet. Please retry in a moment.");
        }

        const thinWallet = {publicKey, sendTransaction, signTransaction, signAllTransactions}

        setLoading(true);
        console.log("Creating question...");

        try {
            /*
            * All blockchain instructions are placed in this array
            * and submitted together using one wallet confirmation.
            */
            const instructions = [
                ...computeBudgetIxs(),
            ];

            /*
            * Truth Network question counter
            */
            const [questionCounterPDA] = await PublicKey.findProgramAddress(
                [
                    Buffer.from("question_counter"), 
                    publicKey.toBuffer()
                ],
                TRUTH_NETWORK_PROGRAM_ID
            );

            const questionCounterAccount = await truthNetworkProgram.account.questionCounter.fetch(questionCounterPDA).catch(() => null);

            let questionCount;

            if (!questionCounterAccount) {
                console.log("Initializing question counter instruction...");

                const initializeCounterTx = await truthNetworkProgram.methods
                    .initializeCounter()
                    .accounts({
                        questionCounter: questionCounterPDA,
                        asker: publicKey,
                        systemProgram: web3.SystemProgram.programId,
                    })
                    .instruction();

                instructions.push(initializeCounterTx);

                questionCount = 0;
            } else {
                questionCount = new BN(questionCounterAccount.count.toString()).toNumber();
            }

            const questionIdBuffer = new BN(questionCount).toArrayLike(Buffer, "le", 8);

            const [questionPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("question"),
                    publicKey.toBuffer(),
                    questionIdBuffer,
                ],
                TRUTH_NETWORK_PROGRAM_ID
            )

            console.log("Truth Network question PDA:", questionPDA.toBase58());

            /**
             * Event times
             */
            const bettingEndTimeTimestamp = new BN(Math.floor(new Date(bettingEndTime).getTime() / 1000));
            const commitEndTimeTimestamp = new BN(Math.floor(new Date(commitEndTime).getTime() / 1000));
            const revealEndTimeTimestamp = new BN(Math.floor(new Date(revealEndTime).getTime() / 1000));  

            const rewardLamports = new BN(100_000_000);

            /**
             * Truth Network vault
             */
            const [truthVaultPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("vault"),
                    questionPDA.toBuffer(),
                ], 
                TRUTH_NETWORK_PROGRAM_ID
            );

            console.log("Truth Network vault PDA: ", truthVaultPDA.toBase58());

            /**
             * Create the Truth Network Question
             */
            const createTruthQuestionIx = await truthNetworkProgram.methods
                .createQuestion(
                    questionText,
                    rewardLamports,
                    commitEndTimeTimestamp,
                    revealEndTimeTimestamp
                )
                .accounts({
                    asker: publicKey,
                    questionCounter: questionCounterPDA,
                    question: questionPDA,
                    vault: truthVaultPDA,
                    systemProgram: web3.SystemProgram.programId,
                })
                .instruction();
            
            instructions.push(createTruthQuestionIx);


            /**
             * Betting programs PDAs
             */
            const [bettingQuestionPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("betting_question"),
                    BETTING_CONTRACT_PROGRAM_ID.toBuffer(),
                    questionPDA.toBuffer(),
                ],
                BETTING_CONTRACT_PROGRAM_ID
            );

            console.log("Betting question PDA: ", bettingQuestionPDA.toBase58());

            const [bettingVaultPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("bet_vault"),
                    bettingQuestionPDA.toBuffer(),
                ],
                bettingProgram.programId
            );

            console.log("Betting vault PDA: ", bettingVaultPDA.toBase58());

            /**
             * Create the SolBetX betting event
             */
            const createBettingQuestion = await bettingProgram.methods
                .createBettingQuestion(
                    questionText,
                    bettingEndTimeTimestamp
                )
                .accounts({
                    bettingQuestion: bettingQuestionPDA,
                    creator: publicKey,
                    questionPda: questionPDA,
                    systemProgram: web3.SystemProgram.programId
                })
                .instruction();

            instructions.push(createBettingQuestion);

            console.log(`Sending one transaction containing ${instructions.length} instructions`);

            const signature = await sendAndConfirmIxs({
                ixs: instructions,
                connection,
                wallet: thinWallet,
                feePayer: publicKey,
            });

            console.log("SolBetX event created successfully: ", signature);

            /*
            * Store social-sharing metadata.
            * This is a normal API request and does not open the wallet.
            */
            try {
                await fetch("https://solbetx.com/api/event", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        id: bettingQuestionPDA.toBase58(),
                        title: questionText,
                        image:
                            "https://solbetx.com/og/solbetx-preview.png",
                    }),
                });
            } catch (metadataError) {
                console.warn(
                    "OG metadata request failed:",
                    metadataError?.message || metadataError
                );
            }

            toast.success("Event successfully created!");
            setActiveTab("fetch");

        } catch (error) {
            console.error("Create event transaction failed:", error);
            console.error("Error logs:", error?.logs);

            const hint =
                parseAnchorLogHint(error?.logs) ||
                error?.message ||
                "Unknown transaction error";

            alert(`Failed to create event. Error: ${hint}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-lg mx-auto my-8 p-6 bg-white shadow-lg text-gray-800 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Create an Event</h2>

            {publicKey ?
                <>
                    <input
                        type="text"
                        placeholder="Enter event..."
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        className="w-full p-2 border border-gray-400 text-gray-600 rounded-md mb-3"
                    />
                
                    <InfoWithTooltip
                        label="Betting Close Date"
                        tooltip="The final time users can place a bet."
                    >
                        <input
                            type="datetime-local"
                            value={bettingEndTime}
                            min={getMinDateTime()}
                            onChange={(e) => {
                                const selected = e.target.value;
                                setBettingEndTime(selected);

                                if (selected) {
                                    const closeDate = new Date(selected);
                                    const commitDate = new Date(closeDate.getTime() + 7 * 24 * 60 * 60 * 1000); // default: 1 week after betting end time
                                    const revealDate = new Date(closeDate.getTime() + 10 * 24 * 60 * 60 * 1000); // default: 3 days after betting end time

                                  
                                    // Convert to local datetime format
                                    const format = (d) => d.toLocaleString("sv-SE").replace(" ", "T").slice(0, 16);
                                  
                                    setCommitEndTime(format(commitDate));
                                    setRevealEndTime(format(revealDate));
                                  }

                            }}
                            className="w-full p-2 border border-gray-300 rounded-md mt-1"
                        />
                    </InfoWithTooltip>

                    
                    {!showCommitInput ? (
                        <span
                            onClick={() => setShowCommitInput(true)}
                            className="text-blue-600 text-sm underline cursor-pointer mb-2 inline-block"
                        >
                            Enter custom resolution date
                        </span>
                    ) : (
                        <>
                            <InfoWithTooltip
                                label="Commit End Time"
                                tooltip="Used by the Truth Network. This is the deadline for voters to commit their votes. It must be at least 1 week after the betting close date. The reveal phase will begin immediately after and end based on the Reveal End Time."
                            >
                                <input
                                    type="datetime-local"
                                    value={commitEndTime}
                                    min={
                                        bettingEndTime
                                            ? new Date(new Date(bettingEndTime).getTime() + 1 * 24 * 60 * 60 * 1000) // min of 1 day after betting end time
                                                  .toLocaleString("sv-SE")
                                                  .replace(" ", "T")
                                                  .slice(0, 16)
                                            : ""
                                    }
                                    onChange={(e) => {
                                        const selected = e.target.value;
                                        setCommitEndTime(selected);

                                        if (selected) {
                                            const commitDate = new Date(selected);
                                            const revealDate = new Date(commitDate.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days after commit end time
                                        
                                            const format = (d) => d.toLocaleString("sv-SE").replace(" ", "T").slice(0, 16);
                                            setRevealEndTime(format(revealDate));
                                        }
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-md mt-1"
                                />
                            </InfoWithTooltip>

                            <InfoWithTooltip
                                label="Reveal End Time"
                                tooltip="Used by the Truth Network. This is the deadline for voters to reveal their committed votes. It must be at least 3 days after the commit end time."
                            >
                                <input
                                    type="datetime-local"
                                    value={revealEndTime}
                                    min={
                                        commitEndTime
                                            ? new Date(new Date(commitEndTime).getTime() + 1 * 24 * 60 * 60 * 1000) // min of 1 day after betting end time
                                                .toLocaleString("sv-SE")
                                                .replace(" ", "T")
                                                .slice(0, 16)
                                            : ""
                                    }
                                    onChange={(e) => {
                                        const selected = e.target.value;
                                        setRevealEndTime(selected);
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-md mt-1"
                                />
                            </InfoWithTooltip>
                            <span
                                onClick={() => setShowCommitInput(false)}
                                className="text-blue-600 text-sm underline cursor-pointer mb-2 inline-block"
                            >
                                Hide Commit End Time
                            </span>
                        </>
                    )}
                
                    {/* Preview Summary Box */}
                    {/* <div className="bg-white border border-blue-400 rounded-lg p-4 text-sm text-gray-800 mb-4 shadow-sm">
                        <p className="font-semibold text-blue-600 mb-2">Preview Summary</p>
                        <div className="space-y-1 pl-2">
                            <p><span className="font-medium">Event:</span> {questionText || "-"}</p>
                            <p><span className="font-medium">Betting Closes:</span> {bettingEndTime || "-"}</p>
                            <p><span className="font-medium">Commit Ends:</span> {commitEndTime || "-"}</p>
                            <p><span className="font-medium">Reveal Ends:</span> {revealEndTime || "-"}</p>
                        </div>
                    </div> */}
                
                    <button
                        onClick={handleCreateClick}
                        className="w-full !bg-blue-600 text-white py-2 rounded-md"
                        disabled={loading}
                    >
                    {loading ? (
                        <span className="flex items-center justify-center">
                        Submitting <span className="dot-animate">.</span>
                        <span className="dot-animate dot2">.</span>
                        <span className="dot-animate dot3">.</span>
                        </span>
                    ) : (
                        "Create Event"
                    )}
                    </button>
                </>
              
                :
                <div className="mt-6 p-4 border-l-4 border-blue-500 text-blue-600 rounded-md flex items-start gap-3">
                    <BsLock className="text-2xl mt-0.5" />
                    <div>
                        <p className="font-medium">Wallet not connected</p>
                        <p className="text-sm">Connect your wallet to create an Event.</p>
                    </div>
                </div>

            }

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
