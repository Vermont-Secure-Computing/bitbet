// components/rpc/RpcTroubleshooterModal.jsx
import React from "react";
import { getConstants } from "../../constants";
import { rpcManager } from "./rpcManager";

const HIDE_TROUBLESHOOTER_KEY = "hideRpcTroubleshooterUntil";

export default function RpcTroubleshooterModal({
  open,
  onClose,
  data,                // { reason, triedUrls, lastError, networkName }
  onOpenAdvanced,      // callback to open your RpcSettingsModal
}) {
  if (!open) return null;

  const constants = getConstants();
  const providers = constants.RPC_HELP_LINKS || [];
  const lastWorking = localStorage.getItem("lastWorkingRpc") || null;
  const currentRpc = localStorage.getItem("customRpcUrl") || rpcManager.get();

  const retry = async () => {
    // Let caller re-trigger whatever fetch failed
    // Most callers just reload or re-run their loader
    window.location.reload();
  };

  const dontShowFor24h = () => {
    const until = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem(HIDE_TROUBLESHOOTER_KEY, String(until));
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white text-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-xl font-semibold mb-2">
          We’re having trouble connecting to Solana
        </h2>
        <p className="text-sm mb-3">
          We tried all available RPC endpoints for <b>{data?.networkName || constants.NETWORK_NAME}</b> but none responded successfully.
        </p>

        <div className="rounded-lg border p-3 mb-3 bg-gray-50">
          <div className="text-sm">
            <div className="mb-1"><b>Current RPC:</b> <span className="break-all">{currentRpc || "—"}</span></div>
            <div className="mb-1"><b>Last working RPC:</b> <span className="break-all">{lastWorking || "unknown"}</span></div>
          </div>
        </div>

        {/* Collapsible diagnostics */}
        <details className="mb-4">
          <summary className="cursor-pointer text-sm font-medium">Diagnostics</summary>
          <div className="mt-2">
            <div className="text-sm mb-1"><b>Reason:</b> {data?.reason || "n/a"}</div>
            {data?.lastError && (
              <div className="text-xs mb-2 text-red-700 break-all">
                <b>Last error:</b> {String(data.lastError)}
              </div>
            )}
            <div className="text-sm mb-1"><b>Endpoints tried:</b></div>
            <ul className="text-xs list-disc pl-5 space-y-1 max-h-28 overflow-auto">
              {(data?.triedUrls || []).map((u, i) => (
                <li key={i} className="opacity-70 break-all">
                  {u} <span className="ml-2 inline-block px-2 py-0.5 text-[10px] rounded bg-red-100 text-red-700">failed</span>
                </li>
              ))}
            </ul>
          </div>
        </details>

        <div className="rounded-lg border p-3 mb-4 bg-gray-50">
          <div className="text-sm mb-2"><b>Need an RPC provider?</b></div>
          <ul className="text-sm list-disc pl-5 space-y-1">
            {providers.map((link, i) => (
              <li key={i}>
                <a className="text-blue-600 underline" href={link} target="_blank" rel="noreferrer">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <button
            onClick={retry}
            className="px-4 py-2 rounded !bg-blue-600 text-white hover:!bg-blue-700"
          >
            Retry now
          </button>
          <button
            onClick={onOpenAdvanced}
            className="px-4 py-2 rounded !bg-indigo-600 text-white hover:!bg-indigo-700"
          >
            Open RPC settings
          </button>
          <button
            onClick={dontShowFor24h}
            className="px-4 py-2 rounded !bg-gray-200 hover:!bg-gray-300"
          >
            Don’t show for 24h
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded !bg-gray-200 hover:!bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
