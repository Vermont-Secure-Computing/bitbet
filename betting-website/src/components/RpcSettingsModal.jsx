import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DEFAULT_RPC = "https://api.devnet.solana.com";

const RpcSettingsModal = ({ isOpen, onClose }) => {
    const [rpcUrl, setRpcUrl] = useState(DEFAULT_RPC);

    useEffect(() => {
        const saved = localStorage.getItem("customRpcUrl");
        if (saved) setRpcUrl(saved);
    }, []);

    const handleSave = () => {
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
                    <h2 className="text-xl font-semibold mb-4">Set RPC Endpoint</h2>
                    <input
                        type="text"
                        value={rpcUrl}
                        onChange={(e) => setRpcUrl(e.target.value)}
                        className="w-full px-4 py-2 border border-color-blue rounded mb-4 text-sm"
                    />
                    <div className="flex justify-between mt-4">
                        <button onClick={onClose} className="px-4 py-2 !bg-gray-300 rounded hover:!bg-gray-400">Cancel</button>
                        <button onClick={handleReset} className="px-4 py-2 !bg-yellow-500 text-white rounded hover:!bg-yellow-600">Reset</button>
                        <button onClick={handleSave} className="px-4 py-2 !bg-blue-600 text-white rounded hover:!bg-blue-700">Save & Reload</button>
                    </div>
                </motion.div>
            </motion.div>
            )}
        </AnimatePresence>
    );
};

export default RpcSettingsModal;
