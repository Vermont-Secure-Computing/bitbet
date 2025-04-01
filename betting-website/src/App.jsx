import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ToastContainer } from "react-toastify";

import CallHelloWorld from "./components/CallHelloWorld";
import QuestionDetails from "./components/QuestionDetails";
import Home from "./components/Home";
import UserDashboard from "./components/UserDashboard";
import Header from "./components/Header";

function App() {

    return (
        <Router>
            {/* Header 
            <header className="w-full bg-gray-800 py-4 shadow-lg">
                <div className="container mx-auto flex justify-between items-center px-6">
                    <div>
                        <Link to="/" className="text-2xl font-bold !text-white">
                            BitBet
                        </Link>
                        <p className="text-sm text-gray-300">Running on Devnet</p>
                    </div>
                    <WalletMultiButton />
                </div>
            </header>*/}
            <Header />
            <Routes>
                {/* Home Page (Tabs for Viewing & Creating Questions) */}
                <Route path="/" element={<Home />} />

                {/* Question Details Page */}
                <Route path="/question/:questionPda" element={<QuestionDetails />} />

                {/* User Dashboard */}
                <Route path="/dashboard" element={<UserDashboard />} />
            </Routes>
            {/* Toast Notification */}
            <ToastContainer />
        </Router>
    );
}

export default App;
