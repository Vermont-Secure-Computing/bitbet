import { Connection, PublicKey } from '@solana/web3.js';
import { useEffect, useRef, useState } from 'react';
import { getConstants } from "../constants";

const isValidPublicKey = (key) => {
    try {
        return new PublicKey(key) instanceof PublicKey;
    } catch {
        return false;
    }
};

const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};

export const useBetChartData = (questionPda, refreshKey, viewMode = 'hourly') => {
    const constants = getConstants();
    const FALLBACK_RPCS = constants.FALLBACK_RPC_URLS || [constants.DEFAULT_RPC_URL];

    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const fetchedMapRef = useRef({});

    useEffect(() => {
        if (!questionPda || !isValidPublicKey(questionPda)) return;

        const txFetchKey = `${questionPda}_tx`;
        const QUESTION_PDA = new PublicKey(questionPda);
        const cacheKey = `bet_tx_cache_${questionPda}`;
        const cached = JSON.parse(sessionStorage.getItem(cacheKey) || '{}');
        const processedTxs = { ...cached };

        const getValidTransactionConnection = async (address, limit = 50) => {
            for (const url of FALLBACK_RPCS) {
                const conn = new Connection(url, 'confirmed');
                try {
                    const sigs = await conn.getSignaturesForAddress(address, { limit });
                    const hasValid = sigs.some(sig => !!sig.signature);
                    if (hasValid) {
                        console.log(`Using RPC with data: ${url}`);
                        return { conn, sigs };
                    } else {
                        console.warn(`⚠️ No valid txs at ${url}`);
                    }
                } catch (err) {
                    console.warn(`Failed RPC: ${url}`, err.message);
                }
            }
            throw new Error("No working RPC returned transaction data.");
        };

        const fetchData = async () => {
            try {
                const resultMap = {};

                if (!fetchedMapRef.current[txFetchKey]) {
                    const { conn: connection, sigs } = await getValidTransactionConnection(QUESTION_PDA);
                    const newSigs = sigs.filter(sig => !processedTxs[sig.signature]);
                    const chunks = chunkArray(newSigs, 5);

                    for (const chunk of chunks) {
                        const txs = await Promise.all(
                            chunk.map(sigInfo =>
                                connection.getParsedTransaction(sigInfo.signature, { commitment: 'confirmed' })
                            )
                        );

                        for (const tx of txs) {
                            if (!tx || !tx.meta?.logMessages || !tx.blockTime) continue;

                            const logs = tx.meta.logMessages;
                            const isPlaceBet = logs.some(log => log.includes('Instruction: PlaceBet'));
                            if (!isPlaceBet) continue;

                            const betLog = logs.find(log => log.includes('placed a bet of'));
                            const match = betLog?.match(/placed a bet of (\d+) on option (true|false)/);
                            if (!match) continue;

                            const amountLamports = parseInt(match[1]);
                            const option = match[2];
                            const amountSol = amountLamports / 1_000_000_000;

                            const blockTime = new Date(tx.blockTime * 1000);
                            const hourKey = blockTime.toISOString().slice(0, 13);
                            const dateKey = blockTime.toISOString().split('T')[0];

                            processedTxs[tx.transaction.signatures[0]] = {
                                hourKey,
                                dateKey,
                                option,
                                amountSol,
                            };
                        }

                        await new Promise(res => setTimeout(res, 200));
                    }

                    sessionStorage.setItem(cacheKey, JSON.stringify(processedTxs));
                    fetchedMapRef.current[txFetchKey] = true;
                }

                Object.values(processedTxs).forEach(({ hourKey, dateKey, option, amountSol }) => {
                    const key = viewMode === 'hourly' ? hourKey : dateKey;
                    if (!resultMap[key]) resultMap[key] = { true: 0, false: 0 };
                    resultMap[key][option] += amountSol;
                });

                const parseDateKey = (key) => {
                    if (key.includes('T') && key.length === 13) {
                        return new Date(`${key}:00:00`);
                    }
                    return new Date(`${key}T00:00:00`);
                };

                const sortedEntries = Object.entries(resultMap).sort(([dateA], [dateB]) => {
                    return parseDateKey(dateA).getTime() - parseDateKey(dateB).getTime();
                });

                let runningTrue = 0;
                let runningFalse = 0;

                const sorted = sortedEntries.map(([date, values]) => {
                runningTrue += values.true || 0;
                runningFalse += values.false || 0;
                const total = runningTrue + runningFalse;
                const truePercent = total > 0 ? (runningTrue / total) * 100 : 0;

                return {
                    date,
                    true: truePercent
                };
                });

                setChartData(sorted);
            } catch (err) {
                console.error("Error fetching chart data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [questionPda, refreshKey, viewMode]);

    return { chartData, loading };
};
