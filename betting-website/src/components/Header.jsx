import { useState } from "react";
import { Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { FaBars, FaTimes, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { getConstants } from "../constants";
import VersionDropdown from "./VersionDropdown";


const Header = () => {
    const { publicKey } = useWallet();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const constants = getConstants();
    
    return (
        <>
            <header className="w-full bg-gray-800 py-4 shadow-lg">
                <div className="max-w-7xl mx-auto flex flex-wrap md:flex-nowrap items-center justify-between px-4 gap-4">
                    {/* Logo + Label */}
                    <div className="flex-1 min-w-[220px]">
                        <Link to="/" className="text-xl md:text-2xl font-bold text-white hover:underline block">

                            SolBetX - {constants.NETWORK_NAME} {constants.VERSION_NAME}
                        </Link>
                        <p className="text-sm text-gray-300">Community Prediction Market</p>
                        
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-4 xl:gap-6 flex-wrap">
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

                        {/* <a
                            href={constants.SWITCH_LINK_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white text-sm hover:text-yellow-400 transition"
                        >
                            {constants.SWITCH_LINK_LABEL}
                        </a> */}
                        
                        <div className="max-w-[140px] sm:max-w-[180px]">
                            <WalletMultiButton className="truncate w-full !text-sm !px-2" />
                        </div>

                        {/* Version Dropdown */}
                        <VersionDropdown />

                    </nav>

                    {/* Mobile Hamburger */}
                    <div className="md:hidden">
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="!bg-blue-400 text-white">
                            {isMenuOpen ? <FaTimes size={22} /> : <FaBars size={22} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <div className="md:hidden bg-gray-700 border-t border-gray-600 mt-2 px-4 py-3 space-y-3 text-center z-10">
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
                        {/* <div>
                            <a
                                href={constants.SWITCH_LINK_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white text-sm hover:text-yellow-400 transition"
                            >
                                {constants.SWITCH_LINK_LABEL}
                            </a>
                        </div> */}
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
                        
                        {/* Version Dropdown */}
                        <VersionDropdown />
                        
                    </div>
                )}
            </header>
            
        </>
    );
};

export default Header;
