import React, { useState } from "react";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import { FaGithub } from 'react-icons/fa';

import FetchQuestion from "./FetchQuestion";
import CreateQuestion from "./CreateQuestion";

function Home() {
    const [activeTab, setActiveTab] = useState("fetch");
    const navigate = useNavigate();

    return (
        <div className="w-full min-h-screen bg-gray-900 text-white flex flex-col">
            

            {/* Main Content */}
            <div className="w-full flex justify-center px-0 sm:px-6 lg:px-8 mt-6">
                <div className="w-full max-w-[1600px] bg-gray-800 rounded-lg shadow-md p-6">

                    {/* Tabs for Create & View Questions */}
                    <div className="bg-gray-800 rounded-t-xl shadow-sm">
                        <div className="flex justify-around">
                            <button
                                className={`flex-1 px-6 py-3 font-semibold transition-colors rounded-t-xl ${
                                    activeTab === "fetch"
                                        ? "!bg-blue-600 text-white"
                                        : "!bg-transparent text-gray-300 hover:!bg-blue-500 hover:text-white"
                                } focus:outline-none`}
                                onClick={() => setActiveTab("fetch")}
                            >
                                All Events
                            </button>
                            <button
                                className={`flex-1 px-6 py-3 font-semibold transition-colors rounded-t-xl ${
                                    activeTab === "create"
                                        ? "!bg-green-600 text-white"
                                        : "!bg-transparent text-gray-300 hover:!bg-green-500 hover:text-white"
                                } focus:outline-none`}
                                onClick={() => setActiveTab("create")}
                            >
                                Create Event
                            </button>
                        </div>
                    </div>



                    {/* Render Active Tab */}
                    <div className="mt-6">
                        {activeTab === "fetch" ? <FetchQuestion /> : <CreateQuestion setActiveTab={setActiveTab} />}
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-center items-center gap-2 text-sm text-gray-400">
                <FaGithub className="text-xl" />
                <a
                    href="https://github.com/Vermont-Secure-Computing/bitbet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                >
                    View SolBetX on GitHub
                </a>
            </div>

            
        </div>
    );
}

export default Home;
