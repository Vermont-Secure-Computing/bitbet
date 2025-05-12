import React from "react";

export default function InstructionsPage() {
  return (
    <div className="flex flex-col flex-1 min-h-screen px-6 py-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">SolBetX Instructions</h1>
      <p className="mb-6">
        Please read all instructions! This is an open source project, there is no guarantee of any kind provided by the authors of the software. Please understand and be aware of all risks related with smart contract errors and vulnerabilities. Use at your own risk!
      </p>

      <h2 className="text-xl font-semibold mb-2">SOLBETX INSTRUCTIONS</h2>
      <ol className="list-decimal list-inside space-y-4 mb-6">
        <li>
          SolbetX is a community binary betting contract.  The events available for wager on the contract are all submitted by users.  The result of the event is determined by the Truth.it.com binary oracle.
          </li>
        <li>
          <strong> Rewards:</strong>
          1% of all the coin wagered on a given event are rewarded to the address which initiated the betting event.  A further 1% of the coin goes to the SolbetX development fund address.  Another 1% goes to the Truth.It network for providing the result of the event,  thus determining the winners of the bet.  The remaining 97% of all bets are distributed among the betters on the favorable side of the event (the winners) according to their share as determined by the amount of their bet.

          <strong> Odds: </strong>
          The odds of a given bet are determined automatically through the reward mechanism, and are not fixed until the betting time period is over.  If you have a bet on the winning side, you have some fraction F of the winning bets.  Your reward is that fracion F multiplied by the total amount in the bet on both sides.

          For example consider an event "The Celtics are the 2025 NBA Champions" which has 30 solana on the "false" side and 10 solana on the "true" side.  This is a total of 40 solana on the table with 25% of the total bet on "false".  Suppose that one of these solana is your bet on "true", that the Celtice will win.  If the bet resolves to "true", your reward is 10 percent (your share of the total "true" bets) times forty ("total on all bets"), and you receive 4 solana reward, making this scenario 4 to 1 odds.


          <strong> Creating an Event: </strong>

          To create an event for betting requires two transactions on Solana.  Use the "create event" button to create an event by entering an event statement in the text box and selecting the event resolution date and time.  When you click "create" the transactions will be initiaed to add your event to the smart contract and your solana wallet should pop up for approval.  The first is a deposit of 0.1 solana which all goes to the Truth.It network which will resolve the bet.  The second is a solana "rent fee" required to store the data of the event.  This fee will be refunded with any rewards when the event is complete.  1% of all bets placed on your event will be available to you when the event is complete.  Rewards must be claimed by using the "claim rewards" button upon event finalization.  Please be careful to state your event result as a statement which is either "true" or "false" for proper resolution!  Remember to claim your rewards!

        </li>
        <li></li>
      </ol>

      <h2 className="text-xl font-semibold mb-2">GUIDELINES</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>
          <strong>Legal</strong> Gambling can be addictive, please play responsibly!  It is your responsibility to determine if use of cryptocurrency in this smart contract is permitted in your jurisdicion.

        </li>
        <li>
          <strong>Technical:</strong> This webpage front end you are now viewing can be run locally from your own machine by following the instructions at the github repository.  It is recommended to run it locally for optimal response and security.  All information is stored on the solana blockchain; there is no physical server associated with data on the solbetx smart contract apart from the servers running solana nodes.  The smart contract is not editable, upgradeable, or reversible.  Please use responsibly.

        </li>
      </ul>
    </div>
  );
}
