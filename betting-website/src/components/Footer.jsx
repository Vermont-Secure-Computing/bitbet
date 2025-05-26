import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FaGithub } from "react-icons/fa";
import RpcSettingsModal from "./RpcSettingsModal";

const Footer = () => {

    const [showRpcModal, setShowRpcModal] = useState(false);
    const [rpcUrl, setRpcUrl] = useState("");
    const [rpcStatusText, setRpcStatusText] = useState("Checking...");
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem("customRpcUrl") || "https://solana-rpc.publicnode.com";
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
        <footer className="w-full py-6 bg-gray-800 text-gray-400 text-sm">
            <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-center sm:text-left">
                <div className="flex items-center gap-2">
                    <FaGithub className="text-xl" />
                    <a
                        href="https://github.com/Vermont-Secure-Computing/bitbet"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                    >
                        View SolBetX on GitHub
                    </a>
                </div>
                <div className="flex items-center gap-6">
                    
                    <Link
                        onClick={() => setShowRpcModal(true)}
                        className="text-white text-sm hover:text-yellow-400 transition"
                    >
                        Network Setting

                        <span
                            className={`text-xs ml-2 px-2 py-1 rounded ${
                                isOnline ? "bg-green-600 text-white" : "bg-red-600 text-white"
                            }`}
                        >
                            {rpcStatusText || "Checking..."}
                        </span>
                    </Link>
                    <Link to="/security-policy" className="hover:underline text-gray-300">
                        Security Policy
                    </Link>
                </div>
            </div>
            <RpcSettingsModal isOpen={showRpcModal} onClose={() => setShowRpcModal(false)} />
        </footer>
    );
};

export default Footer;
