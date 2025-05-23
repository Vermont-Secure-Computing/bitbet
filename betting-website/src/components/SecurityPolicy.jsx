import React from "react";
import { FaCheckCircle } from "react-icons/fa";

export default function SecurityPolicy() {
    return (
        <section className="max-w-4xl mx-auto px-4 py-12 text-gray-100">
            <h1 className="text-3xl font-bold mb-6">Security Policy – SolBetX</h1>

            <p className="mb-4">
                At <strong>SolBetX</strong>, our mission is to create a secure, decentralized betting protocol that relies on community-driven outcomes using the <strong>Truth-Network</strong> as a source of validation.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-3">Smart Contract Overview</h2>
            <span className="ml-2 inline-flex items-center text-green-400 text-sm font-medium">
                <FaCheckCircle className="mr-1" />
                Verified on Solana Explorer
            </span>
            <ul className="list-disc pl-6 mb-4">
                <li>Program ID: 
                    <a 
                        href="https://explorer.solana.com/address/9XiAk8AJVCWkypFstaRERag2DeKgtSergJR4PqTYeV9C"
                        target="_blank"
                        className="px-2 break-all text-blue-400 hover:underline"
                    > 
                        9XiAk8AJVCWkypFstaRERag2DeKgtSergJR4PqTYeV9C
                    </a>
                    
                </li>
                <li>Source: <a className="text-blue-600 hover:underline" href="https://github.com/Vermont-Secure-Computing/bitbet" target="_blank">GitHub Repo</a></li>
                <li>Security metadata embedded using <code>solana-security-txt</code></li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-3">Key Security Features</h2>
            <ul className="list-disc pl-6 mb-4">
                <li><strong>Reentrancy Guard</strong> via <code>action_in_progress</code> flag in an event</li>
                <li><strong>Commission Control</strong> ensures house and creator commissions are only transferred once</li>
                <li><strong>97% Refund Guarantee:</strong>: One-sided bets or undecided outcomes are refunded at 97%</li>
                <li><strong>Truth-Network Integration</strong> for unbiased community validation, where the event winner is determined</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-3">Risks and Considerations</h2>
            <ul className="list-disc pl-6 mb-4">
                <li>This contract depends on the external <strong><a href="https://truth.it.com/" target="_blank">Truth-Network</a></strong>. Malicious actors influencing vote outcomes could affect fairness.</li>
                <li>Users are responsible for validating the official <strong>SolBetX</strong> smart contract address before interacting.</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-3">Bug Bounty & Disclosure</h2>
            <p className="mb-4">
                If you find a critical bug / vulnerabilities in the BitBet smart contract, please contact us:
            </p>
            <ul className="list-disc pl-6 mb-4">
                <li>Email: <a href="mailto:office@vtscc.org" className="text-blue-600 hover:underline">office@vtscc.org</a></li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-3">Security Audit</h2>
            <p className="mb-4">
                An internal audit has been performed by <strong>Vermont Secure Computing Consultancy (VTSCC)</strong>. We recommend all users validate the program hash using our GitHub repository and <code>solana-verify</code>.
            </p>
        </section>
    );
}
