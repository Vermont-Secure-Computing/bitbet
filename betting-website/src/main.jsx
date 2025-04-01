import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { Buffer } from "buffer";

window.Buffer = Buffer;

// Import default styles for Wallet Adapter UI
import "@solana/wallet-adapter-react-ui/styles.css";

const network = "devnet";

// Create a connection
const endpoint = clusterApiUrl(network);

// List of supported wallets
const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    <App />
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    </React.StrictMode>
);
