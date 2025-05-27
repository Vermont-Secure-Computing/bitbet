import { useState } from "react";
import { Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { FaBars, FaTimes } from "react-icons/fa";
import constants from "../constants";


const Header = () => {
    const { publicKey } = useWallet();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    return (
        <>
            <header className="w-full bg-gray-800 py-4 shadow-lg relative">
                <div className="container mx-auto flex justify-between items-center px-4 sm:px-6">
                    {/* Logo + Label */}
                    <div>
                        <Link to="/" className="text-2xl font-bold text-white hover:underline block">
                            SolBetX - {constants.NETWORK_NAME} - v0.9
                        </Link>
                        <p className="text-sm text-gray-300">Open Source No-Token Smart contract betting platform resolved by Truth.it network</p>
                        
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden sm:flex items-center gap-6">
                        <Link to="/" className="text-white text-sm hover:text-yellow-400 transition">
                            Home
                        </Link>
                        {publicKey && (
                            <Link
                                to="/dashboard"
                                className="text-white text-sm hover:text-yellow-400 transition"
                            >
                                My Bets
                            </Link>
                        )}
                        
                        <Link to="/instructions" className="hover:underline text-gray-300">
                            Instructions
                        </Link>
                        
                        <a
                            href={constants.SWITCH_LINK_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white text-sm hover:text-yellow-400 transition"
                        >
                            {constants.SWITCH_LINK_LABEL}
                        </a>
                        
                        <WalletMultiButton />
                    </nav>

                    {/* Mobile Hamburger */}
                    <button
                        className="sm:hidden !bg-blue-400 text-white"
                        onClick={() => setIsMenuOpen((prev) => !prev)}
                    >
                        {isMenuOpen ? <FaTimes size={22} /> : <FaBars size={22} />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <div className="sm:hidden bg-gray-700 border-t border-gray-600 mt-2 px-4 py-3 space-y-3 text-center z-10">
                        <Link
                            to="/"
                            className="block text-white text-sm hover:text-yellow-400"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            Home
                        </Link>
                        <Link to="/instructions" className="hover:underline text-gray-300">
                            Instructions
                        </Link>
                        <div>
                            <a
                                href={constants.SWITCH_LINK_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white text-sm hover:text-yellow-400 transition"
                            >
                                {constants.SWITCH_LINK_LABEL}
                            </a>
                        </div>
                        {publicKey && (
                            <Link
                                to="/dashboard"
                                className="block text-white text-sm hover:text-yellow-400"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                My Bets
                            </Link>
                        )}
                        <div className="flex justify-center">
                            <WalletMultiButton />
                        </div>
                    </div>
                )}
            </header>
            
        </>
    );
};

export default Header;
