import React, { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

// Types
interface Team {
    id: number;
    name: string;
}

interface AllocationResult {
    teamId: number;
    bidPricePaise: number;
    bidVolume: number;
    rank: number;
    allocatedVolume: number;
    allocationFactor: number;
    tmBidCount: number;
}

const ControllerDashboard: React.FC = () => {
    const socket = useSocket();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');

    // Game Data
    const [gameState, setGameState] = useState<any>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [allocations, setAllocations] = useState<AllocationResult[]>([]);
    const [financialsData, setFinancialsData] = useState<any[]>([]);
    const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        if (!socket) return;

        const fetchInitial = () => socket.emit('get_initial_state');
        fetchInitial();
        socket.on('connect', fetchInitial);

        socket.on('game_state_update', (st) => {
            setGameState(st);
            // If we are past allocation phase, fetch results automatically
            if (['MONTH_START', 'CUSTOMER_AUCTION_PREROLL', 'CUSTOMER_AUCTION', 'MONTH_END'].includes(st.phase)) {
                socket.emit('get_allocations', { quarterId: st.currentQuarter || 1 });
            }
        });

        socket.on('teams_update', (t) => setTeams(t));

        socket.on('allocation_results', (res) => {
            console.log("Received allocations:", res);
            setAllocations(res);
            if (res.length > 0) setMsg('Allocations Loaded');
        });

        socket.on('game_reset', (newState) => {
            setGameState(newState);
            setTeams([]);
            setAllocations([]);
            setMsg('Game has been reset to Lobby.');
        });

        socket.on('error_message', (m) => setMsg('Error: ' + m));

        // Financials Listeners
        socket.on('all_month_financials_results', (res) => {
            console.log("Controller received financials:", res);
            setFinancialsData(res);
        });

        socket.on('leaderboard_results', (res) => {
            setLeaderboardData(res);
        });

        return () => {
            socket.off('connect', fetchInitial);
            socket.off('game_state_update');
            socket.off('teams_update');
            socket.off('allocation_results');
            socket.off('game_reset');
            socket.off('error_message');
            socket.off('all_month_financials_results');
            socket.off('leaderboard_results');
        };
    }, [socket, isAuthenticated]);

    // Fetch financials whenever we have a valid socket and gameState, or on specific phases
    useEffect(() => {
        if (!socket || !gameState) return;
        const m = gameState.currentMonthWithinQuarter || 1;
        // Fetch initially and when requested
        socket.emit('get_all_month_financials', { quarterId: gameState.currentQuarter || 1, monthId: m });

        const handleUpdate = () => {
            socket.emit('get_all_month_financials', { quarterId: gameState.currentQuarter || 1, monthId: m });
        };
        socket.on('financials_updated', handleUpdate);
        return () => { socket.off('financials_updated', handleUpdate); };
    }, [socket, gameState?.currentQuarter, gameState?.currentMonthWithinQuarter]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Simple client-side check for demo, real auth should be on connection/token
        if (passwordInput === 'admin123') {
            setIsAuthenticated(true);
        } else {
            alert("Invalid Password");
        }
    };

    const startPreroll = () => {
        if (socket) socket.emit('admin_set_phase', { phase: 'QUARTER_PREROLL', password: 'admin123' });
    };

    const openBidding = () => {
        if (socket) socket.emit('admin_set_phase', { phase: 'QUARTER_START', password: 'admin123' });
    };

    const resetGame = () => {
        if (socket) {
            socket.emit('admin_reset_game', 'admin123');
            setAllocations([]);
            setMsg('Game Reset');
        }
    };

    const processAllocations = () => {
        if (socket && gameState) {
            setMsg("Processing...");
            socket.emit('admin_process_allocations', { quarterId: gameState.currentQuarter || 1 });
        }
    };

    // LOGIN SCREEN
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded shadow-lg border border-gray-700 w-full max-w-sm">
                    <h1 className="text-2xl font-bold text-white mb-6 text-center">Admin Login</h1>
                    <input
                        type="password"
                        value={passwordInput}
                        onChange={e => setPasswordInput(e.target.value)}
                        placeholder="Admin Password"
                        className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600 mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded">
                        Enter Controller
                    </button>
                    <div className="mt-4 text-center">
                        <a href="/" className="text-gray-500 text-xs underline">Back to Game</a>
                    </div>
                </form>
            </div>
        );
    }

    if (!gameState) return <div className="text-white p-10">Loading Controller State...</div>;


    // --- New Detailed Financials Table Component ---
    const DetailedFinancialsTable = ({ data, leaderboard, forceRefresh, onRecalculate }: { data: any[], leaderboard: any[], forceRefresh: () => void, onRecalculate: () => void }) => {
        if (!data || data.length === 0) {
            return (
                <div className="p-8 text-center text-gray-500 bg-gray-900/50 rounded-lg border border-dashed border-gray-700">
                    <p className="mb-4">No financial data found for this period.</p>
                    <div className="flex justify-center gap-4">
                        <button onClick={forceRefresh} className="bg-blue-600 px-4 py-2 rounded text-white text-xs font-bold">Refresh View</button>
                        <button onClick={onRecalculate} className="bg-yellow-600 px-4 py-2 rounded text-white text-xs font-bold">Force Recalculate (Server)</button>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="flex justify-end gap-2 mb-2">
                    <button onClick={forceRefresh} className="text-blue-400 hover:text-blue-300 text-xs underline">Refresh</button>
                    <button onClick={onRecalculate} className="text-yellow-400 hover:text-yellow-300 text-xs underline">Recalculate</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-gray-300 table-auto whitespace-nowrap">
                        <thead className="bg-gray-700/50 uppercase font-bold text-gray-400">
                            <tr>
                                <th className="p-3 sticky left-0 bg-gray-800 z-10 border-r border-gray-700">Team</th>
                                <th className="p-3 text-right">M3 Val Alloc</th>
                                <th className="p-3 text-right bg-gray-800/30">Rev (Rs)</th>
                                <th className="p-3 text-right">Rev/m³</th>
                                <th className="p-3 text-right bg-red-900/10">RM Cost</th>
                                <th className="p-3 text-right">RM/m³</th>
                                <th className="p-3 text-right bg-red-900/10">TM Cost</th>
                                <th className="p-3 text-right">TM/m³</th>
                                <th className="p-3 text-right bg-red-900/10">Prod Cost</th>
                                <th className="p-3 text-right">Prod/m³</th>
                                <th className="p-3 text-right bg-green-900/20 text-white border-l border-gray-600">EBITDA</th>
                                <th className="p-3 text-right">EBITDA/m³</th>
                                <th className="p-3 text-right bg-blue-900/20 text-white font-black border-l border-blue-500">Cum. EBITDA</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {data.map((row) => {
                                // Find cumulative stats for this team
                                const lbStats = leaderboard.find(l => l.teamId === row.team_id);
                                const totalGameEBITDA = lbStats ? lbStats.totalGameEbitdaPaise : 0;
                                const vol = row.sales_vol || 0;

                                const formatVal = (val: any) => {
                                    if (isNaN(val) || val === null || val === undefined) return 'NP';
                                    return (val / 100).toLocaleString();
                                };

                                const formatPerUnit = (val: any, volume: number) => {
                                    if (isNaN(val) || val === null || val === undefined) return 'NP';
                                    if (volume <= 0) return '-';
                                    return (val / 100 / volume).toFixed(0);
                                };

                                return (
                                    <tr key={row.team_id} className="hover:bg-gray-700/30 transition-colors">
                                        <td className="p-3 font-bold text-white sticky left-0 bg-gray-800 border-r border-gray-700">
                                            {teams.find(t => t.id === row.team_id)?.name || `Team ${row.team_id}`}
                                        </td>
                                        <td className="p-3 text-right text-white font-mono">{vol.toLocaleString()}</td>
                                        <td className="p-3 text-right text-green-300 bg-gray-800/30 font-mono">{formatVal(row.revenue_paise)}</td>
                                        <td className="p-3 text-right text-gray-500 font-mono">{formatPerUnit(row.revenue_paise, vol)}</td>
                                        <td className="p-3 text-right text-red-300 bg-red-900/10 font-mono">{formatVal(row.rm_cost_paise)}</td>
                                        <td className="p-3 text-right text-gray-500 font-mono">{formatPerUnit(row.rm_cost_paise, vol)}</td>
                                        <td className="p-3 text-right text-red-300 bg-red-900/10 font-mono">{formatVal(row.tm_cost_paise)}</td>
                                        <td className="p-3 text-right text-gray-500 font-mono">{formatPerUnit(row.tm_cost_paise, vol)}</td>
                                        <td className="p-3 text-right text-red-300 bg-red-900/10 font-mono">{formatVal(row.prod_cost_paise)}</td>
                                        <td className="p-3 text-right text-gray-500 font-mono">{formatPerUnit(row.prod_cost_paise, vol)}</td>
                                        <td className={`p-3 text-right font-bold border-l border-gray-600 bg-green-900/20 font-mono ${row.ebitda_paise >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatVal(row.ebitda_paise)}
                                        </td>
                                        <td className="p-3 text-right text-gray-500 font-mono">{formatPerUnit(row.ebitda_paise, vol)}</td>
                                        <td className={`p-3 text-right font-black border-l border-blue-500 bg-blue-900/20 font-mono ${totalGameEBITDA >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                            {formatVal(totalGameEBITDA)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 font-sans">
            {/* Header */}
            <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
                <div className="flex items-center gap-4">
                    <img src="/rdc-logo.png" alt="RDC" className="h-16 opacity-90" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                        Admin Controller
                    </h1>
                </div>
                <div className="flex items-center gap-6">
                    <div className="bg-gray-800 px-4 py-2 rounded">
                        <span className="text-gray-400 text-xs uppercase tracking-wider">Phase</span>
                        <div className="font-mono text-xl text-green-400">{gameState.phase}</div>
                    </div>
                    <div className="bg-gray-800 px-4 py-2 rounded">
                        <span className="text-gray-400 text-xs uppercase tracking-wider">Quarter</span>
                        <div className="font-mono text-xl text-blue-400">{gameState.currentQuarter}</div>
                    </div>
                    <div className="bg-gray-800 px-4 py-2 rounded">
                        <span className="text-gray-400 text-xs uppercase tracking-wider">Month</span>
                        <div className="font-mono text-xl text-yellow-400">{gameState.currentMonthWithinQuarter}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Col: Financials Data (Wider) */}
                <div className="lg:col-span-12 xl:col-span-9 space-y-6">
                    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-xl">
                        <h3 className="text-xl font-bold mb-4 text-green-400 flex items-center gap-2">
                            <span>💰</span> Detailed Game Financials
                        </h3>
                        <DetailedFinancialsTable
                            data={financialsData}
                            leaderboard={leaderboardData}
                            forceRefresh={() => socket?.emit('get_all_month_financials', { quarterId: gameState.currentQuarter || 1, monthId: gameState.currentMonthWithinQuarter || 1 })}
                            onRecalculate={() => socket?.emit('admin_recalculate_financials', { quarterId: gameState.currentQuarter || 1 })}
                        />
                    </div>

                    {/* Leaderboard Section */}
                    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-xl">
                        <h3 className="text-xl font-bold mb-4 text-yellow-400 flex items-center gap-2">
                            <span>🏆</span> Leader Board
                        </h3>
                        {leaderboardData.length === 0 ? (
                            <div className="text-gray-500 italic p-4">No leaderboard data available yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-gray-300">
                                    <thead className="bg-gray-700/50 text-xs uppercase font-bold text-gray-400">
                                        <tr>
                                            <th className="p-3">Rank</th>
                                            <th className="p-3">Team</th>
                                            <th className="p-3 text-right">Total Game EBITDA</th>
                                            <th className="p-3 text-right">Current Q EBITDA</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {leaderboardData.map((row, i) => (
                                            <tr key={i} className={`hover:bg-gray-700/30 transition-colors ${i === 0 ? 'bg-yellow-900/10' : ''}`}>
                                                <td className="p-3 font-bold text-white">#{i + 1}</td>
                                                <td className="p-3 font-bold text-white">
                                                    {row.teamName} <span className="text-gray-500 text-xs font-normal">({row.teamId})</span>
                                                </td>
                                                <td className={`p-3 text-right font-bold text-lg ${row.totalGameEbitdaPaise >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    ₹{(row.totalGameEbitdaPaise / 100).toLocaleString()}
                                                </td>
                                                <td className="p-3 text-right text-gray-400">
                                                    ₹{(row.quarterEbitdaPaise / 100).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Col: Controls & Progress (Narrower) */}
                <div className="lg:col-span-12 xl:col-span-3 space-y-6">
                    {msg && (
                        <div className="bg-blue-900/20 border-l-4 border-blue-500 p-4 font-mono text-sm text-blue-200 animate-pulse">
                            {msg}
                        </div>
                    )}

                    {/* Game Controls */}
                    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                        <h3 className="text-xl font-bold mb-4 text-gray-200">Game Flow Control</h3>

                        <div className="space-y-4">
                            {/* PHASE SPECIFIC ACTIONS */}
                            {gameState.phase === 'LOBBY' && (
                                <button
                                    onClick={startPreroll}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded shadow-lg"
                                >
                                    {gameState.currentQuarter > 1 ? `START RM & TM BID FOR Q${gameState.currentQuarter}` : "Start Game Config (Announce)"}
                                </button>
                            )}

                            {gameState.phase === 'QUARTER_PREROLL' && (
                                <div className="space-y-2 p-4 bg-gray-700/50 rounded border border-blue-500/30">
                                    <div className="text-sm text-blue-200 mb-2">
                                        <span className="animate-pulse">●</span> Teams: "Get Ready..."
                                    </div>
                                    <button
                                        onClick={openBidding}
                                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded shadow-lg animate-pulse"
                                    >
                                        OPEN BIDDING NOW
                                    </button>
                                </div>
                            )}

                            {gameState.phase === 'QUARTER_START' && (
                                <div className="space-y-2">
                                    <div className="text-sm text-gray-400 mb-2">Wait for all bids...</div>
                                    <button
                                        onClick={processAllocations}
                                        className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded shadow-lg shadow-yellow-900/50"
                                    >
                                        Process Allocations & Start M1
                                    </button>
                                </div>
                            )}

                            {gameState.phase === 'MONTH_START' && (
                                <button
                                    onClick={() => socket?.emit('admin_set_phase', { phase: 'CUSTOMER_AUCTION_PREROLL', password: 'admin123' })}
                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded shadow-lg"
                                >
                                    Announce Customer Auction
                                </button>
                            )}

                            {gameState.phase === 'CUSTOMER_AUCTION_PREROLL' && (
                                <div className="space-y-2 p-4 bg-gray-700/50 rounded border border-purple-500/30">
                                    <div className="text-sm text-purple-200 mb-2">
                                        <span className="animate-pulse">●</span> Teams: "Get Ready for Auction..."
                                    </div>
                                    <button
                                        onClick={() => socket?.emit('admin_set_phase', { phase: 'CUSTOMER_AUCTION', password: 'admin123' })}
                                        className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-3 rounded shadow-lg animate-pulse"
                                    >
                                        START CUSTOMER AUCTION
                                    </button>
                                </div>
                            )}

                            {gameState.phase === 'CUSTOMER_AUCTION' && (
                                <div className="space-y-2">
                                    <div className="p-4 bg-gray-700/30 rounded text-center text-gray-400 text-sm">
                                        Monitor Auction Bids
                                    </div>
                                    <button
                                        onClick={() => socket?.emit('admin_process_customer_allocations', { quarterId: gameState.currentQuarter || 1 })}
                                        className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-3 rounded shadow-lg animate-pulse"
                                    >
                                        DECLARE VOLUME ALLOCATION
                                    </button>
                                </div>
                            )}

                            {gameState.phase === 'MONTH_END' && (
                                <div className="space-y-2">
                                    <button
                                        onClick={() => socket?.emit('admin_recalculate_financials', { quarterId: gameState.currentQuarter || 1 })}
                                        className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded text-sm shadow mb-2"
                                    >
                                        🔄 Recalculate Financials
                                    </button>
                                    <button
                                        onClick={() => socket?.emit('admin_advance_month', { quarterId: gameState.currentQuarter || 1 })}
                                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded text-sm shadow"
                                    >
                                        {(gameState.currentMonthWithinQuarter || 1) >= 3
                                            ? `End Quarter ${gameState.currentQuarter} & Start Q${(gameState.currentQuarter || 1) + 1} ▶`
                                            : `Start Month ${(gameState.currentMonthWithinQuarter || 1) + 1} ▶`
                                        }
                                    </button>
                                    <button
                                        onClick={() => socket?.emit('admin_end_game', 'admin123')}
                                        className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-4 rounded text-sm shadow mt-4 border border-red-500"
                                    >
                                        🏁 END GAME NOW
                                    </button>
                                </div>
                            )}

                            {gameState.phase === 'GAME_OVER' && (
                                <div className="space-y-4 p-4 bg-gray-700/50 rounded border border-yellow-500/50 animate-pulse">
                                    <div className="text-center">
                                        <h3 className="text-2xl font-black text-yellow-500 mb-2">GAME OVER</h3>
                                        <p className="text-gray-300 text-sm">Teams are viewing the final leaderboard.</p>
                                    </div>
                                    <button
                                        onClick={resetGame}
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded shadow-lg"
                                    >
                                        RESET & START NEW GAME
                                    </button>
                                </div>
                            )}

                            <hr className="border-gray-700 my-4" />

                            <button
                                onClick={resetGame}
                                className="w-full bg-red-900/40 hover:bg-red-900 text-red-300 font-bold py-2 rounded border border-red-800 text-sm"
                            >
                                Reset Entire Game
                            </button>

                            <button
                                onClick={() => socket?.emit('admin_sync_state', 'admin123')}
                                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 rounded border border-gray-600 text-sm"
                            >
                                📡 Force Sync/Refresh Clients
                            </button>
                        </div>
                    </div>

                    {/* Progress: RM Allocations */}
                    {allocations.length > 0 && gameState.phase !== 'MONTH_END' && (
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-xl">
                            <h3 className="text-sm font-bold mb-3 text-yellow-400 flex items-center gap-2 uppercase">
                                <span>📊</span> RM Allocation
                            </h3>
                            <div className="overflow-x-auto max-h-60 overflow-y-auto">
                                <table className="w-full text-left text-xs text-gray-300">
                                    <thead className="bg-gray-700/50 sticky top-0">
                                        <tr>
                                            <th className="p-2">Team</th>
                                            <th className="p-2 text-right">RM Bid P</th>
                                            <th className="p-2 text-right">RM Bid Q</th>
                                            <th className="p-2">Rank</th>
                                            <th className="p-2 text-right">RM Alloc %</th>
                                            <th className="p-2 text-right">RM Alloc Q</th>
                                            <th className="p-2 text-right">TM Bid/Mo</th>
                                            <th className="p-2 text-right">TM Alloc/Mo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {allocations.map((row) => (
                                            <tr key={row.teamId} className="hover:bg-gray-700/30">
                                                <td className="p-2 font-bold text-white">{row.teamId}</td>
                                                <td className="p-2 text-right">₹{(row.bidPricePaise / 100).toLocaleString()}</td>
                                                <td className="p-2 text-right">{row.bidVolume.toLocaleString()}</td>
                                                <td className="p-2 font-bold text-yellow-400">#{row.rank}</td>
                                                <td className="p-2 text-right text-gray-400">{(row.allocationFactor * 100).toFixed(0)}%</td>
                                                <td className="p-2 text-right text-green-400 font-bold">{row.allocatedVolume.toLocaleString()}</td>
                                                <td className="p-2 text-right">{row.tmBidCount}</td>
                                                <td className="p-2 text-right text-blue-400 font-bold">{row.tmBidCount}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Progress: Customer Allocations */}
                    {gameState.phase === 'MONTH_END' && (
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-xl">
                            <h3 className="text-sm font-bold mb-3 text-pink-400 flex items-center gap-2 uppercase">
                                <span>🚀</span> Customer Allocation
                            </h3>
                            <CustomerAllocationTable socket={socket} quarterId={gameState.currentQuarter || 1} />
                        </div>
                    )}

                    {/* Progress: Team List */}
                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                        <h3 className="text-sm font-bold mb-2 text-gray-200">Registered Teams ({teams.length})</h3>
                        <ul className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                            {teams.map(t => (
                                <li key={t.id} className="flex justify-between items-center p-2 bg-gray-700/50 rounded text-xs">
                                    <span className="font-medium text-white">{t.name}</span>
                                    <span className="text-gray-500">ID: {t.id}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper Component for Customer Table
const CustomerAllocationTable = ({ socket, quarterId }: { socket: any, quarterId: number }) => {
    const [data, setData] = useState<any[]>([]);

    useEffect(() => {
        if (!socket) return;
        socket.emit('get_customer_allocations', { quarterId });
        socket.on('customer_allocation_results', (res: any) => setData(res));
        return () => { socket.off('customer_allocation_results'); };
    }, [socket, quarterId]);

    if (data.length === 0) return <div className="text-gray-500 italic">No customer allocations yet.</div>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-gray-700/50 text-xs uppercase font-bold text-gray-400">
                    <tr>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Rank</th>
                        <th className="p-3">Team ID</th>
                        <th className="p-3 text-right">Ask Price</th>
                        <th className="p-3 text-right">Allocated Vol</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                    {data.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-700/30 transition-colors">
                            <td className="p-3 font-bold text-pink-300">{row.customerId}</td>
                            <td className="p-3 font-bold text-white">#{row.rank}</td>
                            <td className="p-3">{row.teamId}</td>
                            <td className="p-3 text-right text-green-300">₹{(row.bidPricePaise / 100).toLocaleString()}</td>
                            <td className="p-3 text-right font-bold text-white">{row.allocatedVolume.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


export default ControllerDashboard;
