/**
 * Utility function that determines the time remaining
 * before an event betting is closed
 * @param {*} closeTimestamp 
 * @returns 
 */

import { FaCheckCircle, FaHourglassHalf, FaTimesCircle } from 'react-icons/fa';

export const getTimeRemaining = (closeTimestamp, winner = 0, winningPercentage = 0, houseCommissionClaimed) => {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = closeTimestamp - now;

    if (timeLeft <= 0) {
        if (!houseCommissionClaimed) {
            // Betting ended, but truth network has not finalized yet
            return (
                <span className="flex items-center gap-1 text-blue-300">
                    <FaHourglassHalf /> Waiting for Truth.it resolution
                </span>
            );
        } else if (houseCommissionClaimed && winningPercentage >= 75) {
            return (
                <span className="flex items-center gap-1 text-green-400">
                    <FaCheckCircle /> Winner: {winner === 1 ? 'True' : 'False'}
                </span>
            );
        } else if (houseCommissionClaimed && winningPercentage > 0 && winningPercentage < 75) {
            return (
                <span className="flex items-center gap-1 text-yellow-300">
                    <FaTimesCircle /> Winning percentage less than 75%. No winner declared
                </span>
            );
        } else {
            return (
                <span className="flex items-center gap-1 text-red-400">
                    <FaTimesCircle /> No votes were cast. No winner declared.
                </span>
            );
        }
    }

    const days = Math.floor(timeLeft / 86400); // 86400 seconds in a day
    const hours = Math.floor((timeLeft % 86400) / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    let message = '';

    if (days > 0) {
        if (hours > 0) {
            message = `Betting will close in ${days} day${days > 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
        } else {
            message = `Betting will close in ${days} day${days > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }
    } else if (hours > 0) {
        message = `Betting will close in ${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
        message = `Betting will close in ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
        message = `Betting will close in ${seconds} second${seconds > 1 ? 's' : ''}`;
    }

    return (
        <span className="flex items-center gap-1 text-green-400">
            <FaHourglassHalf />
            {message}
        </span>
    );
};


