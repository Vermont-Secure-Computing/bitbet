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
import SecurityPolicy from "./components/SecurityPolicy";
import Footer from "./components/Footer";

function App() {

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
            <ToastContainer />
            <Footer />
        </>
    );
}

export default App;
