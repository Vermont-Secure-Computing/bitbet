
export function getQuestionStatus({ closeDate, revealEndTime, finalized, truthNetworkWinner, winningPercentage, bettorData, bettingData }) {
    const now = Date.now() / 1000;

    console.log("closeDate: ", closeDate)
    console.log("revealEndTime: ", revealEndTime)
    console.log("finalized: ", finalized)
    console.log("truthNetworkWinner: ", truthNetworkWinner)
    console.log("winningPercentage: ", winningPercentage)
    console.log("bettorData.chosenOption: ", bettorData?.chosenOption)
    console.log("totalBetsOption1: ", parseFloat(bettingData?.totalBetsOption1))
    console.log("totalBetsOption2: ", parseFloat(bettingData?.totalBetsOption2))
  
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
        !bettorData.claimed &&
        parseFloat(bettingData?.totalBetsOption1) > 0 &&
        parseFloat(bettingData?.totalBetsOption2) > 0
    ) {
        return {
            label: "Ready for collecting winnings",
            className: "text-green-400",
          };
    }

    if (
        bettorData && 
        finalized &&
        truthNetworkWinner !== null && 
        bettorData.chosenOption !== truthNetworkWinner && 
        winningPercentage >= 75 && 
        !bettorData.claimed &&
        parseFloat(bettingData?.totalBetsOption1) > 0 &&
        parseFloat(bettingData?.totalBetsOption2) > 0
    ) {
        return {
            label: "Your chosen option didn’t match the winning result. You didn’t win this event.",
            className: "text-blue-400",
          };
    }

    if (
        bettorData && 
        finalized &&
        truthNetworkWinner !== null &&
        (winningPercentage < 75 || (winningPercentage >= 75 && (bettingData?.totalBetsOption1 == 0 || bettingData?.totalBetsOption2 == 0))) && 
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

    if (
        !bettorData && 
        finalized
    ) {
        return {
            label: "The Event has closed.",
            className: "text-blue-400",
          };
    }
  
    return {
        label: "Ready for fetching result from the Truth-Network.",
        className: "text-green-400",
    };
}
  