
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Activity, TrendingUp, TrendingDown, BarChart2, Brain, AlertCircle, RefreshCw, 
  Zap, Shield, Search, ArrowRight, FileText, Lock, Calendar, Clock, 
  ChevronDown, Layers, PieChart, Settings, Menu, DollarSign, Briefcase
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// --- Types ---
type MarketRegime = 'Low Volatility' | 'Normal' | 'High Volatility' | 'Crash' | 'Euphorium';
type PredictionDecision = 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL';
type TimeHorizon = '1D' | '1W' | '1M' | '6M' | '1Y';

interface StockData {
  date: string;
  price: number;
  rsi: number;
  macd: number;
  atr: number;
  atrPct: number;
}

interface ShapContribution {
  feature: string;
  value: number; // The impact on price
  type: 'positive' | 'negative';
}

interface YieldPoint {
  period: string;
  roi: number;
  confidence: number;
}

interface MarketOpportunity {
  ticker: string;
  name: string;
  type: 'Stable' | 'Growth' | 'Value';
  score: number;
  change: number;
}

interface AnalysisResult {
  ticker: string;
  currentPrice: number;
  predictedPrice: number;
  predictedChangePct: number;
  lookbackWindow: number;
  regime: MarketRegime;
  decision: PredictionDecision;
  conviction: number;
  shapValues: ShapContribution[];
  history: StockData[];
  yieldCurve: YieldPoint[];
  metrics: {
    rmse: number;
    mape: number;
    sharpe: number;
  };
}

// --- Mock Data Engine ---

const MARKET_OPPORTUNITIES: MarketOpportunity[] = [
  { ticker: 'MCB.KA', name: 'MCB Bank', type: 'Stable', score: 92, change: 0.5 },
  { ticker: 'UBL.KA', name: 'United Bank', type: 'Stable', score: 88, change: 0.2 },
  { ticker: 'SYS.KA', name: 'Systems Ltd', type: 'Growth', score: 95, change: 2.4 },
  { ticker: 'TRG.KA', name: 'TRG Pakistan', type: 'Growth', score: 85, change: -1.2 },
  { ticker: 'FFC.KA', name: 'Fauji Fert', type: 'Value', score: 90, change: 1.1 },
];

const generateMockData = (ticker: string, days = 90): StockData[] => {
  const data: StockData[] = [];
  let price = ticker === 'LUCK.KA' ? 850 : ticker === 'ENGRO.KA' ? 320 : ticker === 'SYS.KA' ? 450 : 95;
  
  for (let i = 0; i < days; i++) {
    const move = (Math.random() - 0.48) * (price * 0.02); 
    price += move;
    
    data.push({
      date: new Date(Date.now() - (days - i) * 86400000).toISOString().split('T')[0],
      price: parseFloat(price.toFixed(2)),
      rsi: 30 + Math.random() * 40 + (move > 0 ? 10 : -10),
      macd: (Math.random() - 0.5) * 2,
      atr: price * (0.01 + Math.random() * 0.02),
      atrPct: 0 
    });
  }
  return data.map(d => ({ ...d, atrPct: (d.atr / d.price) * 100 }));
};

const determineLookback = (lastData: StockData): { window: number, regime: MarketRegime } => {
  const atrPct = lastData.atrPct;
  if (atrPct < 0.8) return { window: 90, regime: 'Low Volatility' };
  if (atrPct > 3.5) return { window: 10, regime: 'Crash' };
  if (atrPct > 2.5) return { window: 20, regime: 'High Volatility' };
  return { window: 45, regime: 'Normal' };
};

const runHybridModel = async (ticker: string, horizon: TimeHorizon, backtestDate: string): Promise<AnalysisResult> => {
  await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate compute

  const history = generateMockData(ticker);
  const lastPoint = history[history.length - 1];
  const { window, regime } = determineLookback(lastPoint);

  // Horizon multiplier
  let horizonMult = 1;
  if (horizon === '1W') horizonMult = 2.5;
  if (horizon === '1M') horizonMult = 5;
  if (horizon === '6M') horizonMult = 12;
  if (horizon === '1Y') horizonMult = 20;

  const rsiBias = (50 - lastPoint.rsi) / 100;
  const predictionMove = lastPoint.price * (0.01 + rsiBias * 0.05) * horizonMult; 
  const predictedPrice = lastPoint.price + predictionMove;
  const changePct = ((predictedPrice - lastPoint.price) / lastPoint.price) * 100;

  // Simulate Yield Curve for Holding
  const yieldCurve: YieldPoint[] = [
    { period: '1W', roi: changePct * 0.2, confidence: 0.9 },
    { period: '1M', roi: changePct * 0.8, confidence: 0.85 },
    { period: '3M', roi: changePct * 1.5, confidence: 0.75 },
    { period: '6M', roi: changePct * 2.2, confidence: 0.60 },
    { period: '1Y', roi: changePct * 3.5, confidence: 0.45 },
  ];

  const direction = changePct > 0 ? 1 : -1;
  const shapValues: ShapContribution[] = [
    { feature: 'RSI (14)', value: direction * Math.random() * 5 * horizonMult, type: direction > 0 ? 'positive' : 'negative' },
    { feature: 'MACD Divergence', value: direction * Math.random() * 3, type: direction > 0 ? 'positive' : 'negative' },
    { feature: 'Whale Flow', value: Math.random() * 4 * direction, type: direction > 0 ? 'positive' : 'negative' },
    { feature: 'KSE-100 Corr', value: (Math.random() - 0.5) * 2, type: Math.random() > 0.5 ? 'positive' : 'negative' },
    { feature: 'Policy Rate', value: -1.5, type: 'negative' },
    { feature: 'Oil Prices', value: direction > 0 ? 2 : -2, type: direction > 0 ? 'positive' : 'negative' },
  ];

  const posForce = shapValues.filter(s => s.value > 0).reduce((a, b) => a + b.value, 0);
  const totalForce = shapValues.reduce((a, b) => a + Math.abs(b.value), 0);
  const conviction = totalForce === 0 ? 0.5 : posForce / totalForce;

  let decision: PredictionDecision = 'HOLD';
  const threshold = horizon === '1Y' ? 15 : 1; 
  
  if (changePct > threshold * 2 && conviction > 0.7) decision = 'STRONG BUY';
  else if (changePct > threshold * 0.5) decision = 'BUY';
  else if (changePct < -threshold * 2 && conviction < 0.3) decision = 'STRONG SELL';
  else if (changePct < -threshold * 0.5) decision = 'SELL';

  return {
    ticker,
    currentPrice: lastPoint.price,
    predictedPrice: parseFloat(predictedPrice.toFixed(2)),
    predictedChangePct: parseFloat(changePct.toFixed(2)),
    lookbackWindow: window,
    regime,
    decision,
    conviction,
    shapValues: shapValues.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
    history,
    yieldCurve,
    metrics: {
      rmse: 0.85 + Math.random() * 0.5,
      mape: 1.2 + Math.random() * 0.8,
      sharpe: 1.8 + Math.random() * 0.4
    }
  };
};

// --- Visual Components ---

const PriceChart = ({ data, predictedPrice, horizon }: { data: StockData[], predictedPrice: number, horizon: string }) => {
  const width = 600;
  const height = 280;
  const padding = 40;

  const minPrice = Math.min(...data.map(d => d.price), predictedPrice) * 0.95;
  const maxPrice = Math.max(...data.map(d => d.price), predictedPrice) * 1.05;

  const getX = (index: number) => padding + (index / (data.length)) * (width - 2 * padding);
  const getY = (price: number) => height - padding - ((price - minPrice) / (maxPrice - minPrice)) * (height - 2 * padding);

  const points = data.map((d, i) => `${getX(i)},${getY(d.price)}`).join(' ');
  const lastDataPoint = data[data.length - 1];
  const lastX = getX(data.length - 1);
  const lastY = getY(lastDataPoint.price);
  const predX = width - padding;
  const predY = getY(predictedPrice);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = height - padding - t * (height - 2 * padding);
        return <line key={t} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
      })}
      
      {/* Area */}
      <polygon points={`${padding},${height-padding} ${points} ${lastX},${height-padding}`} fill="url(#chartGradient)" />
      
      {/* Line */}
      <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* Prediction Connector */}
      <line x1={lastX} y1={lastY} x2={predX} y2={predY} stroke={predictedPrice > lastDataPoint.price ? "#10b981" : "#ef4444"} strokeWidth="2" strokeDasharray="4 4" />
      
      {/* Points */}
      <circle cx={lastX} cy={lastY} r="4" fill="#3b82f6" />
      <circle cx={predX} cy={predY} r="5" fill={predictedPrice > lastDataPoint.price ? "#10b981" : "#ef4444"} stroke="#fff" strokeWidth="2" />
      
      {/* Labels */}
      <text x={padding} y={height - 10} fill="#94a3b8" fontSize="10" className="font-mono">History</text>
      <text x={width - padding} y={height - 10} fill="#94a3b8" fontSize="10" textAnchor="end" className="font-mono">Forecast ({horizon})</text>
      
      <text x={width - 10} y={getY(predictedPrice)} fill={predictedPrice > lastDataPoint.price ? "#10b981" : "#ef4444"} fontSize="12" fontWeight="bold" textAnchor="start">
        {predictedPrice.toFixed(0)}
      </text>
    </svg>
  );
};

const YieldCurveChart = ({ data }: { data: YieldPoint[] }) => {
  const width = 400;
  const height = 200;
  const padding = 30;
  
  const minRoi = Math.min(0, ...data.map(d => d.roi));
  const maxRoi = Math.max(...data.map(d => d.roi)) * 1.2;
  
  const getX = (i: number) => padding + (i / (data.length - 1)) * (width - 2 * padding);
  const getY = (roi: number) => height - padding - ((roi - minRoi) / (maxRoi - minRoi)) * (height - 2 * padding);

  const points = data.map((d, i) => `${getX(i)},${getY(d.roi)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <line x1={padding} y1={getY(0)} x2={width-padding} y2={getY(0)} stroke="#64748b" strokeWidth="1" />
      
      <polyline points={points} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
      
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={getX(i)} cy={getY(d.roi)} r="4" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
          <text x={getX(i)} y={height - 10} textAnchor="middle" fill="#94a3b8" fontSize="10">{d.period}</text>
          <text x={getX(i)} y={getY(d.roi) - 10} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">{d.roi > 0 ? '+' : ''}{d.roi.toFixed(1)}%</text>
        </g>
      ))}
    </svg>
  );
};

// --- Components ---

const NavBar = () => (
  <nav className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
    <div className="max-w-[1400px] mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center space-x-8">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <Activity className="text-white" size={20} />
          </div>
          <span className="font-bold text-white tracking-tight">PSX<span className="text-blue-500">NEURAL</span></span>
        </div>
        
        <div className="hidden md:flex items-center space-x-1">
          {['Dashboard', 'Market', 'Screeners', 'Backtest', 'Reports'].map((item) => (
            <button key={item} className="px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1">
              {item} {item === 'Market' && <ChevronDown size={12} />}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="hidden md:block text-right">
          <div className="text-[10px] text-slate-500 uppercase font-bold">Trading Capital</div>
          <div className="text-sm font-mono text-emerald-400">PKR 4,250,000</div>
        </div>
        <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
           <Settings size={14} className="text-slate-400" />
        </div>
      </div>
    </div>
  </nav>
);

const MarketTicker = () => (
  <div className="bg-slate-950 border-b border-slate-800 py-1 overflow-hidden whitespace-nowrap">
    <div className="inline-flex space-x-8 animate-marquee text-xs font-mono">
      <span className="text-slate-400">KSE-100: <span className="text-emerald-400">78,450 (+1.2%)</span></span>
      <span className="text-slate-400">KMI-30: <span className="text-emerald-400">121,200 (+0.8%)</span></span>
      <span className="text-slate-400">USD/PKR: <span className="text-red-400">278.50 (+0.1%)</span></span>
      <span className="text-slate-400">OIL (WTI): <span className="text-emerald-400">$78.20 (+0.5%)</span></span>
      <span className="text-slate-400">GOLD: <span className="text-emerald-400">$2,450 (+0.2%)</span></span>
      {/* Duplicate for infinite scroll feel */}
      <span className="text-slate-400 pl-8">KSE-100: <span className="text-emerald-400">78,450 (+1.2%)</span></span>
    </div>
  </div>
);

// --- Main App ---
const App = () => {
  const [ticker, setTicker] = useState('LUCK.KA');
  const [horizon, setHorizon] = useState<TimeHorizon>('1W');
  const [backtestDate, setBacktestDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [analyzingAi, setAnalyzingAi] = useState(false);

  // Auto-run on load
  useEffect(() => {
    runPrediction();
  }, []); // Run once

  const runPrediction = async () => {
    setLoading(true);
    setResult(null);
    setAiAnalysis("");
    
    try {
      const data = await runHybridModel(ticker, horizon, backtestDate);
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateAiReport = async () => {
    if (!result) return;
    setAnalyzingAi(true);

    try {
      const prompt = `
        Act as a Senior Portfolio Manager for the Pakistan Stock Exchange.
        Provide a strategic recommendation for ${result.ticker} based on the following:
        
        - Horizon: ${horizon}
        - Forecast: Price moving from ${result.currentPrice} to ${result.predictedPrice} (${result.predictedChangePct}%)
        - Signal: ${result.decision} (Confidence: ${(result.conviction * 100).toFixed(0)}%)
        - Yield Curve: ${result.yieldCurve.map(y => `${y.period}:${y.roi.toFixed(1)}%`).join(', ')}
        - Drivers: ${result.shapValues.slice(0,3).map(s => s.feature).join(', ')}

        Output Format:
        1. **Verdict**: [Strong Buy/Buy/Hold/Sell]
        2. **Rationale**: 2 sentences linking technicals (RSI/MACD) to macro (Interest Rates/Oil).
        3. **Strategy**: Should the user hold for 1 month or 1 year? Refer to the yield curve.
      `;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      setAiAnalysis(response.text);
    } catch (e) {
      setAiAnalysis("AI Analyst is currently offline.");
    } finally {
      setAnalyzingAi(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-blue-500 selection:text-white pb-20">
      <NavBar />
      <MarketTicker />

      <main className="max-w-[1400px] mx-auto px-4 py-6 grid grid-cols-12 gap-6">
        
        {/* --- LEFT SIDEBAR: Controls & Market Intel --- */}
        <aside className="col-span-12 lg:col-span-3 space-y-6">
          
          {/* Controls Panel */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 shadow-lg space-y-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Settings size={14} /> Model Configuration
            </h3>
            
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Target Asset</label>
              <div className="relative">
                <select 
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-md p-2.5 appearance-none focus:ring-1 focus:ring-blue-500"
                >
                  <optgroup label="Cement & Power">
                    <option value="LUCK.KA">LUCK (Lucky Cement)</option>
                    <option value="HUBC.KA">HUBC (Hub Power)</option>
                    <option value="DGKC.KA">DGKC (DG Khan)</option>
                  </optgroup>
                  <optgroup label="Tech & Banks">
                    <option value="SYS.KA">SYS (Systems Ltd)</option>
                    <option value="MCB.KA">MCB (MCB Bank)</option>
                    <option value="TRG.KA">TRG (TRG Pakistan)</option>
                  </optgroup>
                  <optgroup label="Oil & Gas">
                    <option value="OGDC.KA">OGDC (Oil & Gas)</option>
                    <option value="PPL.KA">PPL (Pak Petroleum)</option>
                    <option value="ENGRO.KA">ENGRO (Engro Corp)</option>
                  </optgroup>
                </select>
                <ChevronDown className="absolute right-3 top-3 text-slate-500 pointer-events-none" size={14} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Forecast Horizon</label>
              <div className="grid grid-cols-5 gap-1">
                {['1D', '1W', '1M', '6M', '1Y'].map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h as TimeHorizon)}
                    className={`text-xs py-1.5 rounded border ${
                      horizon === h 
                        ? 'bg-blue-600 border-blue-500 text-white' 
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Backtest Origin</label>
              <div className="relative">
                <input 
                  type="date" 
                  value={backtestDate}
                  onChange={(e) => setBacktestDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-md p-2.5 focus:ring-1 focus:ring-blue-500"
                />
                <Calendar className="absolute right-3 top-2.5 text-slate-500 pointer-events-none" size={14} />
              </div>
            </div>

            <button 
              onClick={runPrediction}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold py-3 rounded-md shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
              {loading ? 'PROCESSING...' : 'RUN FORECAST'}
            </button>
          </div>

          {/* Market Intelligence Sidebar */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden">
             <div className="p-4 border-b border-slate-700 bg-slate-800/50">
               <h3 className="text-sm font-bold text-white flex items-center gap-2">
                 <Briefcase size={14} className="text-emerald-400" /> Market Intelligence
               </h3>
             </div>
             <div className="divide-y divide-slate-700/50">
               {MARKET_OPPORTUNITIES.map((opp) => (
                 <div key={opp.ticker} className="p-3 hover:bg-slate-700/30 transition-colors flex items-center justify-between group cursor-pointer" onClick={() => { setTicker(opp.ticker); }}>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        {opp.ticker} 
                        {opp.type === 'Stable' && <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 rounded border border-emerald-500/20">STABLE</span>}
                        {opp.type === 'Growth' && <span className="bg-purple-500/10 text-purple-400 text-[10px] px-1.5 rounded border border-purple-500/20">GROWTH</span>}
                        {opp.type === 'Value' && <span className="bg-blue-500/10 text-blue-400 text-[10px] px-1.5 rounded border border-blue-500/20">VALUE</span>}
                      </div>
                      <div className="text-[10px] text-slate-400">{opp.name}</div>
                    </div>
                    <div className={`text-xs font-mono font-bold ${opp.change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {opp.change > 0 ? '+' : ''}{opp.change}%
                    </div>
                 </div>
               ))}
             </div>
             <div className="p-2 bg-slate-900/50 text-center">
               <button className="text-[10px] text-blue-400 font-medium hover:text-blue-300">VIEW FULL SCREENER</button>
             </div>
          </div>

        </aside>

        {/* --- CENTER: Main Analysis --- */}
        <section className="col-span-12 lg:col-span-9 space-y-6">
          
          {loading ? (
             <div className="h-96 w-full flex flex-col items-center justify-center bg-slate-800/30 border border-slate-700 border-dashed rounded-xl">
               <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
               <p className="text-slate-400 animate-pulse font-mono">Running Hybrid Model Inference...</p>
             </div>
          ) : result ? (
            <>
              {/* Top Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Last Price</div>
                  <div className="text-2xl font-bold text-white">{result.currentPrice.toFixed(2)}</div>
                </div>
                <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg relative overflow-hidden">
                   <div className={`absolute right-0 top-0 p-2 opacity-10 ${result.predictedChangePct > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                     {result.predictedChangePct > 0 ? <TrendingUp size={40} /> : <TrendingDown size={40} />}
                   </div>
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Target ({horizon})</div>
                  <div className={`text-2xl font-bold flex items-end gap-2 ${result.predictedChangePct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.predictedPrice.toFixed(2)}
                    <span className="text-xs mb-1 px-1.5 py-0.5 bg-slate-900 rounded">{result.predictedChangePct > 0 ? '+' : ''}{result.predictedChangePct}%</span>
                  </div>
                </div>
                <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Recommendation</div>
                  <div className={`text-lg font-bold ${
                    result.decision.includes('BUY') ? 'text-emerald-400' : result.decision.includes('SELL') ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {result.decision}
                  </div>
                  <div className="w-full bg-slate-700 h-1 mt-2 rounded-full overflow-hidden">
                    <div className="bg-white h-full" style={{ width: `${result.conviction * 100}%` }}></div>
                  </div>
                </div>
                <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Regime</div>
                  <div className="text-lg font-bold text-white">{result.regime}</div>
                  <div className="text-[10px] text-slate-500">ATR Window: {result.lookbackWindow} Days</div>
                </div>
              </div>

              {/* Main Charts Area */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Price Forecast Chart */}
                <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-5 shadow-lg flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <TrendingUp size={16} className="text-blue-500" /> Price Projection
                    </h3>
                    <div className="flex gap-2">
                       <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-1 rounded border border-slate-700">LSTM-BiRNN</span>
                       <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-1 rounded border border-slate-700">XGBoost</span>
                    </div>
                  </div>
                  <div className="flex-1 min-h-[250px]">
                    <PriceChart data={result.history} predictedPrice={result.predictedPrice} horizon={horizon} />
                  </div>
                </div>

                {/* Yield Curve & Profitability */}
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 shadow-lg flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <PieChart size={16} className="text-amber-500" /> Yield Curve
                    </h3>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-6">Projected ROI over different holding periods based on current momentum.</p>
                  
                  <div className="flex-1 min-h-[150px] mb-4">
                    <YieldCurveChart data={result.yieldCurve} />
                  </div>
                  
                  <div className="bg-slate-900/50 rounded p-3 border border-slate-700">
                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Best Strategy</div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-300">Optimal Hold:</span>
                      <span className="text-sm font-bold text-white">
                         {result.yieldCurve.reduce((max, p) => p.roi > max.roi ? p : max, result.yieldCurve[0]).period}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm text-slate-300">Max Projected ROI:</span>
                      <span className="text-sm font-bold text-emerald-400">
                         {Math.max(...result.yieldCurve.map(y => y.roi)).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Explainability & AI */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Explainability */}
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
                   <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                      <Layers size={16} className="text-purple-500" /> Key Drivers (SHAP)
                   </h3>
                   <div className="space-y-3">
                     {result.shapValues.slice(0, 4).map((shap, idx) => (
                       <div key={idx} className="flex items-center justify-between group">
                         <div className="flex items-center gap-3">
                           <div className={`w-1.5 h-1.5 rounded-full ${shap.value > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                           <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{shap.feature}</span>
                         </div>
                         <div className="flex items-center gap-2 w-1/3">
                            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden flex justify-end">
                               {shap.value < 0 && <div className="h-full bg-red-500" style={{ width: `${Math.min(Math.abs(shap.value) * 20, 100)}%` }}></div>}
                            </div>
                            <div className="w-px h-3 bg-slate-600"></div>
                            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                               {shap.value > 0 && <div className="h-full bg-emerald-500" style={{ width: `${Math.min(Math.abs(shap.value) * 20, 100)}%` }}></div>}
                            </div>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>

                {/* AI Analyst */}
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 flex flex-col relative overflow-hidden">
                   {/* Background Decor */}
                   <div className="absolute -right-10 -bottom-10 opacity-5">
                     <Brain size={150} />
                   </div>

                   <div className="flex justify-between items-start mb-4 relative z-10">
                     <h3 className="font-bold text-white flex items-center gap-2">
                        <FileText size={16} className="text-blue-400" /> AI Portfolio Manager
                     </h3>
                     <button 
                       onClick={generateAiReport} 
                       disabled={analyzingAi}
                       className="text-[10px] flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded transition-colors"
                     >
                       {analyzingAi ? <RefreshCw className="animate-spin" size={10} /> : <Zap size={10} />}
                       {analyzingAi ? 'ANALYZING' : 'GENERATE'}
                     </button>
                   </div>

                   <div className="flex-1 bg-slate-900/80 rounded-lg border border-slate-700/50 p-4 text-sm leading-relaxed text-slate-300 overflow-y-auto relative z-10 min-h-[140px]">
                     {aiAnalysis ? (
                       <div className="whitespace-pre-line prose prose-invert prose-sm max-w-none">
                         {aiAnalysis}
                       </div>
                     ) : (
                       <div className="h-full flex flex-col items-center justify-center text-slate-600">
                         <Brain size={24} className="mb-2 opacity-50" />
                         <p className="text-xs text-center">Click Generate for institutional-grade analysis based on current yield curve and market regime.</p>
                       </div>
                     )}
                   </div>
                </div>

              </div>

            </>
          ) : null}
        </section>
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
