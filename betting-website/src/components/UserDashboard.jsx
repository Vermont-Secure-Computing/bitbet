import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { BETTING_CONTRACT_PROGRAM_ID, bettingProgram, connection } from "../utils/solana";
import { program as truthProgram } from "../utils/truthProgram";
import { getQuestionStatus } from "../utils/eventStatus";

const UserDashboard = () => {
    const { publicKey } = useWallet();
    const [userBets, setUserBets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userBettorRecords, setUserBettorRecords] = useState(null);

    useEffect(() => {
        if (publicKey) fetchUserBets();
    }, [publicKey]);

    const fetchUserBets = async () => {
        setLoading(true);
        try {
            const bettorAccounts = await bettingProgram.account.bettorAccount.all([
                {
                memcmp: {
                    offset: 8,
                    bytes: publicKey.toBase58(),
                },
                },
            ]);

            const enriched = await Promise.all(
                bettorAccounts.map(async (bet) => {
                    console.log("bet: ", bet)
                    const bettorData = bet.account;
                    const questionPDA = bettorData.questionPda;

                    const bettingQuestion = await bettingProgram.account.bettingQuestion.fetch(questionPDA);

                    let truthNetworkQuestion = null;
                    try {
                        truthNetworkQuestion = await truthProgram.account.question.fetch(
                            bettingQuestion.questionPda
                        );
                    } catch (err) {
                        console.warn("Truth question not found or failed to load.");
                    }

                    return {
                        bettorPDA: bet.publicKey,
                        bettorData,
                        bettingQuestion,
                        truthNetworkQuestion,
                    };
                })
            );

            setUserBets(enriched);
        } catch (err) {
            console.error("Error fetching bettor accounts:", err);
        } finally {
            setLoading(false);
        }
    };


    const fetchBettorRecords = async () => {
        if (!publicKey || !bettingProgram) return;
    
        try {
            const allBettors = await bettingProgram.account.bettorAccount.all([
                {
                    memcmp: {
                        offset: 8, // Skip the 8-byte discriminator
                        bytes: publicKey.toBase58(),
                    },
                },
            ]);
    
            setUserBettorRecords(allBettors);
        } catch (err) {
            console.error("Failed to fetch bettor records:", err);
        }
    };

    useEffect(() => {
        fetchBettorRecords();
    }, [publicKey]);

    const deleteBettorRecord = async (bettorPda, bitbetPda) => {
        try {
            setDeleting(true);
            const dummyPDA = new PublicKey("11111111111111111111111111111111");
            const tx = await bettingProgram.methods
                .deleteBettorAccount()
                .accounts({
                    user: publicKey,
                    bettorAccount: bettorPda,
                    bettingQuestion: bitbetPda,
                    truthQuestion: dummyPDA,
                })
                .rpc();
                
                setLoadingDeleting(false);
            console.log("Bettor account deleted:", tx);
            toast.success("Bettor record deleted. Rent refunded!");
            
            // Fetch updated bettor data
            await fetchBettorData();
            
        } catch (err) {
            console.error("Failed to delete bettor account", err);
            toast.error("Failed to delete bettor record.");
            setLoadingDeleting(false);
        }
    };


    return (
        <div className="w-full min-h-screen bg-gray-900 text-white"> 
            <h2 className="text-3xl font-bold text-center text-white mb-8">My Bets</h2>

            {loading && <p className="text-white text-center">Loading your bets...</p>}
            {!loading && userBets.length === 0 && (
                <p className="text-gray-400 text-center">You haven't placed any bets yet.</p>
            )}

            <div className="container mx-auto px-4 md:px-8 py-10">
                <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                    {userBets.map(({ bettorPDA, bettorData, bettingQuestion, truthNetworkQuestion }) => {
                        const isOption1 = bettorData.chosenOption;
                        const questionTitle = bettingQuestion.title;
                        const betAmount = bettorData.betAmount / 1e9;
                        const isClaimed = bettorData.claimed;
                        const isOpen = bettingQuestion.status === "open";
                        
                        const winningPercent = truthNetworkQuestion?.winningPercent ?? 0;
                        const winningOption = truthNetworkQuestion?.winningOption ?? 0;
                        const hasWinner = truthNetworkQuestion?.finalized && winningPercent >= 75 ;

                        const userWon =
                            winningPercent >= 75 &&
                            ((winningOption === 1 && isOption1) || (winningOption === 2 && !isOption1));

                        const closeTimestamp = bettingQuestion.closeDate.toNumber?.() ?? bettingQuestion.closeDate;
                        const closeDate = new Date(closeTimestamp * 1000);
                        const timeRemaining =
                            isOpen && closeDate > new Date()
                            ? Math.floor((closeDate - new Date()) / 1000)
                            : null;

                        const getTimeRemainingLabel = () => {
                            if (!timeRemaining) return "";
                            const minutes = Math.floor(timeRemaining / 60);
                            const hours = Math.floor(minutes / 60);
                            const days = Math.floor(hours / 24);
                            if (days > 0) return `${days}d ${hours % 24}h left`;
                            if (hours > 0) return `${hours}h ${minutes % 60}m left`;
                            return `${minutes}m left`;
                        };

                        const status = getQuestionStatus({
                            closeDate: new Date(bettingQuestion.closeDate * 1000),
                            revealEndTime: truthNetworkQuestion.revealEndTime,
                            finalized: truthNetworkQuestion.finalized,
                            truthNetworkWinner: truthNetworkQuestion.winningOption,
                            winningPercentage: truthNetworkQuestion.winningPercent,
                            bettorData,
                            bettingQuestion
                        })

                        return (
                            <Link
                                key={bettorPDA.toBase58()}
                                to={`/question/${bettingQuestion.id.toBase58()}`}
                                className="bg-gray-800 hover:bg-gray-700 transition-all duration-150 p-5 rounded-2xl border border-gray-600 shadow-lg flex flex-col justify-between"
                            >
                                <h3 className="text-xl font-semibold text-white mb-2">{questionTitle}</h3>

                                <p className="text-sm text-gray-400 mb-1">
                                    You bet on:{" "}
                                    <span className="font-bold text-white">{isOption1 ? "True" : "False"}</span>{" "} · {betAmount} SOL
                                </p>

                                <p className="text-sm text-gray-400 mb-1">
                                    Status:{" "} 
                                    <span className={status?.className}>{status?.label}</span>
                                </p>

                                {isOpen && timeRemaining && (
                                    <p className="text-sm text-yellow-400 font-medium mb-1">Time left to bet: {getTimeRemainingLabel()}</p>
                                )}

                                {hasWinner && (
                                    <p className="text-sm text-green-400 mb-1">
                                        Winner:{" "}
                                        <span className="font-bold">{winningOption === 1 ? "True" : "False"} ({winningPercent.toFixed(2)}%)</span>
                                    </p>
                                )}

                                <p className="text-xs text-gray-500 mt-auto">
                                    Closes: {closeDate.toLocaleString()}
                                </p>

                            </Link>
                        );
                    })}
                </div>
            </div>

        </div>

    )
};

export default UserDashboard;
