import React from "react";
import { Link } from "react-router-dom";
import { FaGithub } from "react-icons/fa";

const Footer = () => {
    return (
        <footer className="w-full py-6 bg-gray-800 text-gray-400 text-sm">
            <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-center sm:text-left">
                <div className="flex items-center gap-2">
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
                <div className="flex items-center gap-6">
                    <Link to="/instructions" className="hover:underline text-gray-300">
                        Instructions
                    </Link>
                    <Link to="/security-policy" className="hover:underline text-gray-300">
                        Security Policy
                    </Link>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
