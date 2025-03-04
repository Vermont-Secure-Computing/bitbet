import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, web3 } from "@coral-xyz/anchor";
import { useNavigate } from "react-router-dom";
import bettingIDL from "../idls/betting.json";
import truthNetworkIDL from "../idls/truth_network.json";

const BETTING_CONTRACT_PROGRAM_ID = new PublicKey(import.meta.env.VITE_BETTING_PROGRAM_ID);
const TRUTH_NETWORK_PROGRAM_ID = new PublicKey(import.meta.env.VITE_TRUTH_PROGRAM_ID);


const FetchQuestion = () => {
    const { publicKey, connected } = useWallet();
    const navigate = useNavigate();
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Setup Provider & Programs
    const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");
    
    // Dummy PublicKey for initialization
    const wallet = {
        publicKey: publicKey || new PublicKey("11111111111111111111111111111111") 
    };

    const provider = new AnchorProvider(connection, wallet, { preflightCommitment: "processed" });

    const bettingProgram = new Program(bettingIDL, provider);
    const truthNetworkProgram = new Program(truthNetworkIDL, provider);

    useEffect(() => {
        if (connected) {
            fetchAllQuestions();
        }
    }, [connected]);

    const fetchAllQuestions = async () => {
        console.log("Betting Program:", bettingProgram);
        console.log("Fetching Questions...");
        
        if (!publicKey) {
            alert("Please connect your wallet");
            return;
        }

        try {
            setLoading(true);

            // Check if bettingProgram is initialized
            if (!bettingProgram.account?.bettingQuestion) {
                console.error("Betting program account not initialized!");
                return;
            }

            // Fetch all betting questions
            const accounts = await bettingProgram.account.bettingQuestion.all();
            console.log("Fetched Betting Questions:", accounts);

            if (!accounts.length) {
                console.warn("No betting questions found!");
                setLoading(false);
                return;
            }

            // Fetch associated questions from the Truth Network
            const questionsWithDetails = await Promise.all(
                accounts.map(async (bettingQuestion) => {
                    console.log("Fetching Truth-Network Question for PDA:", bettingQuestion.account.questionPda.toString());

                    try {
                        const truthQuestion = await truthNetworkProgram.account.question.fetch(
                            bettingQuestion.account.questionPda
                        );
                        return { betting: bettingQuestion.account, truth: truthQuestion };
                    } catch (error) {
                        console.error("Error fetching Truth-Network question:", error);
                        return { betting: bettingQuestion.account, truth: null };
                    }
                })
            );

            console.log("Fetched Questions:", questionsWithDetails);
            setQuestions(questionsWithDetails);
        } catch (error) {
            console.error("Error fetching questions:", error);
            alert("Failed to fetch questions.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto mt-10 p-6 border border-gray-600 rounded-lg shadow-lg bg-gray-900 text-white">
            <h2 className="text-2xl font-bold text-gray-200">All Questions</h2>
            {loading ? <p className="text-gray-400">Loading...</p> : null}
            <ul className="mt-4 space-y-4">
                {questions.map((q, index) => (
                    <li key={index} 
                        onClick={() => navigate(`/question/${q.betting.questionPda.toString()}`, { state: q })}
                        className="p-4 bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer border border-gray-700 shadow-md">
                        <strong className="text-lg text-blue-400">{q.betting.title}</strong>
                        <p className="text-gray-400">🔹 Truth Network ID: {q.truth?.id?.toString() || "Not Found"}</p>
                        <p className="text-gray-500 text-sm">PDA: {q.betting.questionPda.toString()}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default FetchQuestion;
