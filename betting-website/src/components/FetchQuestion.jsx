import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, web3, BN } from "@coral-xyz/anchor";
import { useNavigate } from "react-router-dom";
import bettingIDL from "../idls/betting.json";
import truthNetworkIDL from "../idls/truth_network.json";

import { getTimeRemaining } from "../utils/getRemainingTime";
import { renderPagination } from "../utils/pagination";

const BETTING_CONTRACT_PROGRAM_ID = new PublicKey(import.meta.env.VITE_BETTING_PROGRAM_ID);
const TRUTH_NETWORK_PROGRAM_ID = new PublicKey(import.meta.env.VITE_TRUTH_PROGRAM_ID);


const FetchQuestion = () => {
    const { publicKey, connected } = useWallet();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [allQuestions, setAllQuestions] = useState([]);
    const [currentQuestions, setCurrentQuestions] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);

    const questionsPerPage = 10;
    const totalPages = Math.ceil(allQuestions.length / questionsPerPage);

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
                    const totalPool = new BN(bettingQuestion.account.totalPool);
                    const totalBetsOption1 = new BN(bettingQuestion.account.totalBetsOption1);
                    const totalBetsOption2 = new BN(bettingQuestion.account.totalBetsOption2);
                    const option1Odds = bettingQuestion.account.option1Odds
                    const option2Odds = bettingQuestion.account.option2Odds
                    const totalHouseCommission = new BN(bettingQuestion.account.totalHouseCommision);
                    const totalCreatorCommission = new BN(bettingQuestion.account.totalCreatorCommission);
                    const betClosing = new BN(bettingQuestion.account.closeDate);
                    const betCreator = bettingQuestion.account.creator.toString();

                    
                    try {
                        const truthQuestion = await truthNetworkProgram.account.question.fetch(
                            bettingQuestion.account.questionPda
                        );
                        
                        return {
                            betting: {
                                ...bettingQuestion.account,
                                id: bettingQuestion.account.id.toBase58(),
                                questionPda: bettingQuestion.account.questionPda.toBase58(),
                                totalPool: totalPool.toString(),
                                totalBetsOption1: totalBetsOption1.toString(),
                                totalBetsOption2: totalBetsOption2.toString(),
                                option1Odds: option1Odds,
                                option2Odds: option2Odds,
                                totalHouseCommision: totalHouseCommission.toString(),
                                totalCreatorCommission: totalCreatorCommission.toString(),
                                vault: bettingQuestion.account.vault.toBase58(),
                                closeDate: betClosing.toNumber(),
                                creator: betCreator
                            },
                            truth: {
                                ...truthQuestion,
                                questionKey: truthQuestion.questionKey.toBase58(),
                                vaultAddress: truthQuestion.vaultAddress.toBase58(),
                                id: truthQuestion.id.toString(),
                                revealEndTime: truthQuestion.revealEndTime.toNumber(),
                                winningOption: truthQuestion.winningOption === 1 ? true : (truthQuestion.winningOption === 2 ? false : null)
                            },
                        };
                    } catch (error) {
                        console.error("Error fetching Truth-Network question:", error);
                        return null;
                    }
                })
            );

            /***
             * Sort the questionsWithDetails from active to closed events
             * Active - sort open questions by soonest close date
             */
            const now = Math.floor(Date.now() / 1000);
            const openQuestions = questionsWithDetails
                .filter(q => q && q.betting.closeDate > now)
                .sort((a, b) => a.betting.closeDate - b.betting.closeDate);
            const closedQuestions = questionsWithDetails
                .filter(q => q && q.betting.closeDate <= now)
                .sort((a, b) => b.betting.closeDate - a.betting.closeDate);

            const sortedQuestions = [...openQuestions, ...closedQuestions];
            console.log("sortedQuestions: ", sortedQuestions)
            setAllQuestions(sortedQuestions);
        } catch (error) {
            console.error("Error fetching questions:", error);
            alert("Failed to fetch questions.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const startIndex = (currentPage - 1) * questionsPerPage;
        const pageSlice = allQuestions.slice(startIndex, startIndex + questionsPerPage);
        setCurrentQuestions(pageSlice);
    }, [currentPage, allQuestions]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentPage]);


    return (
        <div className="max-w-2xl mx-auto mt-10 p-6 border border-gray-600 rounded-lg shadow-lg bg-gray-900 text-white">
            <h2 className="text-2xl font-bold text-gray-200">All Events</h2>
            <p className="text-sm text-gray-400">Note: All bets are resolved two (2) days after betting close date.</p>
            {loading ? <p className="mt-4 text-gray-400">Loading...</p> : null}
            <ul className="mt-4 space-y-4">
                {currentQuestions && currentQuestions.map((q, index) => (
                    <li key={index} 
                        onClick={() => navigate(`/question/${q.betting.id.toString()}`, { state: q })}
                        className="p-4 bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer border border-gray-700 shadow-md"
                    >
                        <strong className="text-lg text-blue-400">
                            {q.betting.title}
                            {q.hasBet && <span className="text-green-400 text-xs bg-green-900 px-2 py-1 rounded-md">Bet Placed</span>}
                        </strong>
                        <p className="text-sm">
                            <span className={q.betting.closeDate <= Math.floor(Date.now() / 1000) ? "text-red-500" : "text-green-500"}>
                                {getTimeRemaining(q.betting.closeDate)}
                            </span>
                        </p>
                        <p className="text-gray-500 text-sm break-all">PDA: {q.betting.id.toString()}</p>
                        <p className="text-gray-500 text-sm">Total Bets: {(new BN(q.betting.totalPool)  / 1_000_000_000).toString()} SOL</p>
                    </li>
                ))}
            </ul>

            {totalPages > 1 && renderPagination( currentPage, totalPages, setCurrentPage )}

        </div>
    );
};

export default FetchQuestion;
