import { useState, useEffect } from 'react';

const FINNHUB_KEY = 'd9hrerpr01qjmfda64ggd9hrerpr01qjmfda64h0';
const DEEPSEEK_API_KEY = 'sk-0ea0af4af3dd4a849db43f56eb186b46';

const TOP_PAIRS = [
  // Валютные пары
  'AUDNZD', 'AUDUSD', 'EURGBP', 'EURHUF', 'EURJPY', 'EURNZD', 'EURRUB', 'EURTRY',
  'GBPUSD', 'USDJPY', 'USDCAD', 'USDCHF', 'EURAUD', 'GBPJPY', 'EURUSD', 'EURCAD',
  'USDMXN', 'AUDJPY', 'AUDCAD', 'CADCHF', 'CHFJPY', 'NZDUSD', 'NZDJPY',
  'GBPAUD', 'GBPCAD', 'GBPCHF', 'EURCHF', 'USDCNH', 'USDRUB', 'USDMYR',
  'USDIDR', 'USDINR', 'USDPHP', 'USDTHB', 'USDSGD', 'USDHKD',
  // Акции
  'AAPL', 'MSFT', 'TSLA', 'AMZN', 'NFLX', 'META', 'NVDA', 'GOOGL',
  'JPM', 'V', 'JNJ', 'WMT', 'PG', 'MA', 'UNH', 'HD',
  'DIS', 'ADBE', 'CRM', 'CSCO', 'INTC', 'AMD', 'BA', 'XOM',
  'PFE', 'PLTR', 'COIN', 'GME', 'AXP', 'FDX', 'C', 'MARA', 'BABA'
];

const calcRSI = (p: number[], per = 14): number => {
  if (p.length < per + 1) return 50;
  let g = 0, l = 0;
  for (let i = p.length - per; i < p.length; i++) { const d = p[i] - p[i - 1]; if (d >= 0) g += d; else l -= d; }
  if (l === 0) return 100;
  return Math.round(100 - 100 / (1 + (g / per) / (l / per)));
};
const calcEMA = (p: number[], per: number): number => {
  if (p.length < per) return p[p.length - 1] || 0;
  const k = 2 / (per + 1); let e = p[0];
  for (let i = 1; i < p.length; i++) e = (p[i] - e) * k + e;
  return e;
};
const calcMACD = (p: number[]): { macd: number; signal: number; histogram: number; crossed: 'up' | 'down' | null } => {
  if (p.length < 35) return { macd: 0, signal: 0, histogram: 0, crossed: null };
  const ema12 = calcEMA(p, 12), ema26 = calcEMA(p, 26);
  const macd = parseFloat((ema12 - ema26).toFixed(4));
  const prevP = p.slice(0, -1);
  const prevEma12 = calcEMA(prevP, 12), prevEma26 = calcEMA(prevP, 26);
  const prevMacd = parseFloat((prevEma12 - prevEma26).toFixed(4));
  const macdValues = p.slice(25).map((_, i) => calcEMA(p.slice(0, i + 26), 12) - calcEMA(p.slice(0, i + 26), 26));
  const signal = parseFloat(calcEMA(macdValues, 9).toFixed(4));
  const prevMacdValues = prevP.slice(25).map((_, i) => calcEMA(prevP.slice(0, i + 26), 12) - calcEMA(prevP.slice(0, i + 26), 26));
  const prevSignal = parseFloat(calcEMA(prevMacdValues, 9).toFixed(4));
  let crossed: 'up' | 'down' | null = null;
  if (prevMacd <= prevSignal && macd > signal) crossed = 'up';
  else if (prevMacd >= prevSignal && macd < signal) crossed = 'down';
  return { macd, signal, histogram: parseFloat((macd - signal).toFixed(4)), crossed };
};
const calcStoch = (p: number[], per = 14): { k: number; d: number } => {
  if (p.length < per) return { k: 50, d: 50 };
  const s = p.slice(-per); const h = Math.max(...s), l = Math.min(...s);
  const k = h === l ? 50 : ((p[p.length - 1] - l) / (h - l)) * 100;
  return { k: Math.round(k), d: Math.round(k) };
};
const calcADX = (p: number[], per = 14): number => {
  if (p.length < per * 2) return 0;
  const tr: number[] = [], pDM: number[] = [], mDM: number[] = [];
  for (let i = 1; i < p.length; i++) {
    tr.push(Math.max(p[i], p[i-1]) - Math.min(p[i], p[i-1]));
    pDM.push(Math.max(0, p[i] - p[i-1]));
    mDM.push(Math.max(0, p[i-1] - p[i]));
  }
  const smooth = (d: number[]): number => { const k = 2/(per+1); let e = d[0]; for (let i = 1; i < d.length; i++) e = d[i]*k + e*(1-k); return e; };
  const a = smooth(tr); if (!a) return 0;
  return Math.round(Math.abs(smooth(pDM)-smooth(mDM))/(smooth(pDM)+smooth(mDM))*100);
};

const fetchFinnhubCandles = async (sym: string): Promise<number[]> => {
  try {
    const res = await fetch(`https://finnhub.io/api/v1/forex/candles?token=${FINNHUB_KEY}&symbol=${sym}&resolution=1&count=100`);
    const data = await res.json();
    if (data.s === 'ok' && data.c) return data.c;
  } catch {}
  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/candle?token=${FINNHUB_KEY}&symbol=${sym}&resolution=1&count=100`);
    const data = await res.json();
    if (data.s === 'ok' && data.c) return data.c;
  } catch {}
  return [];
};

const getExpiryTime = (): string => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const predictPrice = (klines: number[], minutes: number): { price: number; direction: 'up' | 'down' } => {
  const price = klines[klines.length - 1];
  const emaFast = calcEMA(klines, 9), emaSlow = calcEMA(klines, 21);
  const macd = calcMACD(klines);
  let change = (emaFast - emaSlow) / emaSlow * 100;
  if (macd.crossed === 'up') change *= 1.5;
  else if (macd.crossed === 'down') change *= 1.5;
  const final = change * (minutes / 15) * 0.3;
  return { price: price * (1 + final / 100), direction: final > 0 ? 'up' : 'down' };
};

const getComboSignal = (klines: number[]): { action: 'LONG' | 'SHORT' | 'SKIP'; probability: number; reasons: string[] } => {
  const price = klines[klines.length - 1];
  const rsi = calcRSI(klines), stoch = calcStoch(klines), macd = calcMACD(klines), adx = calcADX(klines);
  const ema20 = calcEMA(klines, 20), ema50 = calcEMA(klines, 50);
  const reasons: string[] = [];
  const longLevel1 = rsi < 40 && stoch.k < 30 && adx > 18;
  const shortLevel1 = rsi > 60 && stoch.k > 70 && adx > 18;
  if (!longLevel1 && !shortLevel1) return { action: 'SKIP', probability: 0, reasons: [] };

  let longConfirms = 0, shortConfirms = 0;
  if (macd.crossed === 'up') longConfirms++; else if (macd.crossed === 'down') shortConfirms++;
  if (price > ema50) longConfirms++; else if (price < ema50) shortConfirms++;
  if (macd.histogram > 0) longConfirms++; else if (macd.histogram < 0) shortConfirms++;
  if (price > ema20) longConfirms++; else if (price < ema20) shortConfirms++;

  let longBonus = 0, shortBonus = 0;
  if (rsi < 25) longBonus += 15; if (rsi > 75) shortBonus += 15;
  if (stoch.k < 15) longBonus += 10; if (stoch.k > 85) shortBonus += 10;
  if (macd.crossed === 'up') longBonus += 20; if (macd.crossed === 'down') shortBonus += 20;
  if (adx > 30) { longBonus += 10; shortBonus += 10; }

  let probability = 50;
  if (longLevel1 && longConfirms >= 2) { probability = 60 + longConfirms * 5 + longBonus / 3; reasons.push(`RSI=${rsi}`, `Stoch=${stoch.k}`, `ADX=${adx}`); return { action: 'LONG', probability: Math.min(95, Math.round(probability)), reasons }; }
  if (shortLevel1 && shortConfirms >= 2) { probability = 60 + shortConfirms * 5 + shortBonus / 3; reasons.push(`RSI=${rsi}`, `Stoch=${stoch.k}`, `ADX=${adx}`); return { action: 'SHORT', probability: Math.min(95, Math.round(probability)), reasons }; }
  return { action: 'SKIP', probability: 0, reasons: [] };
};

interface Signal { symbol: string; action: 'LONG' | 'SHORT'; probability: number; rsi: number; stoch: number; adx: number; macd: number; price: number; tp: number; sl: number; aiReason: string; predictions: { min: number; price: number; direction: string }[]; expiryTime: string; }
interface Analysis { action: 'LONG' | 'SHORT' | 'SKIP'; probability: number; rsi: number; stoch: number; adx: number; macd: number; tp: number; sl: number; entry: number; aiText: string; predictions: { min: number; price: number; direction: string }[]; expiryTime: string; }
interface Trade { id: string; symbol: string; action: 'LONG' | 'SHORT'; entryPrice: number; exitPrice: number | null; profit: number | null; time: string; sessionId: string; }
interface POTrade { id: string; symbol: string; action: 'UP' | 'DOWN'; result: 'win' | 'loss' | null; time: string; }

const App = () => {
  const [mode, setMode] = useState<'manual' | 'auto'>('auto');
  const [symbol, setSymbol] = useState('EURUSD');
  const [searchSymbol, setSearchSymbol] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState<Trade[]>(() => { try { return JSON.parse(localStorage.getItem('trades') || '[]'); } catch { return []; } });
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem('sessionId'));
  const [autoSignals, setAutoSignals] = useState<Signal[]>([]);
  const [autoScanning, setAutoScanning] = useState(false);
  const [lastAutoScan, setLastAutoScan] = useState('');
  const [toast, setToast] = useState('');
  const [poTrades, setPoTrades] = useState<POTrade[]>(() => { try { return JSON.parse(localStorage.getItem('poTrades') || '[]'); } catch { return []; } });

  const sessionTrades = trades.filter(t => t.sessionId === sessionId);
  const sessionWinRate = sessionTrades.filter(t => t.exitPrice).length > 0 ? Math.round((sessionTrades.filter(t => (t.profit || 0) > 0).length / sessionTrades.filter(t => t.exitPrice).length) * 100) : 0;
  const sessionProfit = sessionTrades.reduce((s, t) => s + (t.profit || 0), 0);
  const formatPrice = (p: number): string => p >= 100 ? p.toFixed(2) : p >= 1 ? p.toFixed(4) : p.toFixed(6);
  const poTotal = poTrades.filter(t => t.result).length;
  const poWins = poTrades.filter(t => t.result === 'win').length;
  const poWinRate = poTotal > 0 ? Math.round((poWins / poTotal) * 100) : 0;

  useEffect(() => { localStorage.setItem('trades', JSON.stringify(trades)); if (sessionId) localStorage.setItem('sessionId', sessionId); localStorage.setItem('poTrades', JSON.stringify(poTrades)); }, [trades, sessionId, poTrades]);

  const analyzeSymbol = async (sym: string): Promise<Analysis | null> => {
    const k = await fetchFinnhubCandles(sym);
    if (k.length < 50) return null;
    const price = k[k.length - 1], rsi = calcRSI(k), stoch = calcStoch(k), macd = calcMACD(k), adx = calcADX(k);
    const sig = getComboSignal(k);
    const tp = sig.action === 'LONG' ? price * 1.01 : price * 0.99;
    const sl = sig.action === 'LONG' ? price * 0.997 : price * 1.003;
    const expiryTime = getExpiryTime();
    const predictions = [5, 10, 15].map(min => {
      const pred = predictPrice(k, min);
      return { min, price: pred.price, direction: pred.direction };
    });
    let ai = sig.action === 'SKIP' ? 'Нет сигнала.' : `${sig.action} (${sig.probability}%). ${sig.reasons.join('. ')}.`;
    return { action: sig.action, probability: sig.probability, rsi, stoch: stoch.k, adx, macd: macd.histogram, tp, sl, entry: price, aiText: ai, predictions, expiryTime };
  };

  const analyze = async () => { setLoading(true); const r = await analyzeSymbol(symbol); if (r) setAnalysis(r); setLoading(false); };

  const autoScan = async () => {
    setAutoScanning(true); const sigs: Signal[] = [];
    for (let i = 0; i < TOP_PAIRS.length; i += 3) {
      const b = TOP_PAIRS.slice(i, i + 3); const res = await Promise.all(b.map(s => analyzeSymbol(s)));
      res.forEach((r, idx) => { if (r && r.action !== 'SKIP') sigs.push({ symbol: b[idx], action: r.action, probability: r.probability, rsi: r.rsi, stoch: r.stoch, adx: r.adx, macd: r.macd, price: r.entry, tp: r.tp, sl: r.sl, aiReason: r.aiText, predictions: r.predictions, expiryTime: r.expiryTime }); });
      setAutoSignals([...sigs].sort((a, b) => b.probability - a.probability)); await new Promise(r => setTimeout(r, 500));
    }
    setLastAutoScan(new Date().toLocaleTimeString()); setAutoScanning(false);
    if (sigs.length > 0) showToast(`🎯 ${sigs.length} сигналов!`);
  };
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  useEffect(() => { if (mode === 'auto') { autoScan(); const i = setInterval(autoScan, 180000); return () => clearInterval(i); } }, [mode]);

  const startSession = () => { const id = Date.now().toString(); setSessionId(id); localStorage.setItem('sessionId', id); showToast('🚀 Сессия!'); };
  const endSession = () => { setSessionId(null); localStorage.removeItem('sessionId'); showToast('🏁 Завершено'); };
  const openTrade = (action: 'LONG' | 'SHORT', sym: string, price: number) => {
    if (!sessionId) { showToast('⚠️ Начни сессию!'); return; }
    setTrades(prev => [{ id: Date.now().toString(), symbol: sym, action, entryPrice: price, exitPrice: null, profit: null, time: new Date().toLocaleTimeString(), sessionId }, ...prev]);
    window.open('https://pocketoption.com', '_blank');
  };
  const closeTrade = (id: string) => { setTrades(prev => prev.map(t => { if (t.id !== id) return t; return { ...t, exitPrice: 0, profit: 0 }; })); };
  const deleteTrade = (id: string) => { setTrades(prev => prev.filter(t => t.id !== id)); };
  const resetSession = () => { setTrades(prev => prev.filter(t => t.sessionId !== sessionId)); setSessionId(null); localStorage.removeItem('sessionId'); showToast('🔄 Сброс'); };

  const addPOTrade = (action: 'UP' | 'DOWN', symbol: string, result: 'win' | 'loss') => {
    setPoTrades(prev => [{ id: Date.now().toString(), symbol, action, result, time: new Date().toLocaleTimeString() }, ...prev]);
    showToast(result === 'win' ? '🟢 +' : '🔴 -');
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-purple-600 px-6 py-3 rounded-xl font-bold animate-pulse text-sm">{toast}</div>}
      <div className="fixed inset-0 pointer-events-none z-0">{Array.from({ length: 20 }).map((_, i) => <div key={i} className="absolute w-0.5 h-0.5 bg-purple-400 rounded-full animate-pulse" style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100}%`, animationDuration: `${3+Math.random()*4}s`, opacity: 0.06+Math.random()*0.12 }} />)}</div>

      <header className="relative z-10 border-b border-purple-500/20 bg-black/90 backdrop-blur p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4"><h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">🤖 AI SIGNAL SCANNER</h1><div className="flex gap-1 bg-black/40 rounded-lg p-1"><button onClick={() => setMode('manual')} className={`px-3 py-1.5 rounded text-xs font-bold ${mode === 'manual' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>🔍</button><button onClick={() => setMode('auto')} className={`px-3 py-1.5 rounded text-xs font-bold ${mode === 'auto' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>🤖</button></div></div>
          <div className="flex gap-4 text-sm items-center">
            <div className="text-right"><div className="text-gray-500">WR</div><div className="font-bold text-green-400">{sessionWinRate}%</div></div>
            <div className="text-right"><div className="text-gray-500">PO</div><div className={`font-bold ${poWinRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{poWinRate}%</div></div>
            <button onClick={resetSession} className="px-3 py-1.5 bg-gray-700 rounded text-xs">🔄</button>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto p-4">
        <div className="flex gap-3 mb-6">
          {!sessionId ? <button onClick={startSession} className="px-6 py-2.5 bg-green-600 rounded-xl font-bold text-sm animate-pulse">▶ Сессия</button> : <button onClick={endSession} className="px-6 py-2.5 bg-red-600 rounded-xl font-bold text-sm">⏹</button>}
          <a href="https://pocketoption.com" target="_blank" className="px-4 py-2.5 bg-yellow-600 rounded-xl font-bold text-sm">🎯 PO</a>
        </div>

        {mode === 'manual' && (
          <div className="bg-black/40 rounded-xl p-6 border border-purple-500/20 mb-6">
            <div className="flex gap-3 mb-4">
              <select value={symbol} onChange={e => setSymbol(e.target.value)} className="bg-black/60 border border-purple-500/30 rounded-lg px-4 py-3 text-white text-lg flex-1">
                <optgroup label="Валюты">
                  {TOP_PAIRS.filter(p => p.length === 6).map(p => <option key={p} value={p}>{p}</option>)}
                </optgroup>
                <optgroup label="Акции">
                  {TOP_PAIRS.filter(p => p.length <= 5).map(p => <option key={p} value={p}>{p}</option>)}
                </optgroup>
              </select>
              <button onClick={analyze} disabled={loading} className={`px-8 py-3 rounded-xl font-bold text-lg ${loading ? 'bg-gray-700 animate-pulse' : 'bg-gradient-to-r from-purple-600 to-cyan-600'}`}>{loading ? '⏳' : '🔍'}</button>
            </div>
            {analysis && (
              <div className={`p-6 rounded-xl border-2 ${analysis.action === 'LONG' ? 'bg-green-500/10 border-green-500' : analysis.action === 'SHORT' ? 'bg-red-500/10 border-red-500' : 'bg-gray-500/10 border-gray-500'}`}>
                <div className="flex justify-between items-center mb-4"><div><span className="text-3xl font-bold">{analysis.action === 'LONG' ? '📈 ВВЕРХ' : '📉 ВНИЗ'}</span><span className="ml-3 text-lg text-gray-400">{symbol}</span></div><div className="text-right"><div className={`text-3xl font-bold ${analysis.probability >= 75 ? 'text-green-400' : analysis.probability >= 65 ? 'text-yellow-400' : 'text-gray-400'}`}>{analysis.probability}%</div><div className={`text-xs font-bold mt-1 ${analysis.probability >= 75 ? 'text-green-400' : analysis.probability >= 65 ? 'text-yellow-400' : 'text-gray-400'}`}>{analysis.probability >= 75 ? '🔥 БЕРИ!' : analysis.probability >= 65 ? '👍 Можно' : '👀 Риск'}</div></div></div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 text-center"><div className="text-xs text-yellow-400">⏱ ЭКСПИРАЦИЯ (5 мин)</div><div className="text-2xl font-bold text-yellow-400">{analysis.expiryTime}</div></div>
                <div className="grid grid-cols-3 gap-2 mb-4">{analysis.predictions.map(p => <div key={p.min} className={`bg-black/40 rounded-lg p-3 text-center border ${p.direction === 'up' ? 'border-green-500/30' : 'border-red-500/30'}`}><div className="text-xs text-gray-500">{p.min}м</div><div className={`text-lg font-bold ${p.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>{p.price.toFixed(5)}</div></div>)}</div>
                <div className="grid grid-cols-4 gap-2 text-xs mb-4"><div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">RSI</div><div className={analysis.rsi < 30 ? 'text-green-400' : analysis.rsi > 70 ? 'text-red-400' : 'text-white'}>{analysis.rsi}</div></div><div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">STOCH</div><div className={analysis.stoch < 20 ? 'text-green-400' : analysis.stoch > 80 ? 'text-red-400' : 'text-white'}>{analysis.stoch}</div></div><div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">ADX</div><div className="text-white">{analysis.adx}</div></div><div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">MACD</div><div className={analysis.macd > 0 ? 'text-green-400' : 'text-red-400'}>{analysis.macd.toFixed(5)}</div></div></div>
                <div className="flex gap-3"><button onClick={() => openTrade('LONG', symbol, analysis.entry)} className={`flex-1 py-3 rounded-xl font-bold text-lg ${analysis.action === 'LONG' ? 'bg-green-600 animate-pulse' : 'bg-gray-700'}`}>🟢 ВВЕРХ</button><button onClick={() => openTrade('SHORT', symbol, analysis.entry)} className={`flex-1 py-3 rounded-xl font-bold text-lg ${analysis.action === 'SHORT' ? 'bg-red-600 animate-pulse' : 'bg-gray-700'}`}>🔴 ВНИЗ</button></div>
                <div className="flex gap-2 mt-3"><button onClick={() => addPOTrade(analysis.action === 'LONG' ? 'UP' : 'DOWN', symbol, 'win')} className="flex-1 py-2 bg-green-600/50 rounded-lg text-xs font-bold">✅ Выиграл</button><button onClick={() => addPOTrade(analysis.action === 'LONG' ? 'UP' : 'DOWN', symbol, 'loss')} className="flex-1 py-2 bg-red-600/50 rounded-lg text-xs font-bold">❌ Проиграл</button></div>
              </div>
            )}
          </div>
        )}

        {mode === 'auto' && (
          <div className="bg-black/40 rounded-xl p-6 border border-purple-500/20 mb-6">
            <div className="flex justify-between items-center mb-4"><div><h2 className="text-lg font-bold text-purple-300">🤖 АВТО-ПОИСК ({TOP_PAIRS.length} активов)</h2><p className="text-xs text-gray-500">{lastAutoScan || 'Нажми обновить'}</p></div><button onClick={autoScan} disabled={autoScanning} className={`px-4 py-2 rounded-lg text-sm font-bold ${autoScanning ? 'bg-gray-700' : 'bg-purple-600'}`}>{autoScanning ? '⏳' : '🔄'}</button></div>
            <div className="space-y-3">
              {autoSignals.map((s, i) => (
                <div key={i} className={`rounded-xl border ${s.action === 'LONG' ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                  <div className="p-4"><div className="flex justify-between items-center mb-3"><div><span className="font-bold text-lg">{s.symbol}</span><span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${s.action === 'LONG' ? 'bg-green-600' : 'bg-red-600'}`}>{s.action === 'LONG' ? '📈 ВВЕРХ' : '📉 ВНИЗ'}</span></div><div className="flex items-center gap-3"><div className={`text-lg font-bold ${s.probability >= 75 ? 'text-green-400' : 'text-yellow-400'}`}>{s.probability}%</div><span className="text-yellow-400 font-bold text-sm">⏱ {s.expiryTime}</span><button onClick={() => openTrade(s.action, s.symbol, s.price)} className={`px-4 py-2 rounded-lg text-sm font-bold ${s.action === 'LONG' ? 'bg-green-600' : 'bg-red-600'}`}>{s.action === 'LONG' ? 'ВВЕРХ' : 'ВНИЗ'}</button></div></div>
                    <div className="grid grid-cols-3 gap-2 mb-3 text-xs">{s.predictions.map(p => <div key={p.min} className={`bg-black/30 rounded p-2 text-center border ${p.direction === 'up' ? 'border-green-500/20' : 'border-red-500/20'}`}><div className="text-gray-500">{p.min}м</div><div className={`font-bold ${p.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>{p.price.toFixed(5)}</div></div>)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-black/40 rounded-xl border border-purple-500/20 overflow-hidden mb-6">
          <div className="p-3 bg-purple-950/20 border-b border-purple-500/20 text-sm font-bold text-purple-300">📊 POCKET OPTION | <span className={poWinRate >= 50 ? 'text-green-400' : 'text-red-400'}>WR: {poWinRate}% ({poWins}/{poTotal})</span></div>
          <div className="divide-y divide-gray-800 max-h-40 overflow-y-auto">
            {poTrades.length === 0 ? <div className="p-4 text-center text-gray-500 text-sm">Нет записей</div> : poTrades.map(t => (
              <div key={t.id} className="p-2 flex justify-between items-center text-sm"><div><span className={t.action === 'UP' ? 'text-green-400' : 'text-red-400'}>{t.action === 'UP' ? '📈' : '📉'}</span><span className="ml-2 text-gray-400">{t.symbol}</span></div><div className="flex items-center gap-3"><span className={t.result === 'win' ? 'text-green-400' : 'text-red-400'}>{t.result === 'win' ? '✅' : '❌'}</span></div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
