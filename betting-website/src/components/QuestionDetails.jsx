import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import { getBettingProgram, getTruthNetworkProgram } from "../solana";
const QuestionDetails = () => {
    const location = useLocation();

    // Get the passed question data from the state
    const questionData = location.state; 
    const { publicKey, sendTransaction } = useWallet();

    if (!questionData) return <p>No question data available</p>; // Handle missing data

    const [betAmount, setBetAmount] = useState("");
    const [loading, setLoading] = useState(false);

    const handleBet = async (isOption1) => {
        if (!publicKey) return toast.error("Please connect your wallet.");
        if (!betAmount || isNaN(betAmount) || betAmount <= 0) {
            return toast.error("Enter a valid bet amount.");
        }

        setLoading(true);

        try {
            const wallet = { publicKey, signTransaction: sendTransaction };
            const bettingProgram = getBettingProgram(wallet);
            const truthNetworkProgram = getTruthNetworkProgram(wallet);

            const betAmountLamports = Math.floor(betAmount * 1_000_000_000); // Convert to lamports

            const tx = await bettingProgram.methods
                .placeBet(betAmountLamports, isOption1)
                .accounts({
                    bettingQuestion: new PublicKey(questionData.betting.questionPda),
                    bettor: publicKey,
                    user: publicKey,
                    truthNetworkQuestion: new PublicKey(questionData.truth.id),
                    betProgram: bettingProgram.programId,
                    truthNetworkProgram: truthNetworkProgram.programId,
                    systemProgram: new PublicKey("11111111111111111111111111111111"),
                })
                .rpc();

            toast.success("Bet placed successfully!");
            console.log("Transaction:", tx);
        } catch (error) {
            console.error("Error placing bet:", error);
            toast.error("Failed to place bet.");
        }

        setLoading(false);
    };

    // Compute odds for progress bar
    const totalBets = Number(questionData.betting.totalBetsOption1) + Number(questionData.betting.totalBetsOption2);
    const option1Percentage = totalBets === 0 ? 50 : (Number(questionData.betting.totalBetsOption1) / totalBets) * 100;
    const option2Percentage = 100 - option1Percentage;

    return (
        <>  
            <div className="max-w-2xl mx-auto mt-10 p-6 border border-gray-600 rounded-lg shadow-lg bg-gray-900 text-white">
                {/* Title */}
                <h2 className="text-2xl font-bold text-gray-200">{questionData.betting.title}</h2>
                <p className="text-gray-400 mt-2"><strong>Status:</strong> {questionData.betting.status}</p>
                <p className="text-gray-300 mt-1"><strong>Options:</strong> {questionData.betting.option1} vs {questionData.betting.option2}</p>
                <p className="text-gray-400 mt-1"><strong>Truth-Network Question:</strong> {questionData.truth.questionText}</p>

                {/* Betting Form */}
                <div className="mt-4">
                    <input
                        type="number"
                        placeholder="Enter bet amount"
                        value={betAmount}
                        onChange={(e) => setBetAmount(e.target.value)}
                        className="w-full p-3 border border-gray-500 bg-gray-800 text-white rounded-md focus:outline-none focus:ring focus:ring-blue-500"
                    />
                    <div className="flex gap-4 mt-4">
                        <button
                            onClick={() => handleBet(true)}
                            disabled={loading}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition"
                        >
                            Bet on {questionData.betting.option1} ({option1Percentage.toFixed(2)}%)
                        </button>
                        <button
                            onClick={() => handleBet(false)}
                            disabled={loading}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition"
                        >
                            Bet on {questionData.betting.option2} ({option2Percentage.toFixed(2)}%)
                        </button>
                    </div>
                </div>

                {/* Betting Pool & Commissions */}
                <div className="mt-6 bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
                    <h3 className="text-lg font-semibold text-gray-300">Betting Pool</h3>
                    <p className="text-gray-400">Total Pool: <span className="text-green-400">{(questionData.betting.totalPool / 1_000_000_000).toFixed(2)} SOL</span></p>
                    <p className="text-gray-400">House Commission: <span className="text-yellow-400">{(questionData.betting.totalHouseCommission / 1_000_000_000).toFixed(2)} SOL</span></p>
                    <p className="text-gray-400">Creator Commission: <span className="text-blue-400">{(questionData.betting.totalCreatorCommission / 1_000_000_000).toFixed(2)} SOL</span></p>
                </div>

                {/* Betting Progress Bar */}
                <div className="mt-6 w-full bg-gray-700 rounded-full h-6 relative">
                    <div className="absolute left-0 top-0 h-full bg-green-500 rounded-l-full"
                        style={{ width: `${option1Percentage}%` }}>
                    </div>
                    <div className="absolute right-0 top-0 h-full bg-red-500 rounded-r-full"
                        style={{ width: `${option2Percentage}%` }}>
                    </div>
                </div>
                <p className="mt-2 text-gray-400 text-center">
                    Betting Odds: {questionData.betting.option1} {option1Percentage.toFixed(2)}% vs {questionData.betting.option2} {option2Percentage.toFixed(2)}%
                </p>
            </div>
        </>
    );
};

export default QuestionDetails;



