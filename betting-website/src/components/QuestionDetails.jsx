import React, { useState, useEffect, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import { toast, Bounce } from "react-toastify";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";

import bettingIDL from "../idls/betting.json";
import truthNetworkIDL from "../idls/truth_network.json";

const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");
const BETTING_CONTRACT_PROGRAM_ID = new PublicKey(import.meta.env.VITE_BETTING_PROGRAM_ID);

const QuestionDetails = () => {

    // Get the passed question data from the state
    const location = useLocation();
    // Retrieve state data
    const questionState = location.state; 
    const questionData = useMemo(() => questionState, [questionState]);
    console.log("question details: ", questionData)

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

    const [betAmount, setBetAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const [vaultBalance, setVaultBalance] = useState(0);
    const [truthVaultBalance, setTruthVaultBalance] = useState(0);
    const [bettorData, setBettorData] = useState(null);
    const [closeDate, setCloseDate] = useState(null)
    const [revealEndTime, setRevealEndTime] = useState(null)


    useEffect(() => {
        if (questionData?.betting?.vault && questionData?.truth?.vaultAddress) {
            fetchVaultBalance();
        }

        if (questionData?.betting?.closeDate) {
            const parsedCloseDate = new Date(questionData.betting.closeDate * 1000);
            setCloseDate(parsedCloseDate);
        }
    
        if (questionData?.truth?.revealEndTime) {
            const parsedRevealEndTime = new Date(questionData.truth.revealEndTime * 1000);
            
            setRevealEndTime(parsedRevealEndTime);
        }
    }, [questionData]);


    // Convert PublicKey back
    const bettingQuestionPDA = new PublicKey(questionData.betting.questionPda);
    const truthNetworkQuestionPDA = new PublicKey(questionData.truth.questionKey);

    // convert BN fields back
    const option1Odds = questionData.betting.option1Odds;
    const option2Odds = questionData.betting.option2Odds;
    const totalPool = questionData.betting.totalPool;
    const totalBetsOption1 = questionData.betting.totalBetsOption1;
    const totalBetsOption2 = questionData.betting.totalBetsOption2;

    const [bettingQuestion_PDA, setBettingQuestion_PDA] = useState(null);
    useEffect(() => {
        if (!questionData || !questionData.truth.questionKey) return;
    
        const [pda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("betting_question"),
                BETTING_CONTRACT_PROGRAM_ID.toBuffer(),
                new PublicKey(questionData.truth.questionKey).toBuffer(), 
            ],
            BETTING_CONTRACT_PROGRAM_ID
        );
    
        setBettingQuestion_PDA(pda);
        console.log("Derived BettingQuestion PDA:", pda.toBase58());
    }, [questionData]);

    //console.log("Derived BettingQuestion PDA:", bettingQuestionPDA.toBase58());


    if (!questionData) return <p>No question data available</p>;

    useEffect(() => {
        if (bettingQuestionPDA && publicKey && !bettorData) {
            console.log("Fetching Bettor Data...");
            fetchBettorData();
        }
    }, [bettingQuestionPDA, publicKey]);

    const fetchBettorData = async () => {
        console.log("Fetching Bettor Data");
        if (!publicKey) return;
        
        try {
            const [bettorPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("bettor"),
                    publicKey.toBuffer(),
                    bettingQuestion_PDA.toBuffer(),
                ],
                BETTING_CONTRACT_PROGRAM_ID
            );
    
            console.log("Fetching Bettor PDA:", bettorPda.toBase58());
    
            // Check if the account exists first
            const bettorAccountInfo = await connection.getAccountInfo(bettorPda);
            if (!bettorAccountInfo) {
                console.warn("Bettor account does NOT exist yet.");
                setBettorData(null);
                return;
            }
    
            // If the account exists, fetch it
            const bettorAccount = await bettingProgram.account.bettorAccount.fetch(bettorPda);
            console.log("Bettor Account:", bettorAccount);
            setBettorData(bettorAccount);
        } catch (error) {
            console.error("Error fetching bettor account:", error);
        }
    };
    


    const fetchVaultBalance = async () => {
        console.log("fetching vault balance")
        try {
            if (!questionData?.betting?.vault || !questionData?.truth?.vaultAddress) {
                console.warn("Vault data is missing. Skipping balance fetch.");
                return;
            }
    
            const bettingVaultPubKey = new PublicKey(questionData.betting.vault.toString());
            const truthVaultPubKey = new PublicKey(questionData.truth.vaultAddress.toString());
            console.log("bettinVault pubkey: ", bettingVaultPubKey)
    
            const bettingVaultLamports = await connection.getBalance(bettingVaultPubKey);
            const truthVaultLamports = await connection.getBalance(truthVaultPubKey);

            console.log("bettingVaultLamports: ", bettingVaultLamports)
            console.log("truthVaultLamports: ", truthVaultLamports)
    
            setVaultBalance(Number(new BN(bettingVaultLamports)) / 1_000_000_000);
            setTruthVaultBalance(Number(new BN(truthVaultLamports)) / 1_000_000_000);
        } catch (error) {
            console.error("Error fetching vault balance: ", error);
        }
    };
    

    const handleBet = async (isOption1) => {
        if (!publicKey) return toast.error("Please connect your wallet.");
        if (!betAmount || isNaN(betAmount) || betAmount <= 0) {
            return toast.error("Enter a valid bet amount.", { transition: Bounce });
        }

        setLoading(true);

        try {

            const betAmountLamports = new BN(parseFloat(betAmount) * 1_000_000_000);

            if (!bettingProgram) {
                console.error("Betting Program is NOT initialized!");
                return alert("Betting program is not ready. Try reloading the page.");
            }

            if (!truthNetworkProgram) {
                console.error("Truth network Program is NOT initialized!");
                return alert("Truth network program is not ready. Try reloading the page.");
            }
            console.log("bettingQuestion_pda: ", bettingQuestion_PDA.toString())
            const [vaultPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("bet_vault"),
                    bettingQuestion_PDA.toBuffer()
                ],
                bettingProgram.programId
            );

            console.log("Vault PDA: ", vaultPDA.toBase58());

            const [bettorPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("bettor"),
                    publicKey.toBuffer(),
                    bettingQuestion_PDA.toBuffer(),
                ],
                BETTING_CONTRACT_PROGRAM_ID
            );
            console.log("Derived Bettor PDA (Frontend):", bettorPda.toBase58());

            // Fetching Sysvar Rent account (Required for new accounts)
            const sysvarRent = web3.SYSVAR_RENT_PUBKEY;

            const tx = await bettingProgram.methods
                .placeBet(betAmountLamports, isOption1)
                .accounts({
                    bettingQuestion: bettingQuestion_PDA,
                    vault: vaultPDA,
                    user: publicKey,
                    bettorAccount: bettorPda,
                    truthNetworkQuestion: new PublicKey(questionData.truth.questionKey),
                    betProgram: bettingProgram.programId,
                    truthNetworkProgram: truthNetworkProgram.programId,
                    systemProgram: web3.SystemProgram.programId,
                    truthNetworkVault: new PublicKey(questionData.truth.vaultAddress),
                    rent: sysvarRent,
                })
                .rpc();

                

            // Update UI (Re-fetch question details)
            // const betAmountBN = new BN(betAmountLamports);
            // const commissionRate = new BN(97);
            // questionData.betting.totalPool = betAmountBN.mul(commissionRate).div(new BN(100)); // 3% deducted for commissions
            // questionData.betting.totalHouseCommission += betAmountLamports * 0.01;
            // questionData.betting.totalCreatorCommission += betAmountLamports * 0.01;

            setBetAmount("");

            toast.success("Bet placed successfully!", { transition: Bounce });
            console.log("Transaction:", tx);
        } catch (error) {
            console.error("Error placing bet:", error);
            toast.error("Failed to place bet.", { transition: Bounce });
        }

        setLoading(false);
    };

    const fetchWinner = async () => {
        if (!publicKey) return toast.error("Please connect your wallet.");

        // console.log("truth question id: ", questionData.truth.id)
        // console.log("betting question: ", questionData.betting.questionPda)
        // console.log("truthNetworkQuestion: ", questionData.truth.questionKey)
        // console.log("truthNetworkProgram: ", truthNetworkProgram.programId,)
        try {
            
            const tx = await bettingProgram.methods
                .fetchAndStoreWinner(new BN(questionData.truth.id))
                .accounts({
                    bettingQuestion: bettingQuestion_PDA,
                    truthNetworkQuestion: questionData.truth.questionKey,
                    truthNetworkProgram: truthNetworkProgram.programId,
                })
                .rpc();

            console.log("Winner fetched & winners determined:", tx);
            toast.success("Winner fetched & winnings calculated!", { transition: Bounce });

            // Fetch updated question details
            //await fetchQuestionDetails();
        } catch (error) {
            console.error("Error fetching winner & determining winners:", error);
            toast.error("Failed to fetch winner & calculate winnings.", { transition: Bounce });
        }
    };

    const claimWinnings = async () => {
        if (!publicKey) return toast.error("Please connect your wallet.");
        if (!bettorData) return toast.error("No bettor data found.");
        if (bettorData.claimed) return toast.info("Winnings already claimed.");
    
        setLoading(true);
    
        try {
            console.log("Claiming winnings...");
    
            const [bettorPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("bettor"),
                    publicKey.toBuffer(),
                    bettingQuestion_PDA.toBuffer(),
                ],
                BETTING_CONTRACT_PROGRAM_ID
            );
    
            console.log("Bettor PDA:", bettorPda.toBase58());
    
            const [vaultPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("bet_vault"),
                    bettingQuestion_PDA.toBuffer()
                ],
                bettingProgram.programId
            );
    
            console.log("Vault PDA:", vaultPDA.toBase58());
    
            const tx = await bettingProgram.methods
                .claimWinnings()
                .accounts({
                    bettingQuestion: bettingQuestion_PDA,
                    bettorAccount: bettorPda,
                    user: publicKey,
                    truthNetworkQuestion: new PublicKey(questionData.truth.questionKey),
                    vault: vaultPDA,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();
    
            console.log("Claim Winnings Transaction:", tx);
            toast.success("Winnings successfully claimed!");
    
            // Fetch updated bettor data
            await fetchBettorData();
        } catch (error) {
            console.error("Error claiming winnings:", error);
            toast.error("Failed to claim winnings.");
        }
    
        setLoading(false);
    };


    const claimCreatorCommission = async () => {
        if (!publicKey) {
            return toast.error("Please connect your wallet.");
        }
    
        setLoading(true);
    
        try {
            if (!bettingProgram) {
                console.error("Betting Program is NOT initialized!");
                return alert("Betting program is not ready. Try reloading the page.");
            }
            

            const [bettingQuestionPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("betting_question"),
                    BETTING_CONTRACT_PROGRAM_ID.toBuffer(), 
                    new PublicKey(questionData.truth.questionKey).toBuffer(), 
                ],
                BETTING_CONTRACT_PROGRAM_ID
            );
            console.log("Claiming Commission for Betting Question PDA:", bettingQuestionPDA.toBase58());
    
            const [vaultPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("bet_vault"),
                    bettingQuestionPDA.toBuffer()
                ],
                bettingProgram.programId
            );
    
            console.log("Vault PDA: ", vaultPDA.toBase58());
    
            const tx = await bettingProgram.methods
                .claimCreatorCommission()
                .accounts({
                    bettingQuestion: bettingQuestionPDA,
                    creator: publicKey,
                    vault: vaultPDA,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();
    
            console.log("Commission Claimed! Transaction:", tx);
            toast.success("Commission claimed successfully!");
    
        } catch (error) {
            console.error("Error claiming commission:", error);
            toast.error("Failed to claim commission.");
        }
    
        setLoading(false);
    };
    
    
    
    

    // Compute odds for progress bar
    const totalBets = Number(questionData.betting.totalBetsOption1) + Number(questionData.betting.totalBetsOption2);
    const option1Percentage = totalBets === 0 ? 50 : (Number(questionData.betting.totalBetsOption1) / totalBets) * 100;
    const option2Percentage = 100 - option1Percentage;

    // console.log("option 1 odds: ", questionData.betting.option1Odds)
    // console.log("is betting over: ", Date.now() / 1000 >= closeDate)
    // console.log("close date: ", closeDate)
    // console.log(revealEndTime)

    console.log("Question Data Truth Key:", questionData.truth.questionKey);
    console.log("Truth Network Program ID:", truthNetworkProgram.programId.toBase58());

    console.log("user address: ", publicKey?.toBase58())
    console.log("creator address: ", questionData.betting.creator)
    console.log("bet creator? : ", publicKey?.toBase58() === questionData.betting.creator)
    console.log("creator commission: ", questionData.betting.totalCreatorCommission)

    return (
        <div className="flex flex-col min-h-screen justify-center items-center bg-gray-900 text-white">  
            <Link to="/">Back to List</Link>
            <div className="w-full max-w-2xl mx-auto p-6 border border-gray-600 rounded-lg shadow-lg bg-gray-800">
                {/* Title */}
                <h2 className="text-2xl font-bold text-gray-200">{questionData.betting.title}</h2>
                <p className="text-gray-400 mt-2"><strong>Status:</strong> {closeDate && Date.now() / 1000 >= closeDate.getTime() / 1000 ? "Close" : "Open"}</p>
                <p className="text-gray-300 mt-1"><strong>Options:</strong> {questionData.betting.option1} vs {questionData.betting.option2}</p>
                <p className="text-gray-400 mt-1"><strong>Truth-Network Question:</strong> {questionData.truth.questionText}</p>

                {bettorData && bettorData.claimed && (
                    <p className="mt-2 text-green-400 font-bold">
                        Winnings Claimed!
                    </p>
                )}

                {bettorData && (
                    <div className="mt-6 bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
                        <p className="text-gray-300 mt-1">
                        <strong>You have placed your bet on: </strong>
                        {bettorData.chosenOption ? questionData.betting.option1 : questionData.betting.option2}
                        </p>
                        
                        <p className="text-gray-300 mt-1">
                        <strong>Bet Amount: </strong> 
                        {bettorData.betAmount && bettorData.betAmount.toNumber 
                            ? `${(bettorData.betAmount.toNumber() / 1_000_000_000).toFixed(2)} SOL`
                            : "Invalid Amount"}
                        </p>
                    </div>
                )}



                {/* // Betting Form
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
                            disabled={loading || (closeDate && Date.now() / 1000 >= closeDate.getTime() / 1000)}
                            className={`flex-1 font-bold py-2 px-4 rounded-lg transition 
                                ${loading || (closeDate && Date.now() / 1000 >= closeDate.getTime() / 1000) 
                                    ? "!bg-gray-500 cursor-not-allowed text-gray-300"
                                    : "!bg-green-500 hover:bg-green-600 text-white"
                                }`}
                        >
                            Bet on {questionData.betting.option1} (1: {option1Odds.toFixed(2)})
                        </button>
                        <button
                            onClick={() => handleBet(false)}
                            disabled={loading || (closeDate && Date.now() / 1000 >= closeDate.getTime() / 1000)}
                            className={`flex-1 font-bold py-2 px-4 rounded-lg transition 
                                ${loading || (closeDate && Date.now() / 1000 >= closeDate.getTime() / 1000) 
                                    ? "!bg-gray-500 cursor-not-allowed text-gray-300"
                                    : "!bg-red-500 hover:bg-red-600 text-white" 
                                }`}
                        >
                            Bet on {questionData.betting.option2} (1: {option2Odds.toFixed(2)})
                        </button>
                    </div>
                </div> */}
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
                        {/* Check if user already placed a bet */}
                        {!bettorData?.chosenOption ? (
                            // User hasn't placed a bet yet → Show both options
                            <>
                                <button
                                    onClick={() => handleBet(true)}
                                    disabled={loading || (closeDate && Date.now() / 1000 >= closeDate.getTime() / 1000)}
                                    className={`flex-1 font-bold py-2 px-4 rounded-lg transition 
                                        ${loading || (closeDate && Date.now() / 1000 >= closeDate.getTime() / 1000) 
                                            ? "!bg-gray-500 cursor-not-allowed text-gray-300"
                                            : "!bg-green-500 hover:bg-green-600 text-white"
                                        }`}
                                >
                                    Bet on {questionData.betting.option1} (1: {option1Odds.toFixed(2)})
                                </button>

                                <button
                                    onClick={() => handleBet(false)}
                                    disabled={loading || (closeDate && Date.now() / 1000 >= closeDate.getTime() / 1000)}
                                    className={`flex-1 font-bold py-2 px-4 rounded-lg transition 
                                        ${loading || (closeDate && Date.now() / 1000 >= closeDate.getTime() / 1000) 
                                            ? "!bg-gray-500 cursor-not-allowed text-gray-300"
                                            : "!bg-red-500 hover:bg-red-600 text-white"
                                        }`}
                                >
                                    Bet on {questionData.betting.option2} (1: {option2Odds.toFixed(2)})
                                </button>
                            </>
                        ) : (
                            // User already placed a bet → Show only their chosen option
                            <button
                                onClick={() => handleBet(bettorData.chosenOption)}
                                disabled={loading || (closeDate && Date.now() / 1000 >= closeDate.getTime() / 1000)}
                                className={`flex-1 font-bold py-2 px-4 rounded-lg transition 
                                    ${bettorData.chosenOption 
                                        ? "!bg-green-500 hover:bg-green-600 text-white"
                                        : "!bg-red-500 hover:bg-red-600 text-white"
                                    }`}
                            >
                                Add Bet on {bettorData.chosenOption ? questionData.betting.option1 : questionData.betting.option2} 
                                (1: {bettorData.chosenOption ? option1Odds.toFixed(2) : option2Odds.toFixed(2)})
                            </button>
                        )}
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
                    Betting Odds: {questionData.betting.option1} {questionData.betting.option1Odds ? option1Percentage.toFixed(2) : 0}% vs {questionData.betting.option2} {option2Percentage ? option2Percentage.toFixed(2): 0}%
                </p>

                <div className="mt-6 bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
                    <h3 className="text-lg font-semibold text-gray-300">Vault Balances</h3>
                    <p className="text-gray-400">Betting Vault Balance: <span className="text-green-400">{vaultBalance.toFixed(2)} SOL</span></p>
                    <p className="text-gray-400">Truth-Network Vault Balance: <span className="text-blue-400">{truthVaultBalance.toFixed(2)} SOL</span></p>
                </div>


                {revealEndTime && Date.now() / 1000 >= revealEndTime.getTime() / 1000 && !questionData.truth.finalized && (
                    <button
                        onClick={fetchWinner}
                        disabled={loading}
                        className="w-full mt-4 !bg-purple-500 hover:!bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition"
                    >
                        Get Result
                    </button>
                )}

                {bettorData && questionData.truth.winningOption !== null && bettorData.chosenOption === questionData.truth.winningOption && questionData.truth.winningPercent >= 75 && !bettorData.claimed && (
                    <button
                        onClick={claimWinnings}
                        disabled={loading}
                        className="w-full mt-4 !bg-yellow-500 hover:!bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition"
                    >
                        Claim Winnings
                    </button>
                )}

                {bettorData && questionData.truth.winningOption !== null && questionData.truth.winningPercent > 0 && questionData.truth.winningPercent < 75 && !bettorData.claimed && (
                    <button
                        onClick={claimWinnings}
                        disabled={loading}
                        className="w-full mt-4 !bg-yellow-500 hover:!bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition"
                    >
                        Refund Bet
                    </button>
                )}


                {closeDate && Date.now() / 1000 >= closeDate.getTime() / 1000 && publicKey?.toBase58() === questionData.betting.creator &&
                    questionData.betting.totalCreatorCommission > 0 &&
                    !questionData.betting.creatorCommissionClaimed && (
                        <button
                            onClick={claimCreatorCommission}
                            disabled={loading}
                            className="w-full mt-4 !bg-orange-500 hover:!bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition"
                        >
                            Claim Commission
                        </button>
                )}


                {questionData.truth.winningOption !== null && (
                    <>
                        <p className="text-gray-400 mt-1">
                            <strong>Winner:</strong> {questionData.truth.winningOption === true ? questionData.betting.option1 : questionData.betting.option2}
                        </p>
                        <p className="text-gray-400 mt-1">
                            <strong>Winning Percentage:</strong> {questionData.truth.winningPercent.toFixed(2)}%
                        </p>
                    </>
                )}
                
            </div>
        </div>
    );
};

export default QuestionDetails;



