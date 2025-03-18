import React, { useState } from "react";
import "react-toastify/dist/ReactToastify.css";

import FetchQuestion from "./FetchQuestion"
import CreateQuestion from "./CreateQuestion";
import CallHelloWorld from "./CallHelloWorld";

function Home() {
    const [activeTab, setActiveTab] = useState("fetch");

    return (
        <div className="w-full min-h-screen bg-gray-900 text-white flex flex-col">
            

            {/* Main Content */}
            <div className="w-full flex justify-center mt-6">
                <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-md p-6">
                    {/* Tabs for Create & View Questions */}
                    <div className="flex justify-around border-b border-gray-700">
                        <button
                            className={`px-6 py-3 ${activeTab === "fetch" ? "border-b-2 border-blue-500 text-blue-400" : "text-gray-400"} focus:outline-none`}
                            onClick={() => setActiveTab("fetch")}
                        >
                            View Questions
                        </button>
                        <button
                            className={`px-6 py-3 ${activeTab === "create" ? "border-b-2 border-green-500 text-green-400" : "text-gray-400"} focus:outline-none`}
                            onClick={() => setActiveTab("create")}
                        >
                            Create Question
                        </button>
                    </div>

                    {/* Render Active Tab */}
                    <div className="mt-6">
                        {activeTab === "fetch" ? <FetchQuestion /> : <CreateQuestion />}
                    </div>
                </div>
            </div>

            
        </div>
    );
}

export default Home;
