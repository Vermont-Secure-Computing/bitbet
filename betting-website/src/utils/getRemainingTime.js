/**
 * Utility function that determines the time remaining
 * before an event betting is closed
 * @param {*} closeTimestamp 
 * @returns 
 */
export const getTimeRemaining = (closeTimestamp) => {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = closeTimestamp - now;

    if (timeLeft <= 0) {
        return "Betting has closed.";
    }

    const days = Math.floor(timeLeft / 86400); // 86400 seconds in a day
    const hours = Math.floor((timeLeft % 86400) / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    if (days > 0) {
        if (hours > 0) {
            return `Betting will close in ${days} day${days > 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
        } else {
            return `Betting will close in ${days} day${days > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }
    } else if (hours > 0) {
        return `Betting will close in ${hours} hour${hours > 1 ? "s" : ""}`;
    } else if (minutes > 0) {
        return `Betting will close in ${minutes} minute${minutes > 1 ? "s" : ""}`;
    } else {
        return `Betting will close in ${seconds} second${seconds > 1 ? "s" : ""}`;
    }
};


