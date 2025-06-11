import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, web3, BN } from "@coral-xyz/anchor";
import { useNavigate } from "react-router-dom";
import { FaCheckCircle } from "react-icons/fa";
import { getTimeRemaining } from "../utils/getRemainingTime";
import { renderPagination } from "../utils/pagination";
import { getIdls } from "../idls";
import { getConstants } from "../constants";

const FetchQuestion = () => {
    const constants = getConstants();
    const { NETWORK_NAME, RPC_HELP_LINKS } = constants;
    const [dataFetched, setDataFetched] = useState(false);

    const BETTING_CONTRACT_PROGRAM_ID = constants.BETTING_CONTRACT_PROGRAM_ID;
    const TRUTH_NETWORK_PROGRAM_ID = constants.TRUTH_NETWORK_PROGRAM_ID;

    const { bettingIDL, truthNetworkIDL } = getIdls();
    const { publicKey, connected } = useWallet();
    const navigate = useNavigate();
    const [refreshingList, setRefreshingList] = useState(false);
    const [allQuestions, setAllQuestions] = useState([]);
    const [filter, setFilter] = useState("all");
    const [sortType, setSortType] = useState("closing"); // default is by closing date


    const [currentQuestions, setCurrentQuestions] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);


    const questionsPerPage = 12;
    const totalPages = Math.ceil(allQuestions.length / questionsPerPage);

    // Setup Provider & Programs
    const rpcUrl = constants.DEFAULT_RPC_URL;
    const connection = new web3.Connection(rpcUrl, "confirmed");
    
    
    // Dummy PublicKey for initialization
    const wallet = {
        publicKey: publicKey || new PublicKey("11111111111111111111111111111111") 
    };

    const provider = new AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
    const bettingProgram = new Program(bettingIDL, provider);
    const truthNetworkProgram = new Program(truthNetworkIDL, provider);

    const getData = () => {
        if (connected && publicKey) {
            fetchAllQuestionsWithUserInfo();
        } else {
            fetchAllQuestions();
        }
    };

    useEffect(() => {
        if(!connection) return;

        // Initial fetch on load
        getData();
    
        // Refresh events list after 5 minutes
        const intervalId = setInterval(() => {
            getData();
        }, 1 * 60 * 1000);
        
        // Cleanup on unmount
        return () => clearInterval(intervalId); 
    }, [connected, publicKey, filter, sortType]);

    const getBettorAccountPDA = async (userPubkey, questionId) => {
        return await PublicKey.findProgramAddress(
            [Buffer.from("bettor"), new PublicKey(userPubkey).toBuffer(), new PublicKey(questionId).toBuffer()],
            BETTING_CONTRACT_PROGRAM_ID
        );
    };

    const fetchAllQuestions = async (retried = false) => {
        //console.log("Fetching all Questions ============> ");

        const allRpcUrls = [
            ...(localStorage.getItem("customRpcUrl") ? [localStorage.getItem("customRpcUrl")] : []),
            ...constants.FALLBACK_RPC_URLS
        ];

        for (const rpcUrl of allRpcUrls) {

            if (rpcUrl == null) continue;

            try {
                setRefreshingList(true);

                const fallbackConnection = new web3.Connection(rpcUrl, "confirmed");
                const fallbackProvider = new AnchorProvider(fallbackConnection, wallet, { preflightCommitment: "processed" });
                const programToUse = new Program(bettingIDL, fallbackProvider);

                if (!programToUse.account?.bettingQuestion) {
                    console.warn("Skipping uninitialized program");
                    continue;
                }

                // Check if bettingProgram is initialized
                if (!programToUse.account?.bettingQuestion) {
                    console.error("Betting program account not initialized!");
                    return;
                }

                // Fetch all betting questions
                const accounts = await programToUse.account.bettingQuestion.all();
                //console.log("Fetched Betting Questions:", accounts);

                if (!accounts.length) {
                    console.warn("No betting questions found!");
                    setRefreshingList(false);
                    return;
                }

                // parse / format betting question details
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
                            
                            setRefreshingList(false)
                            return {
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
                    if (filter === "active") return q.closeDate > now;
                    if (filter === "closed") return q.closeDate <= now;
                    return true; // for "all"
                });

                const openQuestions = filteredQuestions
                    .filter(q => q && q.closeDate > now)
                const closedQuestions = filteredQuestions
                    .filter(q => q && q.closeDate <= now)

                // Apply sorting here
                const sortByClosingOpenEvent = (a, b) => a.closeDate - b.closeDate;
                const sortByClosingClosedEvent = (a, b) => b.closeDate - a.closeDate;
                const sortByBets = (a, b) => new BN(b.totalPool).cmp(new BN(a.totalPool));

                const sortedOpen = [...openQuestions].sort(sortType === "bets" ? sortByBets : sortByClosingOpenEvent);
                const sortedClosed = [...closedQuestions].sort(sortType === "bets" ? sortByBets : sortByClosingClosedEvent);

                const sortedQuestions = [...sortedOpen, ...sortedClosed];
                setAllQuestions(sortedQuestions);
                setDataFetched(true);
                return;
                
            } catch (error) {
                console.warn(`Error using RPC ${rpcUrl}:`, error.message);
                continue; // try next RPC
            } finally {
                setRefreshingList(false);
            }
        }


        // All RPCs failed
        const network = constants.NETWORK_NAME;
        const linksList = RPC_HELP_LINKS.map(link => ` ${link}`).join("\n");

        if (!dataFetched) {
            alert(
                `Failed to fetch events on ${network}.\n\nAll available RPCs failed.\n\nYou can set a custom RPC URL in "Network Settings".\nFree RPC providers:\n${linksList}`
            );
        }

    };


    const fetchAllQuestionsWithUserInfo = async (retried = false) => {
        //console.log("fetching all questions with user info ============>")
        const allRpcUrls = [
            ...(localStorage.getItem("customRpcUrl") ? [localStorage.getItem("customRpcUrl")] : []),
            ...constants.FALLBACK_RPC_URLS
        ];

        for (const rpcUrl of allRpcUrls) {
            try {
                setRefreshingList(true);

                const fallbackConnection = new web3.Connection(rpcUrl, "confirmed");
                const fallbackProvider = new AnchorProvider(fallbackConnection, wallet, { preflightCommitment: "processed" });
                const programToUse = new Program(bettingIDL, fallbackProvider);
        
                const accounts = await programToUse.account.bettingQuestion.all();
                const now = Math.floor(Date.now() / 1000);
        
                const questionsWithDetails = await Promise.all(
                    accounts.map(async (bettingQuestion) => {
                        const base = bettingQuestion.account;
                        const id = base.id.toBase58();
        
                        let hasBet = false;
                        let won = false;
                        let claimed = false;
        
                        try {
                            const [bettorPda] = await getBettorAccountPDA(publicKey.toBase58(), id);
                            const bettorAccount = await programToUse.account.bettorAccount.fetch(bettorPda);
                            hasBet = true;
                            won = bettorAccount.won;
                            claimed = bettorAccount.claimed;
                        } catch (e) {
                            // no bet or PDA not found
                            console.log("no bet of PDA not found")
                        }
        
                        return {
                            ...base,
                            id,
                            questionPda: base.questionPda.toBase58(),
                            totalPool: new BN(base.totalPool).toString(),
                            totalBetsOption1: new BN(base.totalBetsOption1).toString(),
                            totalBetsOption2: new BN(base.totalBetsOption2).toString(),
                            totalHouseCommision: new BN(base.totalHouseCommision).toString(),
                            totalCreatorCommission: new BN(base.totalCreatorCommission).toString(),
                            vault: base.vault.toBase58(),
                            closeDate: new BN(base.closeDate).toNumber(),
                            creator: base.creator.toString(),
                            hasBet,
                            won,
                            claimed,
                        };
                    })
                );
        
                const filteredQuestions = questionsWithDetails.filter((q) => {
                    if (!q) return false;
                    if (filter === "active") return q.closeDate > now;
                    if (filter === "closed") return q.closeDate <= now;
                    return true;
                });
        
                // sorting logic...
                const open = filteredQuestions.filter(q => q.closeDate > now);
                const closed = filteredQuestions.filter(q => q.closeDate <= now);
        
                const sortFn = sortType === "bets"
                    ? (a, b) => new BN(b.totalPool).cmp(new BN(a.totalPool))
                    : (a, b) => a.closeDate - b.closeDate;
        
                const sortedQuestions = [...open.sort(sortFn), ...closed.sort(sortFn)];
        
                setAllQuestions(sortedQuestions);
                setDataFetched(true);
                return;
                
            } catch (error) {
                console.warn(`Error using RPC ${rpcUrl}:`, error.message);
                continue; // try next RPC
            } finally {
                setRefreshingList(false);
            }
        }

        // All RPCs failed
        const network = constants.NETWORK_NAME;
        const linksList = RPC_HELP_LINKS.map(link => ` ${link}`).join("\n");

        if (!dataFetched) {
            alert(
                `Failed to fetch events on ${network}.\n\nAll available RPCs failed.\n\nYou can set a custom RPC URL in "Network Settings".\nFree RPC providers:\n${linksList}`
            );
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

    const sortButtons = () => {
        const baseClasses = "w-[120px] text-xs py-1.5 rounded !text-sm transition-colors";
    
        return (
            <div className="flex gap-3 align-items justify-center sm:justify-start">
                <span>Sort by: </span>
                <button
                    onClick={() => setSortType("closing")}
                    className={`${baseClasses} ${sortType === "closing" ? "!bg-purple-600 text-white" : "!bg-gray-700 hover:!bg-gray-600 text-gray-300"}`}
                >
                    Closing Date
                </button>
                <button
                    onClick={() => setSortType("bets")}
                    className={`${baseClasses} ${sortType === "bets" ? "!bg-purple-600 text-white" : "!bg-gray-700 hover:!bg-gray-600 text-gray-300"}`}
                >
                    Highest Bets
                </button>
            </div>
        );
    };
    

    const filterButtons = () => {
        const baseClasses = "w-[120px] text-xs py-1.5 rounded !text-sm transition-colors";
    
        return (
            <div className="flex gap-3 justify-center sm:justify-start">
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

            <h2 className="text-2xl font-bold text-gray-200">Events</h2>
            <p className="text-sm text-gray-400 mb-2">
                Note: Bets are resolved after community voting ends on the Truth.it Network (Commit + Reveal phases). 
                Each event's timeline is defined by its creator.
            </p>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                {filterButtons()}
                {sortButtons()}
            </div>

            {refreshingList && refreshingListLoader()}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {currentQuestions && currentQuestions.map((q, index) => {
                    const option1Bets = new BN(q.totalBetsOption1).toNumber();
                    const option2Bets = new BN(q.totalBetsOption2).toNumber();
                    const total = option1Bets + option2Bets;

                    const option1Pct = total > 0 ? (option1Bets / total) * 100 : 0;
                    const option2Pct = total > 0 ? (option2Bets / total) * 100 : 0;
                    
                    return (
                        <div
                            key={index}
                            onClick={() => navigate(`/question/${q.id.toString()}`, { state: q })}
                            className="p-4 bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer border border-gray-700 shadow-md transition-all"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <strong className="text-lg text-blue-400">
                                    {q.title}
                                </strong>
                            </div>

                            {q.hasBet && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md mb-2 bg-green-900 text-green-400 whitespace-nowrap">
                                    <FaCheckCircle className="text-green-400 text-sm" />
                                    Bet Placed
                                    {q.claimed && (
                                        <span className={`ml-1 ${q.won ? 'text-yellow-300' : 'text-red-400'}`}>
                                            ({q.won ? 'Won' : 'Lost'})
                                        </span>
                                    )}
                                </span>
                            )}

                            {/* Horizontal Bet Breakdown */}
                            <div className="mt-2 text-xs text-gray-300">
                                <div className="flex justify-between mb-1">
                                    <span>{q.option1} ({(option1Pct).toFixed(1)}%)</span>
                                    <span>{q.option2} ({(option2Pct).toFixed(1)}%)</span>
                                </div>
                                <div className="w-full h-3 bg-gray-700 rounded overflow-hidden">
                                    <div
                                        className="h-3 bg-green-500"
                                        style={{ width: `${option1Pct}%` }}
                                    />
                                </div>
                            </div>

                            {/* Time Remaining */}
                            <p className="text-sm mt-3">
                                <span
                                    className={
                                    q.closeDate <= Math.floor(Date.now() / 1000)
                                        ? "text-red-500"
                                        : "text-green-500"
                                    }
                                    title={new Date(Number(q.closeDate) * 1000).toLocaleString()}
                                >
                                    {getTimeRemaining(q.closeDate, Number(q.winner), Number(q.winningPercentage), q.houseCommissionClaimed)}
                                </span>
                            </p>

                            {/* PDA and Total Pool */}
                            <p className="text-gray-500 text-sm break-all mt-1">
                                PDA: {q.id.toString()}
                            </p>
                            <p className="text-gray-500 text-sm">
                                Total Bets: {(new BN(q.totalPool) / 1_000_000_000).toFixed(2)} SOL
                            </p>
                        </div>
                    );
                })}
            </div>


            {totalPages > 1 && renderPagination( currentPage, totalPages, setCurrentPage )}

        </div>
    );
};

export default FetchQuestion;
