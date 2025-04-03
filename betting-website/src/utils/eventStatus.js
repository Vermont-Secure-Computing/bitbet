
export function getQuestionStatus({ closeDate, revealEndTime, finalized, truthNetworkWinner, winningPercentage, bettorData }) {
    const now = Date.now() / 1000;
  
    if (now < closeDate.getTime() / 1000) {
        return {
            label: "Open for betting",
            className: "text-green-400",
        };
    }
  
    if (now >= closeDate.getTime() / 1000 && now < revealEndTime) {
        return {
            label: "Waiting for resolution",
            className: "text-yellow-400",
        };
    }
  

    if (
        bettorData && 
        finalized &&
        truthNetworkWinner !== null && 
        bettorData.chosenOption === truthNetworkWinner && 
        winningPercentage >= 75 && 
        !bettorData.claimed
    ) {
        return {
            label: "Ready for collecting winnings",
            className: "text-blue-400",
          };
    }

    if (
        bettorData && 
        finalized &&
        truthNetworkWinner !== null &&
        winningPercentage < 75 && 
        !bettorData.claimed
    ) {
        return {
            label: "Ready for collecting refund",
            className: "text-blue-400",
          };
    }

    if (bettorData && bettorData.claimed) {
        return {
            label: "Winnings Claimed!",
            className: "text-green-400",
        }
    }
  
    return {
        label: "Ready for fetching result from the Truth-Network.",
        className: "text-green-400",
    };
}
  