import { useState, useEffect, useRef } from "react";
import { FaChevronDown, FaChevronUp, FaCheckSquare } from "react-icons/fa";
import { getConstants } from "../constants";

const VersionDropdown = () => {
    const constants = getConstants();
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Toggle dropdown
    const toggleDropdown = () => setOpen(!open);

    // Close dropdown on outside click
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
                <div className="absolute right-0 mt-2 bg-gray-600 border border-gray-400 rounded shadow-lg z-50 w-48 text-left">
                    {constants.AVAILABLE_VERSIONS.map((version) => (
                        <a
                        key={version.name}
                        href={version.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block px-4 py-2 text-sm hover:bg-yellow-100 ${
                            constants.VERSION_NAME === version.name
                            ? "font-bold text-yellow-500"
                            : "text-gray-700"
                        }`}
                        >
                            {version.name}
                            {constants.VERSION_NAME === version.name && <FaCheckSquare />}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VersionDropdown;
