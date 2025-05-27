import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import constants from "../constants";
const DEFAULT_RPC = constants.DEFAULT_RPC_URL;

const RpcSettingsModal = ({ isOpen, onClose }) => {
    const [rpcUrl, setRpcUrl] = useState(DEFAULT_RPC);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("customRpcUrl");
        if (saved) setRpcUrl(saved);
    }, []);

    const hasMaliciousChars = (url) => {
        const pattern = /<script|javascript:|data:text|<|>|"|'/i;
        return pattern.test(url);
      };

    const isValidHttpUrl = (string) => {
        try {
            const url = new URL(string);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch (err) {
            return false;
        }
    }

    const testRpcConnection = async (url) => {
        try {
            const res = await axios.post(url, {
                jsonrpc: "2.0",
                id: 1,
                method: "getVersion"
            }, {
                headers: { "Content-Type": "application/json" }
            });
    
            return res.status === 200;
        } catch (error) {
            console.error("RPC version check failed:", error.message);
            return false;
        }
    }

    const handleSave = async() => {

        setError("");

        if (rpcUrl.length < 10 || rpcUrl.length > 200) {
            setError("RPC URL must be between 10 and 200 characters.")
            return;
        }

        if (hasMaliciousChars(rpcUrl)) {
            setError("RPC URL contains forbidden or unsafe characters.");
            return;
        }

        if (!isValidHttpUrl(rpcUrl)) {
            setError("Please enter a valid HTTP/HTTPS URL.");
            return;
        }

        setLoading(true);
        const works = await testRpcConnection(rpcUrl);

        if (!works) {
            setError("Unable to connect to this RPC endpoint.");
            setLoading(false);
            return;
        }

        localStorage.setItem("customRpcUrl", rpcUrl);
        window.location.reload();
    };

    const handleReset = () => {
        localStorage.removeItem("customRpcUrl");
        window.location.reload();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
            <motion.div
                key="modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white/80 backdrop-blur-lg text-black rounded-2xl shadow-2xl max-w-md w-full p-6"
                >
                    <h2 className="text-xl font-semibold mb-4">Set Solana RPC Endpoint</h2>
                    <input
                        type="text"
                        value={rpcUrl}
                        onChange={(e) => setRpcUrl(e.target.value)}
                        className="w-full px-4 py-2 border border-color-blue rounded mb-4 text-sm"
                    />
                    {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
                    {loading && <p className="text-sm text-blue-500 mb-2">Checking connection...</p>}

                    <div className="flex justify-between mt-4">
                        <button onClick={onClose} className="px-4 py-2 !bg-gray-300 rounded hover:!bg-gray-400">Cancel</button>
                        <button onClick={handleReset} className="px-4 py-2 !bg-yellow-500 text-white rounded hover:!bg-yellow-600">Reset</button>
                        <button 
                            disabled={loading}
                            onClick={handleSave} 
                            className="px-4 py-2 !bg-blue-600 text-white rounded hover:!bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Saving..." : "Save & Reload"}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
            )}
        </AnimatePresence>
    );
};

export default RpcSettingsModal;
