import React, { useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import idl from "../idls/betting.json"; // Ensure this file exists & is correctly imported

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
    
    // Ensure a valid provider before creating a program instance
    const provider = walletAdapter ? new AnchorProvider(connection, walletAdapter, { preflightCommitment: "processed" }) : null;
    const program = provider ? new Program(idl, provider) : null;

    const callHelloWorld = async () => {
        console.log("Public Key:", publicKey);

        if (!publicKey) {
            alert("Please connect your wallet first!");
            await connect();
            return;
        }


        try {
            setLoading(true);
            console.log("Wallet Public Key:", publicKey.toString());

            // Ensure program is correctly initialized
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

            alert("HelloWorld executed! Check console for logs.");
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
