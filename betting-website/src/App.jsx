// import React from "react";
// import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
// import { ToastContainer } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";

// import FetchQuestion from "./components/FetchQuestion";
// import CreateQuestion from "./components/CreateQuestion";
// import CallHelloWorld from "./components/CallHelloWorld";
// import QuestionDetails from "./components/QuestionDetails";

// function App() {
//     return (
//         <Router>
//             <div className="flex flex-col w-100 justify-center">
//                 <ToastContainer />
//                 <h1>Betting Website</h1>
//                 <WalletMultiButton />
//                 <CallHelloWorld />
//                 <CreateQuestion />
//                 <FetchQuestion />

//                 <Routes>
//                     <Route path="/question/:questionPda" element={<QuestionDetails />} />
//                 </Routes>
//             </div>
//         </Router>
//     );
// }

// export default App;


import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import CallHelloWorld from "./components/CallHelloWorld";
import QuestionDetails from "./components/QuestionDetails";
import Home from "./components/Home";

function App() {

    return (
        <Router>
            {/* Header */}
            <header className="w-full bg-gray-800 py-4 shadow-lg">
                <div className="container mx-auto flex justify-between items-center px-6">
                    <Link to="/" className="text-2xl font-bold !text-white">
                        BitBet
                    </Link>
                    <WalletMultiButton />
                </div>
            </header>
            <Routes>
                {/* Home Page (Tabs for Viewing & Creating Questions) */}
                <Route path="/" element={<Home />} />

                {/* Question Details Page (Completely Separate) */}
                <Route path="/question/:questionPda" element={<QuestionDetails />} />
            </Routes>
        </Router>
    );
}

export default App;
