import React, { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import TeamDashboard from './TeamDashboard';

interface Team {
    id: number;
    name: string;
    baseTmCount: number;
}

interface GameState {
    phase: string;
    currentQuarter: number;
}

const Lobby: React.FC = () => {
    const socket = useSocket();
    const [teams, setTeams] = useState<Team[]>([]);
    const [teamName, setTeamName] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [registeredTeam, setRegisteredTeam] = useState<Team | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);

    useEffect(() => {
        if (!socket) return;

        const fetchState = () => socket.emit('get_initial_state');

        // Initial fetch
        fetchState();

        // Listeners
        socket.on('connect', fetchState); // Re-fetch on reconnect
        socket.on('teams_update', (updatedTeams: Team[]) => setTeams(updatedTeams));
        socket.on('game_state_update', (state: GameState) => setGameState(state));

        socket.on('registration_success', (team: Team) => {
            setRegisteredTeam(team);
            setError('');
        });

        socket.on('error_message', (msg: string) => setError(msg));

        socket.on('game_reset', (newState: GameState) => {
            setRegisteredTeam(null);
            setGameState(newState);
            setTeams([]);
            setTeamName('');
            setPin('');
            setError('');
        });

        return () => {
            socket.off('connect', fetchState);
            socket.off('teams_update');
            socket.off('game_state_update');
            socket.off('registration_success');
            socket.off('error_message');
            socket.off('game_reset');
        };
    }, [socket]);

    const handleJoin = () => {
        if (!socket) return;
        socket.emit('register_team', { name: teamName, pin });
    };

    // Strict Flow: Team Dashboard only opens if registered AND (Quarter Start OR later phase)
    // If PREROLL, show specific message
    if (registeredTeam && gameState && gameState.phase === 'QUARTER_PREROLL') {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
                <div className="text-center space-y-6 animate-pulse">
                    <h1 className="text-6xl font-black text-yellow-500">GET READY!</h1>
                    <p className="text-2xl text-gray-300">Bidding is about to start...</p>
                    <div className="mt-8 p-4 bg-gray-800 rounded border border-gray-700 inline-block">
                        <p className="text-sm text-gray-400">Team: {registeredTeam.name}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Use the latest team data from the 'teams' array if available
    const liveTeam = teams.find(t => t.id === registeredTeam?.id) || registeredTeam;

    if (liveTeam && gameState && (gameState.phase !== 'LOBBY' || gameState.currentQuarter > 1)) {
        return <TeamDashboard team={liveTeam} gameState={gameState} />;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
            <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                RMX Business Simulation
            </h1>

            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Registration Panel */}
                <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                    <h2 className="text-2xl font-semibold mb-4 text-blue-300">Join Game</h2>
                    {registeredTeam ? (
                        <div className="text-green-400 p-6 bg-green-900/20 rounded border border-green-700/50 flex flex-col items-center justify-center h-64 text-center">
                            <div className="text-5xl mb-4">✅</div>
                            <div className="text-xl">Registered as <span className="font-bold text-white">{registeredTeam.name}</span></div>
                            <div className="mt-4 text-gray-400">
                                <p className="text-lg text-white font-semibold">Waiting for Admin to Start the Game.</p>
                                <p className="text-sm mt-2 animate-pulse text-yellow-500">Please wait...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-gray-700/50 p-4 rounded text-sm text-gray-300 mb-4">
                                Enter your Team Name and PIN. If you are re-joining, use the same credentials.
                            </div>
                            <input
                                className="w-full bg-gray-700 border border-gray-600 rounded p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Team Name"
                                value={teamName}
                                onChange={e => setTeamName(e.target.value)}
                            />
                            <input
                                className="w-full bg-gray-700 border border-gray-600 rounded p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="PIN Code (4 digits)"
                                value={pin}
                                onChange={e => setPin(e.target.value)}
                            />
                            <button
                                onClick={handleJoin}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded transition-all transform hover:scale-[1.02]"
                            >
                                Register / Login
                            </button>
                            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                        </div>
                    )}
                </div>

                {/* Lobby Status */}
                <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-semibold text-purple-300">Lobby Status</h2>
                        {gameState && (
                            <span className="px-3 py-1 rounded bg-gray-700 text-xs text-gray-300">
                                Phase: {gameState.phase}
                            </span>
                        )}
                    </div>

                    <div className="space-y-2 mb-6 max-h-[400px] overflow-y-auto">
                        {teams.map((t) => (
                            <div key={t.id} className="p-3 bg-gray-700/50 rounded flex justify-between items-center border-l-4 border-green-500">
                                <span className="font-medium text-gray-200">{t.name}</span>
                                <span className="text-xs text-green-400 font-bold uppercase tracking-wider">Ready</span>
                            </div>
                        ))}
                        {teams.length === 0 && <p className="text-gray-500 italic p-4 text-center">No teams joined yet. reset required?</p>}
                    </div>
                </div>
            </div>

            {/* Game Instructions Section */}
            <div className="max-w-6xl mx-auto mt-8">
                <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                    <h2 className="text-2xl font-bold mb-6 text-yellow-400 flex items-center gap-2">
                        <span>📋</span> Information You Should Read Before Participation
                    </h2>

                    <div className="space-y-6 text-gray-300">
                        {/* Market & Capacity */}
                        <div className="bg-gray-700/30 p-4 rounded-lg">
                            <h3 className="font-bold text-blue-300 mb-2">Market Size & Capacity</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li><strong>Market Size per month</strong> = No. of Players × 40,000 m³</li>
                                <li><strong>Your Capacity</strong> = 50,000 m³ per month (You cannot bid more per month)</li>
                            </ul>
                        </div>

                        {/* Customers Table */}
                        <div className="bg-gray-700/30 p-4 rounded-lg">
                            <h3 className="font-bold text-blue-300 mb-3">Four Customers</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-800 text-xs uppercase">
                                        <tr>
                                            <th className="p-2 text-left">Sr No</th>
                                            <th className="p-2 text-left">Customer Name</th>
                                            <th className="p-2 text-right">Market Share</th>
                                            <th className="p-2 text-right">Payment Terms</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        <tr><td className="p-2">1</td><td className="p-2">Laddu</td><td className="p-2 text-right">40%</td><td className="p-2 text-right">60 days</td></tr>
                                        <tr><td className="p-2">2</td><td className="p-2">Shahi</td><td className="p-2 text-right">30%</td><td className="p-2 text-right">30 days</td></tr>
                                        <tr><td className="p-2">3</td><td className="p-2">Lemon</td><td className="p-2 text-right">20%</td><td className="p-2 text-right">Immediate</td></tr>
                                        <tr><td className="p-2">4</td><td className="p-2">Jamoon</td><td className="p-2 text-right">10%</td><td className="p-2 text-right">Immediate</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Resources */}
                        <div className="bg-gray-700/30 p-4 rounded-lg">
                            <h3 className="font-bold text-blue-300 mb-2">Resources (Beginning of Each Quarter)</h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <p className="font-semibold text-green-300">📦 Raw Material (RM)</p>
                                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                        <li>Bought in m³ at the start of the quarter by bidding</li>
                                        <li>Highest bid gets 100%, next gets 90%, and so on</li>
                                        <li>If RM is short, you will be given RM @ highest bid + 10% penalty</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-semibold text-green-300">🚚 Transit Mixer (TM)</p>
                                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                        <li>Order by numbers. TMs remain till end of quarter</li>
                                        <li>Cost: Rs 1,80,000 per TM (can do 540 m³ per month)</li>
                                        <li>If short, TM automatically allotted @ Rs 2,50,000 per month</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-semibold text-green-300">🏭 Production Cost (Tiered)</p>
                                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                        <li>Rs 400/m³ if volume {'>'} 30,000</li>
                                        <li>Rs 500/m³ if volume between 20,000 - 30,000</li>
                                        <li>Rs 600/m³ if volume between 10,000 - 20,000</li>
                                        <li>Rs 700/m³ if volume {'<'} 10,000</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Working Capital */}
                        <div className="bg-gray-700/30 p-4 rounded-lg">
                            <h3 className="font-bold text-blue-300 mb-2">💰 Working Capital</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li>Initially: Rs 10 Cr seed working capital (no interest)</li>
                                <li>Additional borrowing: Up to Rs 10 Cr @ 2% per month interest</li>
                                <li>Maximum working capital possible: Rs 20 Cr</li>
                            </ul>
                        </div>

                        {/* Monthly Auction */}
                        <div className="bg-gray-700/30 p-4 rounded-lg">
                            <h3 className="font-bold text-blue-300 mb-2">🎯 Monthly Customer Auction Cycles</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li>Each quarter has <strong>3 monthly cycles</strong> to get volume</li>
                                <li>Volumes come at selling price discovered through <strong>reverse auction</strong></li>
                                <li>You decide selling price and quantity for each customer</li>
                                <li><strong>Max selling price: Rs 7,000 per m³</strong></li>
                                <li>After all orders, announcement confirms your order with quantities</li>
                            </ul>
                        </div>

                        {/* Financials */}
                        <div className="bg-gray-700/30 p-4 rounded-lg">
                            <h3 className="font-bold text-blue-300 mb-2">📊 Financials & Payments</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li>Each month: Financials, TMs, and RM remaining will be displayed</li>
                                <li>RM balance at quarter end: Sold at lowest bid price, added to EBITDA</li>
                                <li>TM and RM vendor payments: Auto-debited at end of every month</li>
                                <li>Closing balance shown monthly - <strong>keep your own records!</strong></li>
                            </ul>
                        </div>

                        {/* Game Duration */}
                        <div className="bg-orange-900/20 p-4 rounded-lg border border-orange-700/50">
                            <h3 className="font-bold text-orange-300 mb-2">⏱️ Game Duration</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li><strong>15 minutes</strong> at start for strategy, forecasting, and planning</li>
                                <li>Game played for <strong>maximum 4 quarters</strong></li>
                                <li>Can be stopped at any quarter at Control's discretion</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-center mt-12 text-gray-600 text-xs">
                Admin? Go to <a href="/controller" className="underline hover:text-gray-400">/controller</a>
            </div>
        </div >
    );
};

export default Lobby;
