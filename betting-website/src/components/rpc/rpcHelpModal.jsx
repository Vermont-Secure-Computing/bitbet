import React, { useState, useEffect } from "react";
import { getConstants } from "../../constants";

const { FALLBACK_RPC_URLS, RPC_HELP_LINKS, DEFAULT_RPC_URL, NETWORK_NAME } = getConstants();

export default function RpcHelpModal({ open, onClose }) {
    const [internalShow, setInternalShow] = useState(false);


    useEffect(() => {
      if (open === undefined) {
        const dismissed = localStorage.getItem("dismissRpcHelp");
        if (!dismissed) setInternalShow(true);
      }
    }, [open]);
  
    const show = open !== undefined ? open : internalShow;
    const close = onClose || (() => setInternalShow(false));
  
    const openRpcSettings = () => {
      window.dispatchEvent(new CustomEvent("open-rpc-settings"));
      close();
    };
  
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
            <div className="bg-white text-gray-600 rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-6 overflow-y-auto max-h-[90vh]">
                <h2 className="text-lg sm:text-xl font-bold mb-3">{NETWORK_NAME} RPC Node Information</h2>

                <p className="text-xs sm:text-sm mb-3">
                    SolBetX connects to the Solana blockchain using the default RPC node and a set of fallback RPC nodes for better reliability.
                </p>

                <p className="text-xs sm:text-sm mb-3">
                    <strong>Default RPC:</strong> <span className="font-mono break-all">{DEFAULT_RPC_URL}</span>
                </p>

                <p className="text-xs sm:text-sm mb-3">Fallback RPCs:</p>
                <ul className="list-disc pl-5 mb-4 text-xs sm:text-sm space-y-1">
                    {FALLBACK_RPC_URLS.map((url, i) => (
                        <li key={i} className="break-all">{url}</li>
                    ))}
                </ul>

                <p className="text-xs sm:text-sm mb-3">
                    If you experience slow loading, lag, or missing events in the future, you can set your own custom RPC node using the{" "}
                    <button onClick={openRpcSettings} className="!bg-white text-blue-500 underline">
                      Network Settings
                    </button>{" "}
                    in the footer.
                </p>

                <p className="text-xs sm:text-sm mb-3">Need your own RPC provider?</p>
                <ul className="list-disc pl-5 mb-4 text-xs sm:text-sm space-y-1">
                    {RPC_HELP_LINKS.map((link, i) => (
                        <li key={i} className="break-all">
                            <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                                {link}
                            </a>
                        </li>
                    ))}
                </ul>

                <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:justify-end mt-4">
                    <button
                        onClick={() => {
                            localStorage.setItem("dismissRpcHelp", "true");
                            setShow(false);
                        }}
                        className="w-full sm:w-auto px-3 py-2 rounded !bg-gray-200 hover:!bg-gray-300 text-sm"
                    >
                        Do not show again
                    </button>
                    <button onClick={close} className="w-full sm:w-auto px-3 py-2 rounded !bg-blue-600 text-white hover:!bg-blue-700 text-sm">
                      Close
                    </button>
                </div>
            </div>
        </div>
    );
}
