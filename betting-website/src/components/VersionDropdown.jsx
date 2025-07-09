import { useState, useEffect, useRef } from "react";
import { FaChevronDown, FaChevronUp, FaCheckSquare } from "react-icons/fa";
import { getConstants } from "../constants";

const VersionDropdown = () => {
    const constants = getConstants();
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef(null);

    const currentVersion = (import.meta.env.VITE_VERSION || "").toLowerCase();

    const toggleDropdown = () => setOpen(!open);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={toggleDropdown}
                className="flex items-center gap-1 text-blue text-sm !bg-gray-600 hover:text-yellow-400 transition"
            >
                Select Version {open ? <FaChevronUp /> : <FaChevronDown />}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 bg-gray-800 border border-gray-400 rounded shadow-lg z-50 w-56 text-left">
                    {constants.AVAILABLE_VERSIONS.map((version) => {
                        const versionLabel = version.label || "";
                        const versionMatch = version.value?.toLowerCase() === currentVersion;

                        return (
                            <a
                                key={versionLabel}
                                href={version.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex justify-between items-center px-4 py-2 text-sm ${
                                    versionMatch
                                        ? "font-bold !text-yellow-400"
                                        : "text-gray-300 hover:text-yellow-200"
                                }`}
                            >
                                <span>{version.label}</span>
                                {versionMatch && <FaCheckSquare />}
                            </a>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default VersionDropdown;
