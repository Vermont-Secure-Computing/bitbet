import React, { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import { toast, Bounce } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { FaRegCopy, FaTwitter, FaFacebookF, FaTelegramPlane } from "react-icons/fa";
import { FaSpinner, FaCheckCircle, FaTimesCircle, FaClock, FaExternalLinkAlt } from "react-icons/fa";
import { FiLogIn } from "react-icons/fi";
import BetChart from "./BetChart";
import { getConstants } from "../constants";
import { getIdls } from "../idls";
import { getTimeRemaining } from "../utils/getRemainingTime";

import { getQuestionStatus } from "../utils/eventStatus";
import { getTruthEventUrl } from "../utils/getTruthEventUrl";



const QuestionDetails = () => {
    const constants = getConstants();
    const location = useLocation();
    const passedQuestionData = location.state;
    //console.log("passedQuestionData: ", passedQuestionData)

    const rpcUrl = constants.DEFAULT_RPC_URL;
    const connection = new web3.Connection(rpcUrl, "confirmed");
    const BETTING_CONTRACT_PROGRAM_ID = constants.BETTING_CONTRACT_PROGRAM_ID;

    const navigate = useNavigate();
    const { bettingIDL, truthNetworkIDL } = getIdls();
    const [fetchingQuestionDetails, setFetchingQuestionDetails] = useState(false);
    //const { publicKey, connected, signTransaction, signAllTransactions } = useWallet();
    const wallet = useWallet();
    const { publicKey, connected, signTransaction, signAllTransactions } = wallet;
    //console.log("Wallet status:", publicKey?.toBase58(), connected);

    const [txSig, setTxSig] = useState(null);
    const [txStatus, setTxStatus] = useState(null);

    const dummyWallet = new PublicKey("11111111111111111111111111111111")
    const walletAdapter = useMemo(() => {
        return publicKey && signTransaction
            ? {
                publicKey,
                signTransaction,
                signAllTransactions,
                network: import.meta.env.VITE_NETWORK,
            }
            : {
                dummyWallet,
                signTransaction,
                signAllTransactions,
                network: import.meta.env.VITE_NETWORK,
            };
    }, [publicKey, signTransaction, signAllTransactions]);


    const provider = useMemo(() => {
        return walletAdapter
            ? new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" })
            : null;
    }, [walletAdapter]);

    const bettingProgram = useMemo(() => {
        return provider ? new Program(bettingIDL, provider) : null;
    }, [provider]);

    const truthNetworkProgram = useMemo(() => {
        return provider ? new Program(truthNetworkIDL, provider) : null;
    }, [provider]);



    const { questionPda } = useParams();
    const [questionData, setQuestionData] = useState(null);

    useEffect(() => {
        if (questionPda && !fetchingQuestionDetails) {
            //console.log("===== fetching question details ====")
            fetchQuestionDetails();
        }
    }, [questionPda, bettingProgram, truthNetworkProgram]);

    const fetchQuestionDetails = async () => {
        const { RPC_HELP_LINKS } = constants;
      
        let success = false;
        let lastError = null;
        const tried = [];
      
        const allRpcUrls = [
          ...(localStorage.getItem("customRpcUrl") ? [localStorage.getItem("customRpcUrl")] : []),
          ...constants.FALLBACK_RPC_URLS
        ];
      
        setFetchingQuestionDetails(true);
        try {
          for (const rpcUrl of allRpcUrls) {
            if (!rpcUrl) continue;
            tried.push(rpcUrl);
            console.log("============ trying rpc: ", rpcUrl);
      
            try {
              // Build connection/provider/programs for THIS rpcUrl
              const connection = new web3.Connection(rpcUrl, "confirmed");
              const provider = new AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
      
              // Recreate programs bound to this provider
              const bettingProg = new Program(bettingIDL, provider);
              const truthProg = new Program(truthNetworkIDL, provider);
      
              // Fetch data
              const bettingQuestion = await bettingProg.account.bettingQuestion.fetch(questionPda);
              const truthNetworkQuestion = await truthProg.account.question.fetch(bettingQuestion.questionPda);
      
              // Parse numbers
              const totalPool = new BN(bettingQuestion.totalPool);
              const totalBetsOption1 = new BN(bettingQuestion.totalBetsOption1);
              const totalBetsOption2 = new BN(bettingQuestion.totalBetsOption2);
              const option1Odds = bettingQuestion.option1Odds;
              const option2Odds = bettingQuestion.option2Odds;
              const totalHouseCommission = new BN(bettingQuestion.totalHouseCommision);
              const totalCreatorCommission = new BN(bettingQuestion.totalCreatorCommission);
              const betClosing = new BN(bettingQuestion.closeDate);
              const betCreator = bettingQuestion.creator.toString();
              const truthAsker = truthNetworkQuestion.asker.toString();
      
              // Save the working RPC
              localStorage.setItem("lastWorkingRpc", rpcUrl);
      
              setQuestionData({
                betting: {
                  ...bettingQuestion,
                  id: bettingQuestion.id.toBase58(),
                  questionPda: bettingQuestion.questionPda.toBase58(),
                  totalPool: totalPool.toString(),
                  totalBetsOption1: totalBetsOption1.toString(),
                  totalBetsOption2: totalBetsOption2.toString(),
                  option1Odds,
                  option2Odds,
                  totalHouseCommision: totalHouseCommission.toString(),
                  totalCreatorCommission: totalCreatorCommission.toString(),
                  vault: bettingQuestion.vault.toBase58(),
                  closeDate: betClosing.toNumber(),
                  creator: betCreator
                },
                truth: {
                  ...truthNetworkQuestion,
                  asker: truthAsker,
                  questionKey: truthNetworkQuestion.questionKey.toBase58(),
                  vaultAddress: truthNetworkQuestion.vaultAddress.toBase58(),
                  id: truthNetworkQuestion.id.toString(),
                  revealEndTime: truthNetworkQuestion.revealEndTime.toNumber(),
                  winningOption:
                    truthNetworkQuestion.winningOption === 1
                      ? true
                      : truthNetworkQuestion.winningOption === 2
                      ? false
                      : null,
                  winningPercent: truthNetworkQuestion.winningPercent,
                  committedVoters: truthNetworkQuestion.committedVoters.toNumber(),
                  votesOption1: truthNetworkQuestion.votesOption1.toNumber(),
                  votesOption2: truthNetworkQuestion.votesOption2.toNumber(),
                  voterRecordsCount: truthNetworkQuestion.voterRecordsCount.toNumber(),
                  voterRecordsClosed: truthNetworkQuestion.voterRecordsClosed.toNumber(),
                  totalDistributed: truthNetworkQuestion.totalDistributed.toNumber(),
                  originalReward: truthNetworkQuestion.originalReward.toNumber(),
                  snapshotReward: truthNetworkQuestion.snapshotReward.toNumber()
                }
              });
      
              success = true;
              break; // stop trying more RPCs
      
            } catch (err) {
              lastError = err;
              console.warn(`Error using RPC ${rpcUrl}:`, err?.message || err);
              // continue to next rpcUrl
            }
          }
        } finally {
          setFetchingQuestionDetails(false);
        }
      
        if (!success) {
          // Defer so App's event listener is definitely mounted
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
      
        // If you want to force-show the modal even on success (for testing), uncomment:
        // else {
        //   setTimeout(() => {
        //     window.dispatchEvent(
        //       new CustomEvent("open-rpc-troubleshooter", {
        //         detail: {
        //           reason: "forced-test",
        //           triedUrls: tried,
        //           networkName: constants.NETWORK_NAME
        //         }
        //       })
        //     );
        //   }, 0);
        // }
    };
      
    

    const [bettingQuestionPDA, setBettingQuestionPDA] = useState(null);
    const [truthNetworkQuestionPDA, setTruthNetworkQuestionPDA] = useState(null);
    const [betAmount, setBetAmount] = useState("");

    const [loading, setLoading] = useState(false);
    const [loadingWinnings, setLoadingWinnings] = useState(false);
    const [loadingCommission, setLoadingCommission] = useState(false);
    const [loadingDeleting, setLoadingDeleting] = useState(false);

    const [vaultBalance, setVaultBalance] = useState(0);
    const [truthVaultBalance, setTruthVaultBalance] = useState(0);
    const [bettorData, setBettorData] = useState(null);
    const [closeDate, setCloseDate] = useState(null)
    const [revealEndTime, setRevealEndTime] = useState(null)
    const [status, setStatus] = useState(null);

    const [canDeleteEvent, setCanDeleteEvent] = useState(false);


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

    useEffect(() => {
        //console.log("Fetching event status")
        if (!questionData) return;

        const getStatus = getQuestionStatus({
            closeDate: new Date(questionData.betting.closeDate * 1000),
            revealEndTime: questionData.truth.revealEndTime,
            finalized: questionData.truth.finalized,
            truthNetworkWinner: questionData.truth.winningOption,
            winningPercentage: questionData.truth.winningPercent,
            bettorData,
            bettingData: questionData.betting
        });

        setStatus(getStatus);
    }, [bettorData, questionData])


    useEffect(() => {
        if (!questionData) return;
      
        let bettingQuestionPDA = new PublicKey(questionData.betting.questionPda);
        let truthNetworkQuestionPDA = new PublicKey(questionData.truth.questionKey);

        setBettingQuestionPDA(bettingQuestionPDA);
        setTruthNetworkQuestionPDA(truthNetworkQuestionPDA);
      
      }, [questionData]);


    // convert BN fields back
    const option1Odds = questionData?.betting.option1Odds;
    const option2Odds = questionData?.betting.option2Odds;

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
    }, [questionData]);

    useEffect(() => {
        if (bettingQuestionPDA && publicKey && !bettorData) {
            fetchBettorData();
        }
    }, [bettingQuestionPDA, publicKey]);

    const fetchBettorData = async () => {
        if (!publicKey || !bettingQuestion_PDA) {
            console.warn("Missing publicKey or bettingQuestion_PDA");
            return;
        }
    
        try {
            const [bettorPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("bettor"),
                    publicKey.toBuffer(),
                    bettingQuestion_PDA.toBuffer(),
                ],
                BETTING_CONTRACT_PROGRAM_ID
            );
    
            // Check if the account exists first
            const bettorAccountInfo = await connection.getAccountInfo(bettorPda);
            if (!bettorAccountInfo) {
                console.warn("Bettor account does NOT exist yet.");
                setBettorData(null);
                return;
            }
    
            // If the account exists, fetch it
            const bettorAccount = await bettingProgram.account.bettorAccount.fetch(bettorPda);
            setBettorData(bettorAccount);
        } catch (error) {
            console.error("Error fetching bettor account:", error);
        }
    };
    


    const fetchVaultBalance = async () => {
        try {
            if (!questionData?.betting?.vault || !questionData?.truth?.vaultAddress) {
                console.warn("Vault data is missing. Skipping balance fetch.");
                return;
            }
    
            const bettingVaultPubKey = new PublicKey(questionData.betting.vault.toString());
            const truthVaultPubKey = new PublicKey(questionData.truth.vaultAddress.toString());
            const bettingVaultLamports = await connection.getBalance(bettingVaultPubKey);
            const truthVaultLamports = await connection.getBalance(truthVaultPubKey);
    
            setVaultBalance(Number(new BN(bettingVaultLamports)) / 1_000_000_000);
            setTruthVaultBalance(Number(new BN(truthVaultLamports)) / 1_000_000_000);
        } catch (error) {
            console.error("Error fetching vault balance: ", error);
        }
    };
    

    // const handleBet = async (isOption1) => {
    //     if (!publicKey) return toast.error("Please connect your wallet.");
        
    //     const parsedBet = parseFloat(betAmount);

    //     if (!parsedBet || isNaN(parsedBet) || parsedBet <= 0) {
    //         return toast.error("Enter a valid bet amount.", { transition: Bounce });
    //     }

    //     if (parsedBet < 0.01) {
    //         return toast.error("Minimum bet is 0.01 SOL.", { transition: Bounce });
    //     }


    //     setLoading(true);

    //     try {

    //         const betAmountLamports = new BN(parseFloat(betAmount) * 1_000_000_000);

    //         if (!bettingProgram) {
    //             console.error("Betting Program is NOT initialized!");
    //             return alert("Betting program is not ready. Try reloading the page.");
    //         }

    //         if (!truthNetworkProgram) {
    //             console.error("Truth network Program is NOT initialized!");
    //             return alert("Truth network program is not ready. Try reloading the page.");
    //         }
    //         //console.log("bettingQuestion_pda: ", bettingQuestion_PDA.toString())
    //         const [vaultPDA] = PublicKey.findProgramAddressSync(
    //             [
    //                 Buffer.from("bet_vault"),
    //                 bettingQuestion_PDA.toBuffer()
    //             ],
    //             bettingProgram.programId
    //         );

    //         const [bettorPda] = PublicKey.findProgramAddressSync(
    //             [
    //                 Buffer.from("bettor"),
    //                 publicKey.toBuffer(),
    //                 bettingQuestion_PDA.toBuffer(),
    //             ],
    //             BETTING_CONTRACT_PROGRAM_ID
    //         );

    //         // Fetching Sysvar Rent account (Required for new accounts)
    //         const sysvarRent = web3.SYSVAR_RENT_PUBKEY;

    //         const tx = await bettingProgram.methods
    //             .placeBet(betAmountLamports, isOption1)
    //             .accounts({
    //                 bettingQuestion: bettingQuestion_PDA,
    //                 vault: vaultPDA,
    //                 user: publicKey,
    //                 bettorAccount: bettorPda,
    //                 truthNetworkQuestion: new PublicKey(questionData.truth.questionKey),
    //                 betProgram: bettingProgram.programId,
    //                 truthNetworkProgram: truthNetworkProgram.programId,
    //                 systemProgram: web3.SystemProgram.programId,
    //                 truthNetworkVault: new PublicKey(questionData.truth.vaultAddress),
    //                 rent: sysvarRent,
    //             })
    //             .rpc();

    //         setTxSig(tx);
    //         setTxStatus("pending");
        
    //         const { value } = await connection.confirmTransaction(tx, "confirmed");
    //         if (value.err) {
    //             setTxStatus("failed");
    //         } else {
    //             setTxStatus("confirmed");
    //         }

    //         setBetAmount("");
            
    //         await fetchQuestionDetails();
    //         await fetchBettorData(); 
    //         await fetchVaultBalance();
    //         toast.success("Bet placed successfully!", { transition: Bounce });
    //     } catch (error) {
    //         console.error("Error placing bet:", error);
    //         toast.error("Failed to place bet.", { transition: Bounce });
    //     }

    //     setLoading(false);
    // };

    // ---------------- helpers ----------------

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const waitForSig = async (connection, sig, timeoutMs = 60_000) => {
        const start = Date.now();
        let lastStatus = null;

        while (Date.now() - start < timeoutMs) {
            const { value } = await connection.getSignatureStatuses([sig], {
                searchTransactionHistory: true,
            });
            console.log("waitForSig value ===========> ", value)
            const st = value && value[0];
            console.log("st ========> ", st)
            if (st) {
                lastStatus = st;
                if (st.err) {
                    const e = new Error("Transaction failed on-chain");
                    e.status = st;
                    throw e;
                }
                
                if (
                    st.confirmations === null ||
                    st.confirmationStatus === "confirmed" ||
                    st.confirmationStatus === "finalized"
                ) {
                    return st;
                }
            }
            await sleep(1200);
        }

        const e = new Error("Confirmation timeout");
        e.status = lastStatus;
        throw e;
    };

    const fetchFailureDetails = (connection, sig) =>
        connection.getTransaction(sig, {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed",
        });

    const parseAnchorLogHint = (logs = []) => {
        const anchor = logs.find((l) => l.includes("AnchorError"));
        if (anchor) return anchor;
        const generic = logs.find(
            (l) =>
            l.includes("Program failed to complete") ||
            l.includes("custom program error")
        );
        return anchor || generic || null;
    };

    const isTransientRpcError = (err) => {
        const m = String(err?.message || "").toLowerCase();
        return (
            m.includes("blockhash not found") ||
            m.includes("node is behind") ||
            m.includes("too many requests") ||
            m.includes("rate limit") ||
            m.includes("unavailable") ||
            m.includes("timeout")
        );
    };

    const handleBet = async (isOption1) => {
        console.log("updated handle bet")
        if (!publicKey) return toast.error("Please connect your wallet.");

        const parsedBet = parseFloat(betAmount);
        if (!parsedBet || isNaN(parsedBet) || parsedBet <= 0) {
            return toast.error("Enter a valid bet amount.", { transition: Bounce });
        }
        if (parsedBet < 0.01) {
            return toast.error("Minimum bet is 0.01 SOL.", { transition: Bounce });
        }

        setLoading(true);
        setTxSig(undefined);
        setTxStatus(undefined);

        try {
            if (!bettingProgram) {
                setLoading(false);
                return toast.error("Betting program is not ready. Try reloading the page.", { transition: Bounce });
            }
            if (!truthNetworkProgram) {
                setLoading(false);
                return toast.error("Truth network program is not ready. Try reloading the page.", { transition: Bounce });
            }

            const betAmountLamports = new BN(Math.round(parsedBet * 1_000_000_000));

            // PDAs
            const [vaultPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("bet_vault"), bettingQuestion_PDA.toBuffer()],
                bettingProgram.programId
            );
            const [bettorPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("bettor"), publicKey.toBuffer(), bettingQuestion_PDA.toBuffer()],
                BETTING_CONTRACT_PROGRAM_ID
            );

            // ---------- 1) Pre-simulate via Anchor ----------
            try {
                await bettingProgram.methods
                    .placeBet(betAmountLamports, isOption1)
                    .accounts({
                        bettingQuestion: bettingQuestion_PDA,
                        vault: vaultPDA,
                        user: publicKey,
                        bettorAccount: bettorPda,
                        truthNetworkQuestion: new PublicKey(questionData.truth.questionKey),
                        betProgram: bettingProgram.programId,
                        truthNetworkProgram: truthNetworkProgram.programId,
                        systemProgram: SystemProgram.programId,
                        truthNetworkVault: new PublicKey(questionData.truth.vaultAddress),
                        rent: PublicKey.default,
                    })
                    .simulate();
            } catch (simErr) {
                console.error("Simulation error:", simErr);
                const hint =
                    parseAnchorLogHint(simErr?.logs || simErr?.error?.logs || []) ||
                    simErr?.message ||
                    "Transaction simulation failed.";
                setLoading(false);
                return toast.error(hint, { transition: Bounce });
            }

            // ---------- 2) Build the instruction ----------
            const ix = await bettingProgram.methods
            .placeBet(betAmountLamports, isOption1)
            .accounts({
                bettingQuestion: bettingQuestion_PDA,
                vault: vaultPDA,
                user: publicKey,
                bettorAccount: bettorPda,
                truthNetworkQuestion: new PublicKey(questionData.truth.questionKey),
                betProgram: bettingProgram.programId,
                truthNetworkProgram: truthNetworkProgram.programId,
                systemProgram: SystemProgram.programId,
                truthNetworkVault: new PublicKey(questionData.truth.vaultAddress),
                rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
            })
            .instruction();

            // ---------- 3) Send & confirm robustly ----------
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

            const tx = new Transaction({
                feePayer: publicKey,
                recentBlockhash: blockhash,
            }).add(ix);

            let signature;
            try {
                signature = await wallet.sendTransaction(tx, connection);
            } catch (sendErr) {
                console.error("sendTransaction error:", sendErr);
                if (isTransientRpcError(sendErr)) {
                    setLoading(false);
                    return toast.info(
                    "Your bet is being processed. Network is busy; we'll check the status shortly.",
                    { transition: Bounce }
                    );
                }
                setLoading(false);
                return toast.error(sendErr?.message || "Failed to send transaction.", { transition: Bounce });
            }

            setTxSig(signature);
            setTxStatus("pending");

            // Try fast confirm (non-fatal if it throws)
            try {
                await connection.confirmTransaction(
                    { signature, blockhash, lastValidBlockHeight },
                    "confirmed"
                );
            } catch (confErr) {
                console.warn("confirmTransaction threw (non-definitive):", confErr);
            }

            // Poll until definitive (handles public RPC lag)
            try {
                await waitForSig(connection, signature, 60_000);
                setTxStatus("confirmed");
                setBetAmount("");

                await Promise.allSettled([
                    fetchQuestionDetails(),
                    fetchBettorData(),
                    fetchVaultBalance(),
                ]);

                toast.success("Bet placed successfully!", { transition: Bounce });
            } catch (pollErr) {
                // See if chain says it failed
                const { value } = await connection.getSignatureStatuses([signature], {
                    searchTransactionHistory: true,
                });
                const finalSt = value && value[0];

                if (finalSt && finalSt.err) {
                    setTxStatus("failed");
                    const txInfo = await fetchFailureDetails(connection, signature);
                    const hint = parseAnchorLogHint(txInfo?.meta?.logMessages || []);
                    console.error("On-chain failure:", finalSt.err, txInfo?.meta?.logMessages);
                    toast.error(
                    hint ? `Bet failed: ${hint}` : "Bet failed on-chain. Please check balance and try again.",
                    { transition: Bounce }
                    );
                } else {
                    setTxStatus("pending");
                    await Promise.allSettled([
                    fetchQuestionDetails(),
                    fetchBettorData(),
                    fetchVaultBalance(),
                    ]);
                    toast.info("Bet submitted. Network is catching up; your balance may update shortly.", {
                    transition: Bounce,
                    });
                }
            }
        } catch (e) {
            console.error("Error placing bet:", e);
            toast.error(e?.message || "Failed to place bet.", { transition: Bounce });
            setTxStatus((prev) => prev || "failed");
        } finally {
            setLoading(false);
        }
    };


    const fetchWinner = async () => {
        if (!publicKey) return toast.error("Please connect your wallet.");
        setLoading(true)
        try {
            
            const tx = await bettingProgram.methods
                .fetchAndStoreWinner(new BN(questionData.truth.id))
                .accounts({
                    bettingQuestion: bettingQuestion_PDA,
                    truthNetworkQuestion: questionData.truth.questionKey,
                    truthNetworkProgram: truthNetworkProgram.programId,
                })
                .rpc();

            toast.success("Winner fetched & winnings calculated!", { transition: Bounce });

            await fetchQuestionDetails();
            await fetchBettorData(); 
        } catch (error) {
            setLoading(true)
            console.error("Error fetching winner & determining winners:", error);
            toast.error("Failed to fetch winner & calculate winnings.", { transition: Bounce });
        }
    };

    const claimWinnings = async () => {
        if (!publicKey) return toast.error("Please connect your wallet.");
        if (!bettorData) return toast.error("No bettor data found.");
        if (bettorData.claimed) return toast.info("Winnings already claimed.");
    
        setLoadingWinnings(true);
    
        try {
    
            const [bettorPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("bettor"),
                    publicKey.toBuffer(),
                    bettingQuestion_PDA.toBuffer(),
                ],
                BETTING_CONTRACT_PROGRAM_ID
            );
    
            const [vaultPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("bet_vault"),
                    bettingQuestion_PDA.toBuffer()
                ],
                bettingProgram.programId
            );
    
            //console.log("Vault PDA:", vaultPDA.toBase58());
    
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
            

            await bettingProgram.methods
                .setClaimTxId(tx)
                .accounts({
                    bettorAccount: bettorPda,
                    bettorAddress: publicKey,
                })
                .rpc();

            toast.success("Winnings successfully claimed!");
    
            // Fetch updated bettor data
            await fetchBettorData();
            await fetchVaultBalance();
            setLoadingWinnings(false);
        } catch (error) {
            console.error("Error claiming winnings:", error);
            toast.error("Failed to claim winnings.");
        }
    
        setLoadingWinnings(false);
    };


    const claimCreatorCommission = async () => {
        if (!publicKey) {
            return toast.error("Please connect your wallet.");
        }
    
        setLoadingCommission(true);
    
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

            // Fetch updated bettor data
            await fetchBettorData();
            await fetchVaultBalance();
            await fetchQuestionDetails();

            toast.success("Commission claimed successfully!");
    
        } catch (error) {
            console.error("Error claiming commission:", error);
            toast.error("Failed to claim commission.");
        }
    
        setLoadingCommission(false);
    };


    const deleteBettorAccount = async () => {
        try {
            setLoadingDeleting(true);
            const [bettorPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("bettor"),
                    publicKey.toBuffer(),
                    bettingQuestion_PDA.toBuffer(),
                ],
                BETTING_CONTRACT_PROGRAM_ID
            );

            const tx = await bettingProgram.methods
                .deleteBettorAccount()
                .accounts({
                    user: publicKey,
                    bettorAccount: bettorPda,
                    bettingQuestion: bettingQuestion_PDA,
                    truthQuestion: truthNetworkQuestionPDA,
                })
                .rpc();
                
                setLoadingDeleting(false);
            toast.success("Bettor record deleted. Rent refunded!");
            
            // Fetch updated bettor data
            await fetchBettorData();
            
        } catch (err) {
            console.error("Failed to delete bettor account", err);
            toast.error("Failed to delete bettor record.");
            setLoadingDeleting(false);
        }
    };


    //const canDeleteEvent = useCanDeleteEvent(questionData, publicKey, connection);
    useEffect(() => {
        const checkCanDelete = async () => {
            if (!questionData || !questionData.truth || !questionData.betting) return;

            const now = Math.floor(Date.now() / 1000);


            /**
             * Truth-network validation
             */
            const isFinalized = questionData.truth.finalized;
            const revealEnded = questionData.truth.revealEndTime <= Date.now() / 1000;
            const truthVaultPubkey = new PublicKey(questionData.truth.vaultAddress);
            const truthVaultAccountInfo = await connection.getAccountInfo(truthVaultPubkey);
            const truthRentExemption = await connection.getMinimumBalanceForRentExemption(8);
            const truthVaultBalance = truthVaultAccountInfo?.lamports ?? 0;

            const vaultOnlyHasRent = (truthVaultBalance - truthRentExemption) < 1000;

            
            /**
             * Bitbet validation
             */
            const vaultAddress = new PublicKey(questionData.betting.vault);
            const vaultInfo = await connection.getAccountInfo(vaultAddress);
            const vaultLamports = vaultInfo?.lamports || 0;
            const minRent = await connection.getMinimumBalanceForRentExemption(0);

            let hasBettorRecord = true;

            if (!publicKey || !bettingQuestion_PDA) {
                console.warn("Wallet or question PDA not available.");
                hasBettorRecord = false;
            } else {
                try {
                    const [bettorPda] = PublicKey.findProgramAddressSync(
                        [
                            Buffer.from("bettor"),
                            publicKey.toBuffer(),
                            bettingQuestion_PDA.toBuffer(),
                        ],
                        BETTING_CONTRACT_PROGRAM_ID
                    );
            
                    const bettorAccountInfo = await connection.getAccountInfo(bettorPda);
                    hasBettorRecord = !!bettorAccountInfo;
            
                    console.log("Has bettor record:", hasBettorRecord);
                } catch (err) {
                    console.warn("Error checking bettor record:", err);
                    hasBettorRecord = false;
                }
            }
            
            console.log("truth network validation")
            console.log("isFinalized: ", isFinalized)
            console.log("vault lamports: ", vaultLamports)
            console.log("vault lamports check: ", vaultLamports - minRent < 1000)
            console.log("minRent: ", minRent)
            console.log("revealEnded: ", revealEnded)
            console.log("truthVaultBalance: ", truthVaultBalance)
            console.log("truthRentExemption: ", truthRentExemption)
            console.log("vaultOnlyHasRent: ", vaultOnlyHasRent)
            console.log("asker: ", questionData.truth.asker)
            console.log("truth creator: ", publicKey?.toBase58() === questionData.truth.asker)
            console.log("other check: ", (questionData.truth.committedVoters === 0 || (questionData.truth.voterRecordsCount === 0 || questionData.truth.voterRecordsClosed === questionData.truth.voterRecordsCount) &&(questionData.truth.totalDistributed >= questionData.truth.snapshotReward || questionData.truth.originalReward === 0)))


            if (
                isFinalized &&
                vaultLamports - minRent < 1000 &&
                publicKey?.toBase58() === questionData.betting.creator &&
                !hasBettorRecord &&
                publicKey?.toBase58() === questionData.truth.asker &&
                revealEnded &&
                vaultOnlyHasRent &&
                (
                    // Allow delete if either:
                    // no one committed
                    questionData.truth.committedVoters === 0 ||
                    // all rent + rewards are cleaned
                    (
                        questionData.truth.voterRecordsCount === 0 || questionData.truth.voterRecordsClosed === questionData.truth.voterRecordsCount
                    ) &&
                    (
                        questionData.truth.totalDistributed >= questionData.truth.snapshotReward || questionData.truth.originalReward === 0
                    )                
                )
            ) {
                console.log("user can delete the event")
                setCanDeleteEvent(true);
            }else{
                console.log("user cannot delete the event")
                setCanDeleteEvent(false);
            }
        };

        checkCanDelete();
    }, [questionData, publicKey]);

    const deleteEvent = async () => {
        if (!publicKey) return toast.error("Connect wallet first");
    
        try {
            setLoading(true);
    
            const tx = await bettingProgram.methods
                .deleteEvent()
                .accounts({
                    bettingQuestion: new PublicKey(questionData.betting.id),
                    vault: new PublicKey(questionData.betting.vault),
                    user: publicKey,
                    truthQuestion: new PublicKey(questionData.truth.questionKey),
                    truthVault: new PublicKey(questionData.truth.vaultAddress),
                    systemProgram: web3.SystemProgram.programId,
                    truthNetworkProgram: truthNetworkProgram.programId
                })
                .rpc();
    
            toast.success("Event deleted successfully!");
            await fetch(`https://solbetx.com/api/event/${questionData.betting.id.toString()}`, {
                method: "DELETE"
            });
            navigate("/"); 
        } catch (err) {
            console.error("Failed to delete event:", err);
            toast.error("Error deleting event.");
        } finally {
            setLoading(false);
        }
    };


    const sharingComponent = () => {
        return (
            <div className="mt-1 flex flex-col gap-1 text-sm text-gray-500">
    
            {/* Copy to clipboard */}
            <div
                className="flex items-center gap-1 cursor-pointer hover:underline"
                onClick={() => {
                    const eventUrl = `${window.location.origin}/question/${questionData?.betting.id}`;
                    navigator.clipboard.writeText(eventUrl);
                    toast.success("Event link copied to clipboard!");
                }}
            >
                <FaRegCopy className="w-4 h-4" />
                Copy event link
            </div>

            {/* Social sharing buttons */}
            <div className="flex items-center gap-3 mt-1">
                {/* Twitter */}
                <a
                    href={`https://twitter.com/intent/tweet?text=Check out this event!&url=${encodeURIComponent(`${window.location.origin}/share/${questionData?.betting.id}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600"
                    title="Share on Twitter"
                >
                    <FaTwitter className="w-4 h-4" />
                </a>

                {/* Facebook */}
                <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/share/${questionData?.betting.id}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:text-blue-800"
                    title="Share on Facebook"
                >
                    <FaFacebookF className="w-4 h-4" />
                </a>

                {/* Telegram */}
                <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(`${window.location.origin}/share/${questionData?.betting.id}`)}&text=Bitbet - Check out this event!`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-500 hover:text-sky-600"
                    title="Share on Telegram"
                >
                    <FaTelegramPlane className="w-4 h-4" />
                </a>
            </div>
        </div>
        )
    }

    console.log("question data: ", questionData)
    // console.log("bettor data: ", bettorData)
    
    // console.log("show delete event button: ", canDeleteEvent)

    // console.log("is creator: ", publicKey?.toBase58() === questionData?.betting.creator)
    // console.log("is finalized: ", questionData?.truth.finalized)
    // console.log("creator commission claime: ", publicKey?.toBase58() !== questionData?.betting.creator)
    

    // Compute odds for progress bar
    
    const totalBets = Number(questionData?.betting.totalBetsOption1) + Number(questionData?.betting.totalBetsOption2);
    const option1Percentage = totalBets === 0 ? 50 : (Number(questionData?.betting.totalBetsOption1) / totalBets) * 100;
    const option2Percentage = 100 - option1Percentage;

    return (
        <div className="flex flex-col min-h-screen justify-center pb-4 items-center bg-gray-900 text-white">  
            <Link to="/">Back to List</Link>      

            <div className="w-full max-w-2xl mx-auto p-6 border border-gray-600 rounded-lg shadow-lg bg-gray-800">
                
                {!publicKey && 
                    <div className="mt-6 mb-6 p-4 bg-gray-800 border-l-4 border-yellow-500 text-yellow-300 rounded-md flex items-start gap-3">
                        <FiLogIn className="text-2xl mt-0.5" />
                        <div>
                            <p className="font-medium">Wallet not connected</p>
                            <p className="text-sm">Connect your wallet to interact with this event (bet, claim winnings, etc.).</p>
                        </div>
                    </div>
                }

                <h2 className="text-2xl font-bold text-gray-200">{questionData?.betting.title}</h2>
                {sharingComponent()}
                
                <p className="text-gray-400 mt-2">
                    <strong>Status:</strong>{" "}
                    <span className={status?.className}>{status?.label}</span>
                </p>

                {bettorData && bettorData.claimed && (() => {
                    const rawTxBytes = new Uint8Array(bettorData.claimTxId);
                    const decodedTxId = new TextDecoder().decode(rawTxBytes).replace(/\0/g, "");

                    if (!decodedTxId || decodedTxId.length < 30) {
                        return <p className="text-yellow-400 text-xs mt-2">Tx not yet saved</p>;
                    }

                    return (
                        <a
                            href={`https://explorer.solana.com/tx/${decodedTxId}?cluster=mainnet`}
                            className="text-blue-400 underline text-xs mt-2"
                            target="_blank"
                            rel="noreferrer"
                        >
                            View Claim Tx
                        </a>
                    );
                })()}

                {/* <p className="text-sm text-gray-300 mt-1"><strong>Options:</strong> {questionData?.betting.option1} vs {questionData?.betting.option2}</p> */}

                {bettorData && (
                    <div className="mt-6 bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
                        <p className="text-gray-300 mt-1">
                        <strong>You have placed your bet on: </strong>
                        {bettorData.chosenOption ? questionData?.betting.option1 : questionData?.betting.option2}
                        </p>
                        
                        <p className="text-gray-300 mt-1">
                        <strong>Bet Amount: </strong> 
                        {bettorData.betAmount && bettorData.betAmount.toNumber 
                            ? `${(bettorData.betAmount.toNumber() / 1_000_000_000).toFixed(2)} SOL`
                            : "Invalid Amount"}
                        </p>
                    </div>
                )}

                <p className="mt-4">{option1Percentage.toFixed(2)}%</p>
                {questionPda && <BetChart questionPda={questionPda} />}

                {/* 
                    Betting Form 
                    Hidden when betting is closed    
                */}
                {closeDate && Date.now() / 1000 < closeDate.getTime() / 1000 && (
                    <div className="mt-4">
                        <p className="text-sm text-gray-500 mt-2 italic">
                            Minimum bet amount is <strong>0.01 SOL</strong>. Your funds stay in smart contracts until resolved.
                        </p>
                        <input
                            type="number"
                            placeholder="Enter bet amount"
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            className="w-full p-3 border border-gray-500 bg-gray-800 text-white rounded-md focus:outline-none focus:ring focus:ring-blue-500"
                        />

                        <div className="flex gap-4 mt-4">
                            {/* Check if user already placed a bet */}
                            {typeof bettorData?.chosenOption !== 'boolean' ? (
                                <>
                                <button
                                    onClick={() => handleBet(true)}
                                    disabled={loading}
                                    className={`flex-1 font-bold py-2 px-4 rounded-lg transition 
                                        ${loading
                                        ? "!bg-gray-500 cursor-not-allowed text-gray-300"
                                        : "!bg-green-500 hover:bg-green-600 text-white"
                                        }`}
                                >
                                    Bet on {questionData?.betting.option1} (1: {option1Odds.toFixed(2)})
                                </button>

                                <button
                                    onClick={() => handleBet(false)}
                                    disabled={loading}
                                    className={`flex-1 font-bold py-2 px-4 rounded-lg transition 
                                        ${loading
                                        ? "!bg-gray-500 cursor-not-allowed text-gray-300"
                                        : "!bg-red-500 hover:bg-red-600 text-white"
                                        }`}
                                >
                                    Bet on {questionData?.betting.option2} (1: {option2Odds.toFixed(2)})
                                </button>
                                </>
                            ) : (
                                <button
                                onClick={() => handleBet(bettorData.chosenOption)}
                                disabled={loading}
                                className={`flex-1 font-bold py-2 px-4 rounded-lg transition 
                                    ${bettorData?.chosenOption
                                    ? "!bg-green-500 hover:bg-green-600 text-white"
                                    : "!bg-red-500 hover:bg-red-600 text-white"
                                    }`}
                                >
                                Add Bet on {bettorData?.chosenOption ? questionData?.betting.option1 : questionData?.betting.option2} 
                                (1: {bettorData?.chosenOption ? option1Odds.toFixed(2) : option2Odds.toFixed(2)})
                                </button>
                            )}
                        </div>

                        {txStatus && txSig && (
                            <div className="mt-3 text-sm text-center flex items-center justify-center gap-2">
                                {txStatus === "pending" && (
                                    <span className="flex items-center gap-2 text-yellow-400 animate-pulse">
                                        <FaSpinner className="animate-spin" />
                                        Waiting for confirmation...
                                    </span>
                                )}
                                {txStatus === "confirmed" && (
                                    <span className="flex items-center gap-2 text-green-400">
                                        <FaCheckCircle />
                                        Bet confirmed!
                                        <a
                                        href={`https://solscan.io/tx/${txSig}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline text-blue-400 inline-flex items-center gap-1"
                                        >
                                        View <FaExternalLinkAlt className="inline-block" size={12} />
                                        </a>
                                    </span>
                                )}
                                {txStatus === "failed" && (
                                    <span className="flex items-center gap-2 text-red-400">
                                        <FaTimesCircle />
                                        Transaction failed.
                                    </span>
                                )}
                                {txStatus === "timeout" && (
                                    <span className="flex items-center gap-2 text-orange-400">
                                        <FaClock />
                                        Confirmation delayed.
                                        <a
                                            href={`https://solscan.io/tx/${txSig}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline text-blue-400 inline-flex items-center gap-1"
                                        >
                                            Check <FaExternalLinkAlt className="inline-block" size={12} />
                                        </a>
                                    </span>
                                )}
                            </div>
                        )}

                    </div>
                )}

                {/* Resolution Dates */}
                <div className="mt-6 bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
                    <h3 className="text-lg font-semibold text-gray-300">Truth.it Resolution date</h3>
                    <p className="text-gray-400 text-sm">
                        Commit End Time:{" "}
                        <span className="text-white" title={new Date(Number(questionData?.truth.commitEndTime) * 1000).toLocaleString()}>
                            {new Date(Number(questionData?.truth.commitEndTime) * 1000).toLocaleDateString()} {new Date(Number(questionData?.truth.commitEndTime) * 1000).toLocaleTimeString()}
                        </span>
                    </p>
                    <p className="text-gray-400 text-sm">
                        Reveal End Tme:{" "}
                        <span className="text-white" title={new Date(Number(questionData?.truth.revealEndTime) * 1000).toLocaleString()}>
                            {new Date(Number(questionData?.truth.revealEndTime) * 1000).toLocaleDateString()} {new Date(Number(questionData?.truth.revealEndTime) * 1000).toLocaleTimeString()}
                        </span>
                    </p>
                </div>


                {/* Betting Pool & Commissions */}
                <div className="mt-6 bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
                    <h3 className="text-lg font-semibold text-gray-300">Betting Pool</h3>
                    <p className="text-sm text-gray-500 mb-2 italic">
                        Betting pool distribution: 1% to event creator, 1% to SolbetX dev fund, 1% to Truth.It for resolution, and 97% shared among winning bettors.
                    </p>

                    <p className="text-gray-400">
                        Total Pool: 
                        <span 
                            className="text-green-400">
                                {questionData?.betting.totalPool ? (Number(questionData?.betting.totalPool) / 1_000_000_000).toFixed(8) : 0} SOL
                        </span>
                    </p>
                    <p className="text-gray-400">
                        House Commission: 
                        <span className="text-yellow-400">
                            {questionData?.betting.totalHouseCommision ? (Number(questionData?.betting.totalHouseCommision) / 1_000_000_000).toFixed(8) : 0} SOL
                        </span>
                    </p>
                    <p className="text-gray-400">
                        Creator Commission: 
                        <span className="text-blue-400">
                            {questionData?.betting.totalCreatorCommission ? (Number(questionData?.betting.totalCreatorCommission) / 1_000_000_000).toFixed(8) : 0} SOL
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
                    How People Are Betting: {questionData?.betting.option1} {option1Percentage.toFixed(2)}% vs {questionData?.betting.option2} {option2Percentage.toFixed(2)}%
                </p>

                <div className="mt-6 bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
                    <h3 className="text-lg font-semibold text-gray-300">Vault Balances</h3>
                    <p className="text-sm text-gray-400 italic mb-2">
                        Vaults are smart contract accounts holding all SOL (bets and rewards) related to this event.
                    </p>
                    <p className="text-gray-400">Betting Vault Balance: <span className="text-green-400">{vaultBalance.toFixed(10)} SOL</span></p>
                    <p className="text-gray-400">Truth-Network Vault Balance: <span className="text-blue-400">{truthVaultBalance.toFixed(10)} SOL</span></p>
                </div>


                {revealEndTime && Date.now() / 1000 >= revealEndTime.getTime() / 1000 && !questionData?.truth.finalized && (
                    <button
                        onClick={fetchWinner}
                        disabled={loading}
                        className="w-full mt-4 !bg-purple-500 hover:!bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition"
                    >
                        {loading ? 
                            (
                                <span className="flex items-center justify-center">
                                    Getting Result <span className="dot-animate">.</span>
                                    <span className="dot-animate dot2">.</span>
                                    <span className="dot-animate dot3">.</span>
                                </span>
                            ) 
                            :
                            "Get Result"
                        }
                    </button>
                )}

                {bettorData &&
                    questionData?.truth.finalized &&
                    questionData?.truth.winningOption !== null &&
                    bettorData.chosenOption === questionData?.truth.winningOption &&
                    questionData?.truth.winningPercent >= 75 &&
                    !bettorData.claimed &&
                    parseFloat(questionData?.betting.totalBetsOption1) > 0 &&
                    parseFloat(questionData?.betting.totalBetsOption2) > 0 && 
                (
                    <button
                    onClick={claimWinnings}
                    disabled={loadingWinnings}
                    className="w-full mt-4 !bg-yellow-500 hover:!bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition"
                    >
                        {loadingWinnings ? 
                            (
                                <span className="flex items-center justify-center">
                                    Claiming Winnings <span className="dot-animate">.</span>
                                    <span className="dot-animate dot2">.</span>
                                    <span className="dot-animate dot3">.</span>
                                </span>
                            ) 
                            :
                            "Claim Winnings"
                        }
                    </button>
                )}

                {bettorData &&
                    publicKey &&
                    questionData?.truth.finalized && 
                    (
                        questionData?.truth.winningOption === null ||
                        questionData?.truth.winningOption === 0 ||
                        questionData?.truth.winningPercent < 75 ||
                        (
                            questionData?.truth.winningPercent >= 75 &&
                            (
                                parseFloat(questionData?.betting.totalBetsOption1) === 0 ||
                                parseFloat(questionData?.betting.totalBetsOption2) === 0
                            )
                        )
                    ) &&
                    !bettorData.claimed && 
                (
                    <button
                        onClick={claimWinnings}
                        disabled={loadingWinnings}
                        className="w-full mt-4 !bg-yellow-500 hover:!bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition"
                    >
                        {loadingWinnings ? 
                            (
                                <span className="flex items-center justify-center">
                                    Refunding Bet <span className="dot-animate">.</span>
                                    <span className="dot-animate dot2">.</span>
                                    <span className="dot-animate dot3">.</span>
                                </span>
                            ) 
                            :
                            "Refund Bet"
                        }
                    </button>
                )}

                {closeDate && Date.now() / 1000 >= closeDate.getTime() / 1000 && publicKey?.toBase58() === questionData?.betting.creator &&
                    questionData?.betting.totalCreatorCommission > 0 &&
                    !questionData?.betting.creatorCommissionClaimed && (
                        <button
                            onClick={claimCreatorCommission}
                            disabled={loadingCommission}
                            className="w-full mt-4 !bg-orange-500 hover:!bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition"
                        >
                            {loadingCommission ? 
                            (
                                <span className="flex items-center justify-center">
                                    Claiming Commission <span className="dot-animate">.</span>
                                    <span className="dot-animate dot2">.</span>
                                    <span className="dot-animate dot3">.</span>
                                </span>
                            ) 
                            :
                            "Claim Commission"
                        }
                        </button>
                )}

                {questionData?.truth.finalized && (
                    <div className="mt-6 bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
                        <p className="text-lg font-semibold text-gray-300">Result from truth.it network</p>   
                        {questionData.truth.winningPercent > 0 ? (
                            <>
                                {questionData.truth.winningPercent < 75 ?
                                    <p className="text-gray-400 mt-1">
                                        <strong>No Winner</strong>
                                    </p>
                                    :
                                    <p className="text-gray-400 mt-1">
                                        <strong>Winner:</strong> {questionData.truth.winningOption === true ? questionData.betting.option1 : questionData.betting.option2}
                                    </p>
                                }
                                <p className="text-gray-400 mt-1">
                                    <strong>Consensus:</strong> {questionData.truth.winningPercent.toFixed(2)}% 
                                    {questionData.truth.votesOption1 > questionData.truth.votesOption2 ? 
                                        ` (${questionData.truth.votesOption1} / ${questionData.truth.votesOption + questionData.truth.votesOption2} votes)`
                                        :
                                        ` (${questionData.truth.votesOption2} / ${questionData.truth.votesOption1 + questionData.truth.votesOption2} votes)`
                                    }
                                </p>

                                <p className="text-gray-400 mt-1">
                                    <strong>Vote Breakdown:</strong>{" "}
                                    True {((questionData.truth.votesOption1 / (questionData.truth.votesOption1 + questionData.truth.votesOption2)) * 100).toFixed(0)}% ·{" "}
                                    False {((questionData.truth.votesOption2 / (questionData.truth.votesOption1 + questionData.truth.votesOption2)) * 100).toFixed(0)}%
                                </p>

                                <p className="text-gray-400 mt-1">
                                    Resolution Source:{" "}
                                    <a
                                        href={getTruthEventUrl(questionData?.truth?.questionKey)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:underline"
                                    >
                                        Truth Network Event
                                    </a>
                                </p>

                                <p className="text-gray-400 text-sm mt-2">
                                    Note: A winner is declared only if the winning percentage is
                                    <strong> 75% or higher</strong>. Otherwise, the event is considered
                                    <strong> unresolved</strong>, and all users can claim a
                                    <strong> refund</strong> of their bet.
                                </p>

                                {bettorData && (parseFloat(questionData.betting.totalBetsOption1) === 0 || parseFloat(questionData.betting.totalBetsOption2) === 0) ? (
                                    <p className="text-gray-400 text-sm mt-2">
                                        <strong>Important:</strong> Only one side placed a bet. Since there was no
                                        real opponent, <strong>winnings cannot be claimed</strong> even if your
                                        option was declared the winner. A refund is available.
                                    </p>
                                ) : null}
                            </>
                        ) : (
                            <p className="text-gray-400 text-sm mt-2">
                                No votes were cast in the Truth.it Network. All bets are eligible for a <strong>refund</strong>.
                            </p>
                        )}
                    </div>
                )}


                {bettorData && questionData?.truth.finalized && (
                    <div className="mt-2">
                        {(
                            (
                                bettorData.claimed || // already claimed
                                (
                                    questionData.truth.winningPercent >= 75 &&
                                    questionData.truth.winningOption !== bettorData.chosenOption
                                ) || // user lost
                                (
                                    questionData.truth.winningPercent === 0 &&
                                    bettorData.claimed
                                ) // no voters, claimed refund
                            )
                            && 
                            (
                                publicKey?.toBase58() !== questionData?.betting.creator ||
                                (publicKey?.toBase58() === questionData?.betting.creator && questionData?.betting.creatorCommissionClaimed)
                            )
                        ) && (
                            <button
                                onClick={() => deleteBettorAccount()}
                                disabled={loadingDeleting}
                                className="!bg-red-500 hover:bg-red-600 text-white text-sm py-1 px-3 rounded"
                            >
                                {loadingDeleting ? (
                                    <span className="flex items-center justify-center">
                                        Deleting Bettor Record <span className="dot-animate">.</span>
                                        <span className="dot-animate dot2">.</span>
                                        <span className="dot-animate dot3">.</span>
                                    </span>
                                ) : (
                                    "Delete Bettor Record (Refund rent)"
                                )}
                            </button>
                        )}
                    </div>
                )}



                {canDeleteEvent && (
                    <div className="mt-4">
                        <button
                            onClick={deleteEvent}
                            disabled={loading}
                            className="!bg-red-500 hover:!bg-red-600 text-white py-2 px-4 rounded"
                        >

                            {loading ? (
                                <span className="flex items-center justify-center">
                                    Deleting Event <span className="dot-animate">.</span>
                                    <span className="dot-animate dot2">.</span>
                                    <span className="dot-animate dot3">.</span>
                                </span>
                            ) : (
                                "Delete Event (Refund rent)"
                            )}
                        </button>
                    </div>
                )}
                
            </div>
        </div>
    );
};

export default QuestionDetails;



