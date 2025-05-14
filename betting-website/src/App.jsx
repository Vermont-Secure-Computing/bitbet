import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ToastContainer } from "react-toastify";

import CallHelloWorld from "./components/CallHelloWorld";
import QuestionDetails from "./components/QuestionDetails";
import Home from "./components/Home";
import UserDashboard from "./components/UserDashboard";
import Header from "./components/Header";
import InstructionsPage from "./components/Instructions";

function App() {

    return (
        <Router>
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
            </Routes>
            {/* Toast Notification */}
            <ToastContainer />
        </Router>
    );
}

export default App;
