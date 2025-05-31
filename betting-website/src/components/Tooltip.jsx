import React, { useEffect, useRef } from "react";

export default function Tooltip({ children, onClose, position = "top" }) {
    const tooltipRef = useRef();

    useEffect(() => {
        function handleClickOutside(event) {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
                onClose();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    const positionClass = {
        top: "bottom-full mb-2",
        bottom: "top-full mt-2",
        left: "right-full mr-2",
        right: "left-full ml-2",
    }[position];

    return (
        <div
            ref={tooltipRef}
            className={`absolute z-50 p-3 bg-gray-800 text-white text-xs rounded-md shadow-lg max-w-xs sm:max-w-sm break-words ${positionClass}`}
        >
            {children}
        </div>
    );
}
