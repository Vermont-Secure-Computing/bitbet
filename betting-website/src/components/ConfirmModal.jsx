import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const ConfirmModal = ({ isOpen, onClose, onConfirm }) => {
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
                    <h2 className="text-xl font-bold mb-3">Confirm Event Format</h2>
                    <p className="text-gray-800 mb-6">
                        Are you sure the event is phrased as a <strong>True or False</strong> statement?
                    </p>
    
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 !bg-gray-300 rounded-lg hover:!bg-gray-400 transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="px-4 py-2 !bg-blue-600 text-white rounded-lg hover:!bg-blue-700 transition"
                        >
                            Yes, Proceed
                        </button>
                    </div>
                </motion.div>
            </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ConfirmModal;