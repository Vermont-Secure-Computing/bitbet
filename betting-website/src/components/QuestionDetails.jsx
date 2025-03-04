import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import bettingIDL from "../idls/betting.json";
import truthNetworkIDL from "../idls/truth_network.json";

const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");

const QuestionDetails = () => {
    // Get the passed question data from the state
    const location = useLocation();

    // Retrieve state data
    const questionData = location.state; 

    // Convert PublicKey back
    const bettingQuestionPDA = new PublicKey(questionData.betting.questionPda);
    const truthNetworkQuestionPDA = new PublicKey(questionData.truth.questionKey);

    // convert BN fields back
    const option1Odds = questionData.betting.option1Odds;
    const option2Odds = questionData.betting.option2Odds;
    const totalPool = questionData.betting.totalPool;
    const totalBetsOption1 = questionData.betting.totalBetsOption1;
    const totalBetsOption2 = questionData.betting.totalBetsOption2;

    console.log("totalPool: ", totalPool)
    console.log("totalBetsOption1: ", totalBetsOption1)
    console.log("totalBetsOption2: ", totalBetsOption2)


    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const walletAdapter = publicKey && signTransaction ? { 
        publicKey, 
        signTransaction, 
        signAllTransactions, 
        network: "devnet" 
    } : null;

    const provider = walletAdapter ? new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" }) : null;
    const bettingProgram = provider ? new Program(bettingIDL, provider) : null;
    const truthNetworkProgram = provider ? new Program(truthNetworkIDL, provider) : null;


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

            const betAmountLamports = new BN(parseFloat(betAmount) * 1_000_000_000);


            const BETTING_CONTRACT_PROGRAM_ID = new PublicKey(import.meta.env.VITE_BETTING_PROGRAM_ID);
            const [bettingQuestionPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("betting_question"),
                    BETTING_CONTRACT_PROGRAM_ID.toBuffer(), 
                    new PublicKey(questionData.truth.questionKey).toBuffer(), 
                ],
                BETTING_CONTRACT_PROGRAM_ID
            );

            console.log("Derived BettingQuestion PDA:", bettingQuestionPDA.toBase58());



            

            if (!bettingProgram) {
                console.error("Betting Program is NOT initialized!");
                return alert("Betting program is not ready. Try reloading the page.");
            }

            if (!truthNetworkProgram) {
                console.error("Truth network Program is NOT initialized!");
                return alert("Truth network program is not ready. Try reloading the page.");
            }
            
            const tx = await bettingProgram.methods
                .placeBet(betAmountLamports, isOption1)
                .accounts({
                    bettingQuestion: bettingQuestionPDA,
                    user: publicKey,
                    truthNetworkQuestion: new PublicKey(questionData.truth.questionKey),
                    betProgram: bettingProgram.programId,
                    truthNetworkProgram: truthNetworkProgram.programId,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();

                

            // Update UI (Re-fetch question details)
            // const betAmountBN = new BN(betAmountLamports);
            // const commissionRate = new BN(97);
            // questionData.betting.totalPool = betAmountBN.mul(commissionRate).div(new BN(100)); // 3% deducted for commissions
            // questionData.betting.totalHouseCommission += betAmountLamports * 0.01;
            // questionData.betting.totalCreatorCommission += betAmountLamports * 0.01;

            setBetAmount("");

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
                            className="flex-1 !bg-green-500 hover:!bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition"
                        >
                            Bet on {questionData.betting.option1} ({option1Odds}%)
                        </button>
                        <button
                            onClick={() => handleBet(false)}
                            disabled={loading}
                            className="flex-1 !bg-red-500 hover:!bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition"
                        >
                            Bet on {questionData.betting.option2} ({option2Odds}%)
                        </button>
                    </div>
                </div>

                {/* Betting Pool & Commissions */}
                <div className="mt-6 bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
                    <h3 className="text-lg font-semibold text-gray-300">Betting Pool</h3>
                    <p className="text-gray-400">
                        Total Pool: 
                        <span 
                            className="text-green-400">
                                {questionData.betting.totalPool ? (Number(questionData.betting.totalPool) / 1_000_000_000).toFixed(2) : 0} SOL
                        </span>
                    </p>
                    <p className="text-gray-400">
                        House Commission: 
                        <span className="text-yellow-400">
                            {questionData.betting.totalHouseCommision ? (Number(questionData.betting.totalHouseCommision) / 1_000_000_000).toFixed(2) : 0} SOL
                        </span>
                    </p>
                    <p className="text-gray-400">
                        Creator Commission: 
                        <span className="text-blue-400">
                            {questionData.betting.totalCreatorCommission ? (Number(questionData.betting.totalCreatorCommission) / 1_000_000_000).toFixed(2) : 0} SOL
                        </span>
                    </p>
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
                    Betting Odds: {questionData.betting.option1} {option1Percentage ? option1Percentage.toFixed(2) : 0}% vs {questionData.betting.option2} {option2Percentage ? option2Percentage.toFixed(2): 0}%
                </p>
            </div>
        </>
    );
};

export default QuestionDetails;



