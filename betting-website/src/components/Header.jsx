import { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { FaBars, FaTimes } from "react-icons/fa";
import RpcSettingsModal from "./RpcSettingsModal";

const Header = () => {
    const { publicKey } = useWallet();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showRpcModal, setShowRpcModal] = useState(false);
    const [rpcUrl, setRpcUrl] = useState("");
    const [rpcStatusText, setRpcStatusText] = useState("Checking...");
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem("customRpcUrl") || "https://api.devnet.solana.com";
        setRpcUrl(stored);
      
        axios.post(stored, {
            jsonrpc: "2.0",
            id: 1,
            method: "getVersion"
        }, {
            headers: { "Content-Type": "application/json" }
        })
            .then((res) => {
                if (res.status === 200 && res.data.result) {
                    setRpcStatusText("Online");
                    setIsOnline(true);
                } else {
                    setRpcStatusText("Offline");
                    setIsOnline(false);
                }
            })
            .catch((error) => {
                console.error("RPC health check failed:", error.message);
                setRpcStatusText("Offline");
                setIsOnline(false);
            });
    }, []);

    return (
        <>
            <header className="w-full bg-gray-800 py-4 shadow-lg relative">
                <div className="container mx-auto flex justify-between items-center px-4 sm:px-6">
                    {/* Logo + Label */}
                    <div>
                        <Link to="/" className="text-2xl font-bold text-white hover:underline block">
                            SolBetX - DevNet - v0.9
                        </Link>
                        <p className="text-sm text-gray-300">Open Source No-Token Smart contract betting platform resolved by Truth.it network</p>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden sm:flex items-center gap-6">
                        <Link to="/" className="text-white text-sm hover:text-yellow-400 transition">
                            Home
                        </Link>
                        {publicKey && (
                            <Link
                                to="/dashboard"
                                className="text-white text-sm hover:text-yellow-400 transition"
                            >
                                My Bets
                            </Link>
                        )}
                        <Link
                            onClick={() => setShowRpcModal(true)}
                            className="text-white text-sm hover:text-yellow-400 transition"
                        >
                            Change RPC

                            <span
                                className={`text-xs ml-2 px-2 py-1 rounded ${
                                    isOnline ? "bg-green-600 text-white" : "bg-red-600 text-white"
                                }`}
                            >
                                {rpcStatusText || "Checking..."}
                            </span>
                        </Link>
                        
                        <Link to="/instructions" className="text-white text-sm hover:text-yellow-400 transition">
                            Instructions
                        </Link>
                        <Link to="/security-policy" className="text-white text-sm hover:text-yellow-400 transition">
                            Security Policy
                        </Link>
                        
                        <WalletMultiButton />
                    </nav>

                    {/* Mobile Hamburger */}
                    <button
                        className="sm:hidden !bg-blue-400 text-white"
                        onClick={() => setIsMenuOpen((prev) => !prev)}
                    >
                        {isMenuOpen ? <FaTimes size={22} /> : <FaBars size={22} />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <div className="sm:hidden bg-gray-700 border-t border-gray-600 mt-2 px-4 py-3 space-y-3 text-center z-10">
                        <Link
                            to="/"
                            className="block text-white text-sm hover:text-yellow-400"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            Home
                        </Link>
                        <Link 
                            to="/instructions" 
                            className="block text-white text-sm hover:text-yellow-400 transition"
                        >
                            Instructions
                        </Link>
                        <Link
                            onClick={() => setShowRpcModal(true)}
                            className="block text-white text-sm hover:text-yellow-400 transition"
                        >
                            Change RPC
                        </Link>
                        <div
                            className={`text-xs mt-2 px-3 py-1 rounded inline-block ${
                                isOnline ? "bg-green-600 text-white" : "bg-red-600 text-white"
                            }`}
                        >
                            {rpcStatusText || "Checking..."}
                        </div>
                        <Link 
                            to="/security-policy" 
                            className="block text-white text-sm hover:text-yellow-400 transition"
                        >
                            Security Policy
                        </Link>
                        {publicKey && (
                            <Link
                                to="/dashboard"
                                className="block text-white text-sm hover:text-yellow-400"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                My Bets
                            </Link>
                        )}
                        <div className="flex justify-center">
                            <WalletMultiButton />
                        </div>
                    </div>
                )}
            </header>
            <RpcSettingsModal isOpen={showRpcModal} onClose={() => setShowRpcModal(false)} />
        </>
    );
};

export default Header;
