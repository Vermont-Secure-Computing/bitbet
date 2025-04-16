import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, web3, BN } from "@coral-xyz/anchor";
import { useNavigate } from "react-router-dom";
import { FiLogIn } from "react-icons/fi";
import { toast } from "react-toastify";

import bettingIDL from "../idls/betting.json";
import truthNetworkIDL from "../idls/truth_network.json";

import { getTimeRemaining } from "../utils/getRemainingTime";
import { renderPagination } from "../utils/pagination";

const BETTING_CONTRACT_PROGRAM_ID = new PublicKey(import.meta.env.VITE_BETTING_PROGRAM_ID);
const TRUTH_NETWORK_PROGRAM_ID = new PublicKey(import.meta.env.VITE_TRUTH_PROGRAM_ID);


const FetchQuestion = () => {
    const { publicKey, connected } = useWallet();
    const navigate = useNavigate();
    const [refreshingList, setRefreshingList] = useState(false);
    const [allQuestions, setAllQuestions] = useState([]);
    const [filter, setFilter] = useState("all");

    const [currentQuestions, setCurrentQuestions] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);

    const questionsPerPage = 12;
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
        if (!connected) return;

        // Initial fetch on load
        fetchAllQuestions();
    
        // Refresh events list after 5 minutes
        const intervalId = setInterval(() => {
            fetchAllQuestions();
        }, 1 * 60 * 1000);
        
        // Cleanup on unmount
        return () => clearInterval(intervalId); 
    }, [connected, filter]);

    const fetchAllQuestions = async () => {
        console.log("Betting Program:", bettingProgram);
        console.log("Fetching Questions...");
        
        if (!publicKey) {
            alert("Please connect your wallet");
            return;
        }

        try {
            setRefreshingList(true);

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
                setRefreshingList(false);
                return;
            }

            // Fetch associated questions from the Truth Network
            const questionsWithDetails = await Promise.all(
                accounts.map(async (bettingQuestion) => {
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

                        setRefreshingList(false)
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

            const filteredQuestions = questionsWithDetails.filter((q) => {
                if (!q) return false;
                if (filter === "active") return q.betting.closeDate > now;
                if (filter === "closed") return q.betting.closeDate <= now;
                return true; // for "all"
            });

            const openQuestions = filteredQuestions
                .filter(q => q && q.betting.closeDate > now)
                .sort((a, b) => a.betting.closeDate - b.betting.closeDate);
            const closedQuestions = filteredQuestions
                .filter(q => q && q.betting.closeDate <= now)
                .sort((a, b) => b.betting.closeDate - a.betting.closeDate);

            const sortedQuestions = [...openQuestions, ...closedQuestions];
            console.log("sortedQuestions: ", sortedQuestions)
            setAllQuestions(sortedQuestions);

            
        } catch (error) {
            console.error("Error fetching questions:", error);
            alert("Failed to fetch questions.");
        } finally {
            setRefreshingList(false);
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


    const refreshingListLoader = () => {
        return (
            <div className="mt-4 flex items-center gap-2 text-sm text-blue-400">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a10 10 0 00-10 10h4z"></path>
                </svg>
                Refreshing questions list...
            </div>
        )
    }


    const filterButtons = () => {
        const baseClasses = "w-[120px] text-xs py-1.5 rounded !text-sm transition-colors";
    
        return (
            <div className="flex gap-3 my-4 justify-center sm:justify-start">
                <button
                    onClick={() => setFilter("all")}
                    className={`${baseClasses} ${filter === "all" ? "!bg-blue-600 text-white" : "!bg-gray-700 hover:!bg-gray-600 text-gray-300"}`}
                >
                    All
                </button>
                <button
                    onClick={() => setFilter("active")}
                    className={`${baseClasses} ${filter === "active" ? "!bg-green-600 text-white" : "!bg-gray-700 hover:!bg-gray-600 text-gray-300"}`}
                >
                    Active
                </button>
                <button
                    onClick={() => setFilter("closed")}
                    className={`${baseClasses} ${filter === "closed" ? "!bg-red-600 text-white" : "!bg-gray-700 hover:!bg-gray-600 text-gray-300"}`}
                >
                    Closed
                </button>
            </div>
        );
    };
    


    return (
        <div className="w-full flex-1 mt-6 p-4 sm:p-6 lg:p-8 border border-gray-600 rounded-lg shadow-lg bg-gray-900 text-white">

            <h2 className="text-2xl font-bold text-gray-200">All Events</h2>
            <p className="text-sm text-gray-400">Note: All bets are resolved two (2) days after betting close date.</p>

            {filterButtons()}

            {refreshingList && refreshingListLoader()}


            
            {publicKey ?
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {currentQuestions && currentQuestions.map((q, index) => (
                        <div
                            key={index}
                            onClick={() => navigate(`/question/${q.betting.id.toString()}`, { state: q })}
                            className="p-4 bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer border border-gray-700 shadow-md transition-all"
                        >
                            <strong className="text-lg text-blue-400">
                                {q.betting.title}
                                {q.hasBet && (
                                    <span className="text-green-400 text-xs bg-green-900 px-2 py-1 ml-2 rounded-md">
                                        Bet Placed
                                    </span>
                                )}
                            </strong>
                            <p className="text-sm">
                                <span className={q.betting.closeDate <= Math.floor(Date.now() / 1000)
                                    ? "text-red-500"
                                    : "text-green-500"}>
                                    {getTimeRemaining(q.betting.closeDate)}
                                </span>
                            </p>
                            <p className="text-gray-500 text-sm break-all">
                                PDA: {q.betting.id.toString()}
                            </p>
                            <p className="text-gray-500 text-sm">
                                Total Bets: {(new BN(q.betting.totalPool) / 1_000_000_000).toString()} SOL
                            </p>
                        </div>
                    ))}
                </div>

                :
                <div className="mt-6 p-4 bg-gray-800 border-l-4 border-yellow-500 text-yellow-300 rounded-md flex items-start gap-3">
                    <FiLogIn className="text-2xl mt-0.5" />
                    <div>
                        <p className="font-medium">Wallet not connected</p>
                        <p className="text-sm">Connect your wallet to load events and place bets.</p>
                    </div>
                </div>
            }

            {totalPages > 1 && renderPagination( currentPage, totalPages, setCurrentPage )}

        </div>
    );
};

export default FetchQuestion;
