import React from "react";

export default function InstructionsPage() {
  return (
    <div className="flex flex-col flex-1 min-h-screen px-6 py-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">SolBetX Instructions</h1>
      <p className="mb-6">
        Please read all instructions. This is an open source project, there is no guarantee of any kind provided by the authors of the software. Please understand and be aware of all risks related with smart contract errors. Use at your own risk!
      </p>

      <h2 className="text-xl font-semibold mb-2">SOLBETX INSTRUCTIONS</h2>
      <ol className="list-decimal list-inside space-y-4 mb-6">
        <li>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
        </li>
        <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit</li>
      </ol>

      <h2 className="text-xl font-semibold mb-2">GUIDELINES</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>
          <strong>First:</strong> Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </li>
        <li>
          <strong>Second:</strong> Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </li>
      </ul>
    </div>
  );
}
