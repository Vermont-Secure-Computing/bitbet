import React, { useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast, ToastContainer, Bounce } from "react-toastify"; 
import "react-toastify/dist/ReactToastify.css";
import { getIdls } from "../idls";
import constants from "../constants";

const { bettingIDL } = await getIdls();

const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");
const PROGRAM_ID = new PublicKey(import.meta.env.VITE_BETTING_PROGRAM_ID);

const CallHelloWorld = () => {
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [loading, setLoading] = useState(false);

    const walletAdapter = publicKey && signTransaction ? { 
        publicKey, 
        signTransaction, 
        signAllTransactions, 
        network: "devnet" 
    } : null;
    
    const provider = walletAdapter ? new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" }) : null;
    const program = provider ? new Program(bettingIDL, provider) : null;

    const callHelloWorld = async () => {

        if (!publicKey) {
            console.log("should display toast")
            toast.error("Please connect your wallet!", {
                position: "top-right",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "light",
                transition: Bounce,
            });
            await connect();
            return;
        }


        try {
            setLoading(true);
            console.log("Wallet Public Key:", publicKey.toString());
            console.log("Program Methods:", Object.keys(program.methods));
            console.log("Calling helloWorld...");

            // Call the smart contract method correctly
            const tx = await program.methods.callHelloWorld()
                .accounts({ user: publicKey })
                .rpc();

            console.log("Transaction Signature:", tx);

            // Fetch Logs
            const txData = await connection.getTransaction(tx, { commitment: "confirmed" });
            if (txData?.meta?.logMessages) {
                console.log("Logs from helloWorld call:");
                txData.meta.logMessages.forEach(log => console.log(log));
            }

            toast.success("HelloWorld executed successfully!", { transition: Bounce });
        } catch (error) {
            console.error("Error calling helloWorld:", error);
            alert("Error calling helloWorld. Check console for details.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2>Test Smart Contract CPI Connection</h2>
            <button onClick={callHelloWorld} disabled={loading}>
                {loading ? "Calling..." : "Call Hello World via CPI"}
            </button>
        </div>
    );
};

export default CallHelloWorld;
