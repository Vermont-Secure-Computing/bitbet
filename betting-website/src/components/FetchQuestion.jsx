import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, web3, BN } from "@coral-xyz/anchor";
import { useNavigate } from "react-router-dom";
import { FaCheckCircle, FaCalendarAlt, FaDollarSign } from "react-icons/fa";
import { getTimeRemaining } from "../utils/getRemainingTime";
import { renderPagination } from "../utils/pagination";
import { getIdls } from "../idls";
import { getConstants } from "../constants";
import { Helmet } from "react-helmet";

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

    const fetchAllQuestions = async () => {
        let success = false;
        let lastError = null;
        const tried = [];
      
        const allRpcUrls = [
            ...(localStorage.getItem("customRpcUrl") ? [localStorage.getItem("customRpcUrl")] : []),
            ...constants.FALLBACK_RPC_URLS
        ];
      
        try {
            setRefreshingList(true);
        
            for (const rpcUrl of allRpcUrls) {
                if (!rpcUrl) continue;
                tried.push(rpcUrl);
        
                try {
                    const fallbackConnection = new web3.Connection(rpcUrl, "confirmed");
                    const fallbackProvider = new AnchorProvider(fallbackConnection, wallet, { preflightCommitment: "processed" });
                    const programToUse = new Program(bettingIDL, fallbackProvider);
            
                    if (!programToUse.account?.bettingQuestion) {
                        console.warn("Skipping uninitialized program");
                        continue;
                    }
            
                    const accounts = await programToUse.account.bettingQuestion.all();
            
                    if (!accounts.length) {
                        console.warn("No betting questions found!");
                        // This is a successful RPC call but empty dataset; decide whether you consider this “success”.
                        // I’ll treat it as success to avoid triggering the troubleshooter for an empty list.
                        setAllQuestions([]);
                        success = true;
                        break;
                    }
            
                    const questionsWithDetails = await Promise.all(
                        accounts.map(async (bettingQuestion) => {
                        try {
                            const totalPool = new BN(bettingQuestion.account.totalPool);
                            const totalBetsOption1 = new BN(bettingQuestion.account.totalBetsOption1);
                            const totalBetsOption2 = new BN(bettingQuestion.account.totalBetsOption2);
                            const option1Odds = bettingQuestion.account.option1Odds;
                            const option2Odds = bettingQuestion.account.option2Odds;
                            const totalHouseCommission = new BN(bettingQuestion.account.totalHouseCommision);
                            const totalCreatorCommission = new BN(bettingQuestion.account.totalCreatorCommission);
                            const betClosing = new BN(bettingQuestion.account.closeDate);
                            const betCreator = bettingQuestion.account.creator.toString();
            
                            return {
                            ...bettingQuestion.account,
                            id: bettingQuestion.account.id.toBase58(),
                            questionPda: bettingQuestion.account.questionPda.toBase58(),
                            totalPool: totalPool.toString(),
                            totalBetsOption1: totalBetsOption1.toString(),
                            totalBetsOption2: totalBetsOption2.toString(),
                            option1Odds,
                            option2Odds,
                            totalHouseCommision: totalHouseCommission.toString(),
                            totalCreatorCommission: totalCreatorCommission.toString(),
                            vault: bettingQuestion.account.vault.toBase58(),
                            closeDate: betClosing.toNumber(),
                            creator: betCreator
                            };
                        } catch (err) {
                            console.error("Error formatting question:", err);
                            return null;
                        }
                        })
                    );
            
                    const now = Math.floor(Date.now() / 1000);
                    const filtered = questionsWithDetails.filter(Boolean).filter((q) => {
                        if (filter === "active") return q.closeDate > now;
                        if (filter === "closed") return q.closeDate <= now;
                        return true;
                    });
            
                    const sortByClosingOpenEvent = (a, b) => a.closeDate - b.closeDate;
                    const sortByClosingClosedEvent = (a, b) => b.closeDate - a.closeDate;
                    const sortByBets = (a, b) => new BN(b.totalPool).cmp(new BN(a.totalPool));
            
                    const openQuestions = filtered.filter(q => q.closeDate > now);
                    const closedQuestions = filtered.filter(q => q.closeDate <= now);
            
                    const sortedOpen = [...openQuestions].sort(sortType === "bets" ? sortByBets : sortByClosingOpenEvent);
                    const sortedClosed = [...closedQuestions].sort(sortType === "bets" ? sortByBets : sortByClosingClosedEvent);
            
                    const sortedQuestions = [...sortedOpen, ...sortedClosed];

                    // Save the working RPC
                    localStorage.setItem("lastWorkingRpc", rpcUrl);
                    setAllQuestions(sortedQuestions);
            
                    // mark success and stop trying more RPCs
                    success = true;
                    break;
        
                } catch (err) {
                    console.warn(`Error using RPC ${rpcUrl}:`, err?.message || err);
                    lastError = err;
                    // keep looping to try the next RPC
                }
            }
        } finally {
            setRefreshingList(false);
        }
      
        // record success state
        setDataFetched(success);
      
        // Show troubleshooter ONLY if all RPCs failed:
        if (!success) {
            // Optional: clear the suppression to force-show while testing:
            // localStorage.removeItem("hideRpcTroubleshooterUntil");
        
            // Fire after a microtask to ensure App has mounted its event listener:
            setTimeout(() => {
                window.dispatchEvent(
                    new CustomEvent("open-rpc-troubleshooter", {
                        detail: {
                            reason: "fetch-question-failed",
                            triedUrls: tried,
                            lastError: lastError?.message || String(lastError || "Unknown error"),
                            networkName: constants.NETWORK_NAME
                        }
                    })
                );
            }, 0);
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
    
        return (
            <div className="flex gap-2 sm:gap-3">
                <button
                    onClick={() => setSortType("closing")}
                    className={`px-2 sm:px-3 py-1 rounded transition-colors flex items-center gap-1 ${
                        sortType === "closing"
                        ? "!bg-purple-600 text-white"
                        : "!bg-gray-700 hover:!bg-gray-600 text-gray-300"
                    }`}
                >
                    <FaCalendarAlt />
                    <span className="hidden sm:inline">Closing</span>
                </button>
                <button
                    onClick={() => setSortType("bets")}
                    className={`px-2 sm:px-3 py-1 rounded transition-colors flex items-center gap-1 ${
                        sortType === "bets"
                        ? "!bg-purple-600 text-white"
                        : "!bg-gray-700 hover:!bg-gray-600 text-gray-300"
                    }`}
                >
                    <FaDollarSign />
                    <span className="hidden sm:inline">Highest</span>
                </button>
            </div>
        );
    };
    

    const filterButtons = () => {
    
        return (
            <div className="flex flex-wrap gap-1 sm:gap-3">
                {["all", "active", "closed"].map((type) => (
                    <button
                        key={type}
                        onClick={() => setFilter(type)}
                        className={`px-2 sm:px-3 py-1 rounded transition-colors ${
                        filter === type
                            ? type === "all"
                            ? "!bg-blue-600 text-white"
                            : type === "active"
                            ? "!bg-green-600 text-white"
                            : "!bg-red-600 text-white"
                            : "!bg-gray-700 hover:!bg-gray-600 text-gray-300"
                        }`}
                    >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                ))}
            </div>
        );
    };
    


    return (
        <div className="w-full flex-1 mt-6 p-4 sm:p-6 lg:p-8 border border-gray-600 rounded-lg shadow-lg bg-gray-900 text-white">

            <Helmet>
                <meta property="og:title" content="SolBetX" />
                <meta property="og:description" content="Open Source No-Token Smart contract betting platform resolved by Truth.it network" />
                <meta property="og:image" content="https://solbetx.com/solbetx-preview.png" />
                <meta property="og:url" content="https://solbetx.com/" />
                <meta property="og:type" content="website" />

                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="SolBetX" />
                <meta name="twitter:description" content="Open Source No-Token Smart contract betting platform resolved by Truth.it network" />
                <meta name="twitter:image" content="https://solbetx.com/solbetx-preview.png" /> 
            </Helmet>

            <h2 className="text-2xl font-bold text-gray-200">Events</h2>
            <p className="text-sm text-gray-400 mb-2">
                Note: Bets are resolved after community voting ends on the Truth.it Network (Commit + Reveal phases). 
                Each event's timeline is defined by its creator.
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-between gap-y-2 gap-x-1 sm:gap-x-4 mb-4 text-sm">
                {/* Filter Buttons */}
                {filterButtons()}

                {/* Sort Buttons */}
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
