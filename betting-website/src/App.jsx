import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import FetchQuestion from "./components/FetchQuestion";
import CreateQuestion from "./components/CreateQuestion";
import CallHelloWorld from "./components/CallHelloWorld";
import QuestionDetails from "./components/QuestionDetails";

function App() {
    return (
        <Router>
            <div>
                <h1>Betting Website</h1>
                <WalletMultiButton />
                <CallHelloWorld />
                <CreateQuestion />
                <FetchQuestion />

                <Routes>
                    <Route path="/question/:questionPda" element={<QuestionDetails />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
