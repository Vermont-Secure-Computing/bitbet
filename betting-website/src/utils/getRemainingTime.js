export const getTimeRemaining = (closeTimestamp) => {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = closeTimestamp - now;

    if (timeLeft <= 0) {
        return "Betting has closed.";
    }

    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    if (hours > 0) {
        return `Betting will close in ${hours} hour${hours > 1 ? "s" : ""}`;
    } else if (minutes > 0) {
        return `Betting will close in ${minutes} minute${minutes > 1 ? "s" : ""}`;
    } else {
        return `Betting will close in ${seconds} second${seconds > 1 ? "s" : ""}`;
    }
};


