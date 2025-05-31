import React, { useState } from "react";
import Tooltip from "./Tooltip";
import { AiOutlineInfoCircle } from "react-icons/ai";

export default function InfoWithTooltip({ label, tooltip, position = "top", children }) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative w-full mb-3">
            <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                {label}
                <span
                    className="text-blue-600 cursor-pointer ml-1"
                    onClick={() => setVisible(!visible)}
                >
                    <AiOutlineInfoCircle />
                </span>
            </label>

            {children}

            {visible && (
                <Tooltip onClose={() => setVisible(false)} position={position}>
                    {tooltip}
                </Tooltip>
            )}
        </div>
    );
}
