import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ToastContainer } from "react-toastify";

import CallHelloWorld from "./components/CallHelloWorld";
import QuestionDetails from "./components/QuestionDetails";
import Home from "./components/Home";
import UserDashboard from "./components/UserDashboard";
import Header from "./components/Header";
import InstructionsPage from "./components/Instructions";
import SecurityPolicy from "./components/SecurityPolicy";
import Footer from "./components/Footer";
import RpcHelpModal from "./components/rpc/rpcHelpModal";
import RpcTroubleshooterModal from "./components/rpc/rpcTroubleShooterModal";
import RpcSettingsModal from "./components/RpcSettingsModal";
import { rpcManager } from "./components/rpc/rpcManager";

const HIDE_TROUBLESHOOTER_KEY = "hideRpcTroubleshooterUntil";

function App() {

    const [showRpcModal, setShowRpcModal] = useState(false);

    // Troubleshooter modal + data
    const [showTroubleshooter, setShowTroubleshooter] = useState(false);
    const [troubleshooterData, setTroubleshooterData] = useState(null);

    // Advanced settings modal
    const [showRpcSettings, setShowRpcSettings] = useState(false);

    useEffect(() => {
        try {
          const dismissed = localStorage.getItem(rpcManager.storageKeys.DONT_SHOW_MODAL);
          if (!dismissed) setShowRpcModal(true);
        } catch {}
      
        rpcManager.pickBest();
        const id = setInterval(() => rpcManager.ensureHealthy(), 90_000);
      
        // Troubleshooter event (already there)
        const openTrouble = (e) => {
          const until = Number(localStorage.getItem(HIDE_TROUBLESHOOTER_KEY) || "0");
          if (until && Date.now() < until) return;
          setTroubleshooterData(e?.detail || null);
          setShowTroubleshooter(true);
        };
        window.addEventListener("open-rpc-troubleshooter", openTrouble);
      
        // ✅ NEW: open settings event
        const openSettings = () => setShowRpcSettings(true);
        window.addEventListener("open-rpc-settings", openSettings);
      
        return () => {
          clearInterval(id);
          window.removeEventListener("open-rpc-troubleshooter", openTrouble);
          window.removeEventListener("open-rpc-settings", openSettings);
        };
      }, []);

    return (
        <>
            <Header />
            <Routes>
                {/* Home Page (Tabs for Viewing & Creating Questions) */}
                <Route path="/" element={<Home />} />

                {/* Question Details Page */}
                <Route path="/question/:questionPda" element={<QuestionDetails />} />

                {/* User Dashboard */}
                <Route path="/dashboard" element={<UserDashboard />} />

                {/* Instructions */}
                <Route path="/instructions" element={<InstructionsPage />} />

                {/** Security Policy */}
                <Route path="/security-policy" element={<SecurityPolicy />} />
            </Routes>
            {/* Toast Notification */}
            <ToastContainer position="top-center"/>
            <RpcHelpModal open={showRpcModal} onClose={() => setShowRpcModal(false)} />

            {/* Troubleshooter on failure */}
            <RpcTroubleshooterModal
                open={showTroubleshooter}
                onClose={() => setShowTroubleshooter(false)}
                data={troubleshooterData}
                onOpenAdvanced={() => {
                setShowTroubleshooter(false);
                setShowRpcSettings(true);
                }}
            />

            {/* Advanced manual entry/reset dialog (you already have this) */}
            <RpcSettingsModal
                isOpen={showRpcSettings}
                onClose={() => setShowRpcSettings(false)}
            />

            <Footer />
        </>
    );
}

export default App;
