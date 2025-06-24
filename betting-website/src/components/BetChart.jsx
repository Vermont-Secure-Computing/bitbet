import React, { useState } from 'react';
import {
    Chart as ChartJS,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Legend,
    Title,
} from 'chart.js';
  
ChartJS.register(
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Legend,
    Title
);
import { Line } from 'react-chartjs-2';
import { FaSyncAlt, FaClock, FaCalendarDay } from 'react-icons/fa';
import { useBetChartData } from '../hooks/useBetChartData';

const BetChart = (questionPda) => {
    
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewMode, setViewMode] = useState('hourly'); // 'daily' or 'hourly'

    const { chartData, loading } = useBetChartData(questionPda.questionPda, refreshKey, viewMode);
    //console.log("chartdata and loading: ", loading, chartData, viewMode)
  
    // const labels = chartData.map(e => e.date);
    // const trueData = chartData.map(e => e.true);
    // const falseData = chartData.map(e => e.false);
  
    // const data = {
    //     labels,
    //     datasets: [
    //         {
    //             label: 'True',
    //             data: trueData,
    //             borderColor: 'green',
    //             tension: 0.2,
    //         },
    //         {
    //             label: 'False',
    //             data: falseData,
    //             borderColor: 'red',
    //             tension: 0.2,
    //         },
    //     ],
    // };
  
    // const options = {
    //     responsive: true,
    //     scales: {
    //         y: {
    //             beginAtZero: true,
    //             title: { display: true, text: 'Total Bet (SOL)' },
    //         },
    //             x: {
    //             title: { display: true, text: 'Date' },
    //         },
    //     },
    // };

    const labels = chartData.map(e => e.date);
    const truePercentages = chartData.map(e => e.true);

    const latest = chartData[chartData.length - 1];
    const latestLabel = latest ? `True Bet % (Latest: ${latest.true.toFixed(1)}%)` : 'True Bet %';

    const data = {
        labels,
        datasets: [
            {
                label: `True Bet %`,
                data: truePercentages,
                borderColor: 'green',
                tension: 0.2,
            }
        ]
    };

    const options = {
        responsive: true,
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                title: { display: true, text: 'True Bet %' },
                ticks: {
                    callback: value => `${value}%`
                }
            },
            x: {
                title: { display: true, text: viewMode === 'hourly' ? 'Hour' : 'Date' }
            }
        },
        plugins: {
            tooltip: {
                callbacks: {
                    label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
                }
            }
        }
    };

    // Chance = total_bet_true / (total_bet_true+total_bet_false) 

    console.log("chart data: ", data)
    
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end gap-4 text-sm text-gray-500">
                <span
                    className="flex items-center gap-1 cursor-pointer hover:text-white"
                    onClick={() => setRefreshKey(prev => prev + 1)}
                    title="Refresh chart"
                >
                    <FaSyncAlt className="text-xs" />
                    Refresh
                </span>

                <span
                    className="flex items-center gap-1 cursor-pointer hover:text-white"
                    onClick={() => setViewMode(viewMode === 'hourly' ? 'daily' : 'hourly')}
                    title="Switch view"
                >
                    {viewMode === 'hourly' ? (
                        <>
                            <FaCalendarDay className="text-xs" />
                            Daily
                        </>
                    ) : (
                        <>
                            <FaClock className="text-xs" />
                            Hourly
                        </>
                    )}
                </span>
            </div>

            {loading ? (
                <p className="text-gray-400">Loading chart...</p>
            ) : (
                <Line data={data} options={options} />
            )}
        </div>
    )
};


export default BetChart;