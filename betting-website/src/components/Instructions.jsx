import React from "react";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const rewardData = {
  labels: ["Event Creator (1%)", "Dev Fund (1%)", "Truth Network (1%)", "Winners (97%)"],
  datasets: [
    {
      data: [1, 1, 1, 97],
      backgroundColor: ["#f59e0b", "#ef4444", "#3b82f6", "#10b981"],
      borderColor: ["#ffffff"],
      borderWidth: 1,
    },
  ],
};

export default function InstructionsPage() {
  return (
    <div className="flex flex-col flex-1 px-4 py-6 md:px-6 lg:px-8 max-w-4xl mx-auto text-sm text-gray-200">
      <h1 className="text-2xl font-bold mb-4 text-center text-white">SolBetX Instructions</h1>

      <p className="mb-6 text-justify">
         Please read all instructions! This is an open source project, there is no guarantee of any kind provided by the authors of the software. Please understand and be aware of all risks related with smart contract errors and vulnerabilities. Use at your own risk!       
      </p>

      <p className="mb-6 text-justify">
        <strong> SolbetX</strong> is a community binary betting contract.  The events available for wager on the contract are all submitted by users.  The result of the event is determined by the Truth.it.com binary oracle.
      </p>

      <h2 className="text-xl font-semibold mb-3 text-yellow-400">1. Creating an Event</h2>
      <p className="mb-6 text-justify">
        To create an event for betting requires two transactions on Solana.  Use the "Create Event" button to create an event by entering an event statement in the text box and selecting the event resolution date and time.  When you click "create" the transactions will be initiated to add your event to the smart contract and your solana wallet should pop up for approval.  The first is a deposit of 0.1 solana which all goes to the Truth.It network which will resolve the bet.  The second is a solana "rent fee" required to store the data of the event.  This fee will be refunded with any rewards when the event is complete.  1% of all bets placed on your event will be available to you when the event is complete.  Rewards must be claimed by using the "claim rewards" button upon event finalization.  Please be careful to state your event result as a statement which is either "true" or "false" for proper resolution!  Remember to claim your rewards!
      </p>

      <p className="font-bold">Form fields:</p>
      <ul className="list-disc list-inside mb-6 space-y-3">
        <li>
          <strong>Title:</strong> Title of the event. Should be phrased as True or False statement.
        </li>
        <li>
          <strong>Betting Close Date:</strong> The final time users can place a bet.
        </li>
        <li>
          <strong>Default Resolution Dates:</strong> Commit = +1 day, Reveal = +2 days after betting close.
        </li>
        <li>
          <strong>Custom Dates:</strong> Event creator can enter custom dates for the commit and reveal end time. Minimum 1 hour between commit & reveal.
        </li>
        <li>
          Event creation triggers two transactions:
          <ul className="list-disc list-inside ml-4 mt-1">
            <li><strong>First-Time Creators:</strong> You must initialize your own on-chain <em>Question Counter</em>.</li>
            <li>Store question in Truth Network</li>
            <li>Create betting question in SolBetX contract</li>
          </ul>
        </li>
      </ul>

      <h2 className="text-xl font-semibold mb-3 text-yellow-400">2. Reward Distribution</h2>
      <div className="my-4 max-w-xs mx-auto">
        <Pie data={rewardData} />
      </div>
      <p className="mb-6 text-justify">
        1% of all the coin wagered on a given event are rewarded to the address which initiated the betting event.  A further 1% of the coin goes to the SolbetX development fund address.  Another 1% goes to the Truth.It network for providing the result of the event,  thus determining the winners of the bet.  The remaining 97% of all bets are distributed among the betters on the favorable side of the event (the winners) according to their share as determined by the amount of their bet.
      </p>

      <h2 className="text-xl font-semibold mb-3 text-yellow-400">3. Odds </h2>
      <p className="mb-6 text-justify">
        The odds of a given bet are determined automatically through the reward mechanism, and are not fixed until the betting time period is over.  If you have a bet on the winning side, you have some fraction F of the winning bets.  Your reward is that fraction F multiplied by the total amount in the bet on both sides.
      </p>
      <p className="mb-4 text-justify">
        Rewards are calculated using:
        <code className="block bg-gray-800 mt-2 p-2 rounded text-xs overflow-x-auto">
          Your Reward = (Your Bet / Total Winning Side Bets) × Total Pool (after 3%)
        </code>
      </p>
      <div className="flex">
        <img src="./bitbet-odds.png" />
      </div>
      <p className="my-2">
        For example consider an event "The Celtics are the 2025 NBA Champions" which has 30 solana on the "false" side and 10 solana on the "true" side.  This is a total of 40 solana on the table with 25% of the total bet on "false".  Suppose that one of these solana is your bet on "true", that the Celtice will win.  If the bet resolves to "true", your reward is 10 percent (your share of the total "true" bets) times forty ("total on all bets"), and you receive 4 solana reward, making this scenario 4 to 1 odds.
      </p>

      <h2 className="text-xl font-semibold mb-3 text-yellow-400">4. Result Breakdown</h2>
      <p className="text-justify mb-6">
        All results are <strong>fetched from the Truth Network</strong>.
      </p>
      <p className="mb-2 text-justify">
        Example:
      </p>
      <pre className="bg-gray-800 p-3 rounded-md text-sm overflow-auto mb-4 whitespace-pre-line">
        Winner: True
        {"\n"}Consensus: 85% (17 / 20 voters)
        {"\n"}Vote Breakdown: True 85% · False 15%
        {"\n"}Resolution Source: https://truth.it.com/event/xxxxx
      </pre>
      <p className="text-justify mb-6">
          Note: A winner is declared only if the winning percentage is
          <strong> 75% or higher</strong>. Otherwise, the event is considered
          <strong> unresolved</strong>, and all users can claim a
          <strong> refund</strong> of their bet.
      </p>


      <h2 className="text-xl font-semibold mb-3 text-yellow-400">5. Event Status Guide</h2>
      <ul className="list-disc list-inside space-y-2 mb-6">
        <li>
          <strong>Betting will close in (x) days (x) hours : </strong>  
          The event is active. You can still place your bets before the timer runs out.
        </li>
        <li>
          <strong>Waiting for resolution: </strong>  
          Betting has ended. The system is now in the commit/reveal phase before the result is finalized.
        </li>
        <li>
          <strong>Ready to fetch result: </strong>  
          The commit/reveal period is over. Anyone can now fetch the final result from the Truth Network.
        </li>
        <li>
          <strong>Ready to collect winnings: </strong>  
          A winning side has been determined. If your choice was correct, you can now claim your rewards.
        </li>
        <li>
          <strong>Your chosen option didn’t match the winning result. You didn’t win this event: </strong>  
          The result has been finalized and your chosen option didn’t win.
        </li>
        <li>
          <strong>Ready for refund: </strong>  
          No clear winner was found (consensus below 75%). All participants can now claim a full refund.
        </li>
        <li>
          <strong>The event has closed: </strong>  
          All outcomes are finalized and all eligible claims have been made. This event is now complete.
        </li>
      </ul>


      
      <h2 className="text-xl font-semibold mb-3 text-yellow-400">6. GUIDELINES</h2>
       <ul className="list-disc list-inside space-y-2 mb-6">
         <li className="text-justify">
           <strong>Legal : </strong> Gambling can be addictive, please play responsibly!  It is your responsibility to determine if use of cryptocurrency in this smart contract is permitted in your jurisdiction.

         </li>
         <li className="text-justify">
           <strong>Technical : </strong> This webpage front end you are now viewing can be run locally from your own machine by following the instructions at the github repository.  It is recommended to run it locally for optimal response and security.  All information is stored on the solana blockchain; there is no physical server associated with data on the solbetx smart contract apart from the servers running solana nodes.  The smart contract is not editable, upgradeable, or reversible.  Please use responsibly.

         </li>

         <li className="text-justify">
            <strong>RPC Performance Tip: </strong>
            If you're experiencing slowness or timeouts while using SolBetX, it's likely due to congestion on the default public Solana RPC nodes. You can set your own custom RPC URL for faster performance and stability. Click the Network Settings located at the footer of the page to enter your RPC URL.
         </li>
        </ul>


        <h2 className="text-xl font-semibold mb-3 text-yellow-400">7. How SolBetX Handles RPC Requests:</h2>

        <p className="text-justify mt-4">
          By default, SolBetX uses the public RPC node at{" "}
          <code className="bg-gray-800 px-1 py-0.5 rounded">https://solana-rpc.publicnode.com</code>{" "}
          to connect to the Solana network. To improve reliability—especially during periods of high traffic or when rate limits are hit—the app performs a{" "}
          <strong>round-robin fallback</strong> across multiple RPC endpoints:
        </p>

        <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
          <li>
            <code className="bg-gray-800 px-1 py-0.5 rounded">https://solana-rpc.publicnode.com</code>
          </li>
          <li>
            <code className="bg-gray-800 px-1 py-0.5 rounded">https://go.getblock.io/4136d34f90a6488b84214ae26f0ed5f4</code>
          </li>
          <li>
            <code className="bg-gray-800 px-1 py-0.5 rounded">https://api.mainnet-beta.solana.com</code>
          </li>
        </ul>

        <p className="text-justify mt-2">
          If a request fails or returns a rate-limit error, SolBetX will automatically retry using the next available RPC in the list. This ensures smoother performance without requiring user action.{" "}
          <strong>However, public RPC nodes can still experience delays or reach rate limits during peak usage.</strong> For optimal reliability and speed, we recommend using a private RPC endpoint.
        </p>

        <p className="text-justify mt-4 font-semibold">Where to get a custom RPC URL:</p>
        <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
          <li>
            <a
              className="text-blue-500 underline"
              href="https://dashboard.helius.dev/signup?redirectTo=onboarding"
              target="_blank"
              rel="noopener noreferrer"
            >
              Helius (https://www.helius.dev/)
            </a>
          </li>
          <li>
            <a
              className="text-blue-500 underline"
              href="https://www.alchemy.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Alchemy (https://www.alchemy.com/)
            </a>
          </li>
          <li>
            <a
              className="text-blue-500 underline"
              href="https://www.quicknode.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              QuickNode (https://www.quicknode.com/)
            </a>
          </li>
        </ul>

        <p className="text-justify mt-2">
          You can also visit{" "}
          <a
            href="https://www.comparenodes.com/library/public-endpoints/solana/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline"
          >
            https://www.comparenodes.com/library/public-endpoints/solana/
          </a>{" "}
          to explore and compare public Solana RPC providers.
        </p>


        <br />
        <strong>How to set your custom RPC in SolBetX:</strong>
        <ol className="list-decimal list-inside ml-4 space-y-1 mt-2">
          <li>Create an account on one of the RPC provider websites above.</li>
          <li>Most providers offer a free plan — choose one based on your usage.</li>
          <li>Make sure the <strong>Mainnet</strong> network is selected.</li>
          <li>Copy the RPC URL provided by the dashboard.</li>
          <li>On SolBetX, click the <strong>Network Settings</strong> to open the modal where you can set your own RPC url.</li>
          <li>Paste your RPC URL and save. The app will now use your private endpoint.</li>
        </ol>

        <br />
        <p className="text-justify mt-2">
          Your RPC preference will be saved locally in your browser.
        </p>
         
    </div>
  );
}
