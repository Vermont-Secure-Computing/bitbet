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
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
            <div className="bg-white text-gray-600 text-sm rounded-lg p-6 w-96">
                <h2 className="text-lg font-bold mb-3">{NETWORK_NAME} RPC Node Information</h2>

                <p className="mb-3">
                    SolBetX connects to the Solana blockchain using the default RPC node and a set of fallback RPC nodes for better reliability.
                </p>

                <p className="mb-3">
                    <strong>Default RPC:</strong> <span className="font-mono break-all">{DEFAULT_RPC_URL}</span>
                </p>

                <p className="mb-3">Fallback RPCs:</p>
                <ul className="list-disc pl-5 mb-4">
                    {FALLBACK_RPC_URLS.map((url, i) => (
                        <li key={i} className="break-all">{url}</li>
                    ))}
                </ul>

                <p className="mb-3">
                    If you experience slow loading, lag, or missing events in the future, you can set your own custom RPC node using the{" "}
                    <button onClick={openRpcSettings} className="text-blue-500 underline">
                      Network Settings
                    </button>{" "}
                    in the footer.
                </p>

                <p className="mb-3">Need your own RPC provider?</p>
                <ul className="list-disc pl-5">
                    {RPC_HELP_LINKS.map((link, i) => (
                        <li key={i}>
                            <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                                {link}
                            </a>
                        </li>
                    ))}
                </ul>

                <div className="flex justify-end gap-3 mt-4">
                    <button
                        onClick={() => {
                            localStorage.setItem("dismissRpcHelp", "true");
                            setShow(false);
                        }}
                        className="px-4 py-2 !bg-gray-300 rounded"
                    >
                        Do not show again
                    </button>
                    <button onClick={close} className="px-4 py-2 !bg-blue-500 text-white rounded">
                      Close
                    </button>
                </div>
            </div>
        </div>
    );
}
