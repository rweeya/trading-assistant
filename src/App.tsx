import { useState, useEffect } from 'react';

const AI_TOKEN = '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';

const TOP_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT',
  'AVAXUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT',
  'ETCUSDT', 'FILUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'NEARUSDT',
  'INJUSDT', 'IMXUSDT', 'HBARUSDT', 'VETUSDT', 'GRTUSDT', 'RNDRUSDT', 'MKRUSDT',
  'AAVEUSDT', 'ALGOUSDT', 'FTMUSDT', 'SANDUSDT', 'MANAUSDT', 'GALAUSDT', 'AXSUSDT',
  'CHZUSDT', 'EOSUSDT', 'ZECUSDT', 'COMPUSDT', 'ICPUSDT', 'STXUSDT', 'KASUSDT',
  'RUNEUSDT', 'EGLDUSDT', 'FLOWUSDT', 'PEPEUSDT', 'WIFUSDT', 'BONKUSDT', 'SHIBUSDT',
  'SEIUSDT', 'WLDUSDT', 'TIAUSDT', 'JUPUSDT', 'PYTHUSDT', 'ENAUSDT', 'FETUSDT',
  'BEAMUSDT', 'BLURUSDT', 'ORDIUSDT', 'PENDLEUSDT', 'ENSUSDT', 'LDOUSDT',
  'TONUSDT', 'NOTUSDT', 'MEWUSDT', 'POPCATUSDT', 'RAYUSDT', 'JTOUSDT',
  'TRXUSDT', 'XLMUSDT', 'XTZUSDT', 'CAKEUSDT', '1INCHUSDT', 'SNXUSDT', 'CRVUSDT',
  'ZROUSDT', 'ZKUSDT', 'ALTUSDT', 'PORTALUSDT', 'AIUSDT', 'BOMEUSDT',
  'TURBOUSDT', 'MEMEUSDT', 'BANANAUSDT', 'RAREUSDT', 'BBUSDT', 'IOUSDT',
  'PIXELUSDT', 'SAGAUSDT', 'DYMUSDT', 'OMNIUSDT', 'REZUSDT', 'ETHFIUSDT',
  'STRKUSDT', 'GMXUSDT', 'LRCUSDT', 'SUPERUSDT', 'MINAUSDT', 'YGGUSDT',
  'CKBUSDT', 'SUSHIUSDT', 'THETAUSDT', 'APEUSDT', 'BALUSDT', 'ENJUSDT',
  'HOTUSDT', 'JASMYUSDT', 'KDAUSDT', 'MAGICUSDT', 'OCEANUSDT', 'QNTUSDT',
  'RVNUSDT', 'SKLUSDT', 'STORJUSDT', 'UMAUSDT', 'WOOUSDT', 'ZILUSDT',
  'ZRXUSDT', 'ANKRUSDT', 'ASTRUSDT', 'BANDUSDT', 'CELRUSDT', 'DENTUSDT',
  'DYDXUSDT', 'GLMRUSDT', 'ICXUSDT', 'IOSTUSDT', 'IOTXUSDT', 'JOEUSDT',
  'KNCUSDT', 'LINAUSDT', 'LPTUSDT', 'MOVRUSDT', 'NKNUSDT', 'OGNUSDT',
  'OMUSDT', 'ONTUSDT', 'PERPUSDT', 'POWRUSDT', 'RENUSDT', 'ROSEUSDT',
  'SFPUSDT', 'SPELLUSDT', 'SSVUSDT', 'SXPUSDT', 'TRBUSDT', 'TRUUSDT',
  'VRAUSDT', 'WAXPUSDT', 'CFXUSDT', 'MASKUSDT', 'CELOUSDT', 'COTIUSDT',
  'STEEMUSDT', 'SUNUSDT', 'TLMUSDT', 'TOMIUSDT', 'TWTUSDT', 'UNFIUSDT',
  'USTCUSDT', 'UTKUSDT', 'VTHOUSDT', 'WAVESUSDT', 'XVGUSDT', 'XVSUSDT',
  'ZENUSDT', 'ZILUSDT'
];

const calcRSI = (p: number[]): number => {
  if (p.length < 15) return 50;
  let g = 0, l = 0;
  for (let i = p.length - 14; i < p.length; i++) { const d = p[i] - p[i - 1]; if (d >= 0) g += d; else l -= d; }
  if (l === 0) return 100;
  return Math.round(100 - 100 / (1 + (g / 14) / (l / 14)));
};

const calcEMA = (p: number[], per: number): number => {
  if (p.length < per) return p[p.length - 1] || 0;
  const k = 2 / (per + 1); let e = p[0];
  for (let i = 1; i < p.length; i++) e = (p[i] - e) * k + e;
  return e;
};

const calcMACD = (p: number[]): number => p.length >= 35 ? parseFloat((calcEMA(p, 12) - calcEMA(p, 26)).toFixed(4)) : 0;

const calcStoch = (p: number[]): number => {
  if (p.length < 14) return 50;
  const s = p.slice(-14); const h = Math.max(...s), l = Math.min(...s);
  return h === l ? 50 : Math.round(((p[p.length - 1] - l) / (h - l)) * 100);
};

const calcADX = (p: number[]): number => {
  if (p.length < 28) return 0;
  const tr: number[] = [], pDM: number[] = [], mDM: number[] = [];
  for (let i = 1; i < p.length; i++) {
    tr.push(Math.max(p[i], p[i - 1]) - Math.min(p[i], p[i - 1]));
    pDM.push(Math.max(0, p[i] - p[i - 1]));
    mDM.push(Math.max(0, p[i - 1] - p[i]));
  }
  const smooth = (d: number[]): number => { const k = 2 / 15; let e = d[0]; for (let i = 1; i < d.length; i++) e = d[i] * k + e * (1 - k); return e; };
  const a = smooth(tr); if (!a) return 0;
  return Math.round(Math.abs(smooth(pDM) - smooth(mDM)) / (smooth(pDM) + smooth(mDM)) * 100);
};

interface Signal {
  symbol: string;
  action: 'LONG' | 'SHORT';
  probability: number;
  rsi: number; stoch: number; adx: number; macd: number;
  price: number; tp: number; sl: number;
  aiReason: string;
}

interface Analysis {
  action: 'LONG' | 'SHORT' | 'SKIP';
  probability: number;
  rsi: number; stoch: number; adx: number; macd: number;
  tp: number; sl: number; entry: number;
  aiText: string;
}

interface Trade {
  id: string;
  symbol: string;
  action: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number | null;
  profit: number | null;
  time: string;
  sessionId: string;
}

const App = () => {
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [searchSymbol, setSearchSymbol] = useState('');
  const [pairs, setPairs] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState<Trade[]>(() => JSON.parse(localStorage.getItem('trades') || '[]'));
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem('sessionId'));
  const [autoSignals, setAutoSignals] = useState<Signal[]>([]);
  const [autoScanning, setAutoScanning] = useState(false);
  const [lastAutoScan, setLastAutoScan] = useState('');

  const sessionTrades = trades.filter((t: Trade) => t.sessionId === sessionId);
  const totalTrades = trades.filter((t: Trade) => t.exitPrice !== null);
  const wins = totalTrades.filter((t: Trade) => (t.profit || 0) > 0).length;
  const winRate = totalTrades.length > 0 ? Math.round((wins / totalTrades.length) * 100) : 0;
  const sessionWinRate = sessionTrades.filter((t: Trade) => t.exitPrice).length > 0
    ? Math.round((sessionTrades.filter((t: Trade) => (t.profit || 0) > 0).length / sessionTrades.filter((t: Trade) => t.exitPrice).length) * 100) : 0;
  const totalProfit = totalTrades.reduce((s: number, t: Trade) => s + (t.profit || 0), 0);
  const sessionProfit = sessionTrades.reduce((s: number, t: Trade) => s + (t.profit || 0), 0);

  const formatPrice = (p: number): string => p >= 100 ? p.toFixed(2) : p >= 1 ? p.toFixed(4) : p.toFixed(6);

  useEffect(() => {
    localStorage.setItem('trades', JSON.stringify(trades));
    if (sessionId) localStorage.setItem('sessionId', sessionId);
  }, [trades, sessionId]);

  useEffect(() => {
    fetch('https://api.bybit.com/v5/market/tickers?category=spot')
      .then(r => r.json())
      .then(d => { if (d.result?.list) setPairs(d.result.list.filter((t: any) => t.symbol.endsWith('USDT')).map((t: any) => t.symbol)); });
  }, []);

  const filteredPairs = pairs.filter((p: string) => p.includes(searchSymbol.toUpperCase())).slice(0, 50);

  const fetchKlines = async (sym: string): Promise<number[]> => {
    try {
      const res = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${sym}&interval=1&limit=100`);
      const data = await res.json();
      if (data.retCode === 0 && data.result?.list) return data.result.list.reverse().map((c: any) => parseFloat(c[4]));
    } catch (e) { console.error(e); }
    return [];
  };

  const getAI = async (sym: string, rsi: number, stoch: number, adx: number, action: string): Promise<string> => {
    try {
      const res = await fetch('https://api-inference.huggingface.co/models/google/flan-t5-small', {
        method: 'POST', headers: { 'Authorization': `Bearer ${AI_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: `${sym}: RSI=${rsi} Stoch=${stoch} ADX=${adx}. Signal=${action}. Explain in 2 sentences.`, parameters: { max_new_tokens: 50, temperature: 0.3 } })
      });
      const d = await res.json();
      return d?.[0]?.generated_text || `${action} сигнал. RSI=${rsi}, Stoch=${stoch}, ADX=${adx}`;
    } catch { return `${action} сигнал. RSI=${rsi}, Stoch=${stoch}, ADX=${adx}`; }
  };

  const analyzeSymbol = async (sym: string): Promise<Analysis | null> => {
    const klines = await fetchKlines(sym);
    if (klines.length < 50) return null;
    const price = klines[klines.length - 1];
    const rsi = calcRSI(klines), stoch = calcStoch(klines), adx = calcADX(klines), macd = calcMACD(klines), ema20 = calcEMA(klines, 20);
    let action: 'LONG' | 'SHORT' | 'SKIP' = 'SKIP', probability = 0, tp = price, sl = price;
    if (rsi < 35 && stoch < 25 && macd > 0 && price > ema20 && adx > 20) { action = 'LONG'; probability = rsi < 25 ? 75 : 60; tp = price * 1.015; sl = price * 0.995; }
    else if (rsi > 65 && stoch > 75 && macd < 0 && price < ema20 && adx > 20) { action = 'SHORT'; probability = rsi > 75 ? 75 : 60; tp = price * 0.985; sl = price * 1.005; }
    const aiText = await getAI(sym, rsi, stoch, adx, action);
    return { action, probability, rsi, stoch, adx, macd, tp, sl, entry: price, aiText };
  };

  const analyze = async () => { setLoading(true); const r = await analyzeSymbol(symbol); if (r) setAnalysis(r); setLoading(false); };

  const autoScan = async () => {
    setAutoScanning(true);
    const signals: Signal[] = [];
    for (let i = 0; i < TOP_PAIRS.length; i += 5) {
      const batch = TOP_PAIRS.slice(i, i + 5);
      const results = await Promise.all(batch.map(sym => analyzeSymbol(sym)));
      results.forEach((r, idx) => {
        if (r && r.action !== 'SKIP') signals.push({ symbol: batch[idx], action: r.action, probability: r.probability, rsi: r.rsi, stoch: r.stoch, adx: r.adx, macd: r.macd, price: r.entry, tp: r.tp, sl: r.sl, aiReason: r.aiText });
      });
      setAutoSignals([...signals].sort((a: Signal, b: Signal) => b.probability - a.probability));
      await new Promise(r => setTimeout(r, 500));
    }
    setLastAutoScan(new Date().toLocaleTimeString());
    setAutoScanning(false);
  };

  useEffect(() => { if (mode === 'auto') { autoScan(); const interval = setInterval(autoScan, 120000); return () => clearInterval(interval); } }, [mode]);

  const startSession = () => { const id = Date.now().toString(); setSessionId(id); localStorage.setItem('sessionId', id); };
  const endSession = () => { setSessionId(null); localStorage.removeItem('sessionId'); };

  const openTrade = (action: 'LONG' | 'SHORT', sym: string, price: number) => {
    if (!sessionId) return;
    setTrades((prev: Trade[]) => [{ id: Date.now().toString(), symbol: sym, action, entryPrice: price, exitPrice: null, profit: null, time: new Date().toLocaleString(), sessionId }, ...prev]);
    window.open(`https://www.bybit.com/trade/spot/${sym.replace('USDT', '')}/USDT`, '_blank');
  };

  const closeTrade = (tradeId: string, price: number) => {
    setTrades((prev: Trade[]) => prev.map((t: Trade) => {
      if (t.id !== tradeId) return t;
      const profit = t.action === 'LONG' ? (price - t.entryPrice) / t.entryPrice * 100 : (t.entryPrice - price) / t.entryPrice * 100;
      return { ...t, exitPrice: price, profit: Math.round(profit * 100) / 100 };
    }));
  };

  const deleteTrade = (tradeId: string) => setTrades((prev: Trade[]) => prev.filter((t: Trade) => t.id !== tradeId));

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 pointer-events-none z-0">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="absolute w-0.5 h-0.5 bg-purple-400 rounded-full animate-pulse"
            style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100}%`, animationDuration: `${2+Math.random()*4}s`, opacity: 0.15+Math.random()*0.3 }} />
        ))}
      </div>

      <header className="relative z-10 border-b border-purple-500/20 bg-black/90 backdrop-blur p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">🤖 AI TRADING ASSISTANT</h1>
            <div className="flex gap-1 bg-black/40 rounded-lg p-1">
              <button onClick={() => setMode('manual')} className={`px-3 py-1.5 rounded text-xs font-bold ${mode === 'manual' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>🔍 Вручную</button>
              <button onClick={() => setMode('auto')} className={`px-3 py-1.5 rounded text-xs font-bold ${mode === 'auto' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>🤖 Авто-поиск</button>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-right"><div className="text-gray-500">WR сессия</div><div className="font-bold text-green-400">{sessionWinRate}%</div></div>
            <div className="text-right"><div className="text-gray-500">WR всего</div><div className="font-bold text-yellow-400">{winRate}%</div></div>
            <div className="text-right"><div className="text-gray-500">P&L сессия</div><div className={`font-bold ${sessionProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{sessionProfit >= 0 ? '+' : ''}{sessionProfit}%</div></div>
            <div className="text-right"><div className="text-gray-500">P&L всего</div><div className={`font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalProfit >= 0 ? '+' : ''}{totalProfit}%</div></div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto p-4">
        <div className="flex gap-3 mb-6">
          {!sessionId ? (
            <button onClick={startSession} className="px-6 py-2.5 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-sm animate-pulse">▶ Начать сессию</button>
          ) : (
            <button onClick={endSession} className="px-6 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-sm">⏹ Завершить сессию</button>
          )}
          {!sessionId && <span className="text-sm text-gray-500 self-center">Начни сессию чтобы отслеживать сделки</span>}
        </div>

        {mode === 'manual' && (
          <div className="bg-black/40 rounded-xl p-6 border border-purple-500/20 mb-6">
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <input value={searchSymbol} onChange={e => setSearchSymbol(e.target.value)} placeholder="Поиск пары..." className="w-full bg-black/60 border border-purple-500/30 rounded-lg px-4 py-3 text-white text-lg" />
                {searchSymbol && (
                  <div className="absolute top-full left-0 right-0 bg-black/90 border border-purple-500/30 rounded-lg mt-1 max-h-60 overflow-y-auto z-20">
                    {filteredPairs.map((p: string) => (
                      <div key={p} onClick={() => { setSymbol(p); setSearchSymbol(p); }} className={`px-4 py-2 cursor-pointer hover:bg-purple-500/20 ${symbol === p ? 'bg-purple-500/30' : ''}`}>{p}</div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={analyze} disabled={loading} className={`px-8 py-3 rounded-xl font-bold text-lg transition-all ${loading ? 'bg-gray-700 animate-pulse' : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-lg shadow-purple-500/20'}`}>{loading ? '⏳' : '🔍 АНАЛИЗ'}</button>
            </div>
            {analysis && (
              <div className={`p-6 rounded-xl border-2 ${analysis.action === 'LONG' ? 'bg-green-500/10 border-green-500' : analysis.action === 'SHORT' ? 'bg-red-500/10 border-red-500' : 'bg-gray-500/10 border-gray-500'}`}>
                <div className="flex justify-between items-center mb-4">
                  <div><span className="text-3xl font-bold">{analysis.action}</span><span className="ml-3 text-lg text-gray-400">{symbol}</span></div>
                  <div className={`text-3xl font-bold ${analysis.probability >= 60 ? 'text-green-400' : 'text-yellow-400'}`}>{analysis.probability}%</div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                  <div className="bg-black/40 rounded-lg p-3 text-center"><div className="text-gray-500">Вход</div><div className="text-white font-bold">${formatPrice(analysis.entry)}</div></div>
                  <div className="bg-black/40 rounded-lg p-3 text-center"><div className="text-gray-500">TP</div><div className="text-green-400 font-bold">${formatPrice(analysis.tp)}</div></div>
                  <div className="bg-black/40 rounded-lg p-3 text-center"><div className="text-gray-500">SL</div><div className="text-red-400 font-bold">${formatPrice(analysis.sl)}</div></div>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-4">
                  <div className="text-xs text-purple-400 mb-1">🤖 AI АНАЛИЗ</div>
                  <div className="text-sm text-gray-300">{analysis.aiText}</div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs mb-4">
                  <div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">RSI</div><div className={analysis.rsi < 30 ? 'text-green-400' : analysis.rsi > 70 ? 'text-red-400' : 'text-white'}>{analysis.rsi}</div></div>
                  <div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">STOCH</div><div className={analysis.stoch < 20 ? 'text-green-400' : analysis.stoch > 80 ? 'text-red-400' : 'text-white'}>{analysis.stoch}</div></div>
                  <div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">ADX</div><div className="text-white">{analysis.adx}</div></div>
                  <div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">MACD</div><div className={analysis.macd > 0 ? 'text-green-400' : 'text-red-400'}>{analysis.macd.toFixed(4)}</div></div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => openTrade('LONG', symbol, analysis.entry)} disabled={!sessionId} className={`flex-1 py-3 rounded-xl font-bold text-lg ${analysis.action === 'LONG' ? 'bg-green-600 animate-pulse' : 'bg-gray-700'}`}>🟢 LONG</button>
                  <button onClick={() => openTrade('SHORT', symbol, analysis.entry)} disabled={!sessionId} className={`flex-1 py-3 rounded-xl font-bold text-lg ${analysis.action === 'SHORT' ? 'bg-red-600 animate-pulse' : 'bg-gray-700'}`}>🔴 SHORT</button>
                  <button disabled={!sessionId} className="flex-1 py-3 rounded-xl font-bold text-lg bg-gray-700">⚪ SKIP</button>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'auto' && (
          <div className="bg-black/40 rounded-xl p-6 border border-purple-500/20 mb-6">
            <div className="flex justify-between items-center mb-4">
              <div><h2 className="text-lg font-bold text-purple-300">🤖 АВТО-ПОИСК</h2><p className="text-xs text-gray-500">{TOP_PAIRS.length} пар · {lastAutoScan || '...'}</p></div>
              <button onClick={autoScan} disabled={autoScanning} className={`px-4 py-2 rounded-lg text-sm font-bold ${autoScanning ? 'bg-gray-700' : 'bg-purple-600'}`}>{autoScanning ? '...' : '🔄'}</button>
            </div>
            <div className="space-y-3">
              {autoSignals.map((s: Signal, i: number) => (
                <div key={i} className={`rounded-xl border ${s.action === 'LONG' ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div><span className="font-bold text-lg">{s.symbol}</span><span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${s.action === 'LONG' ? 'bg-green-600' : 'bg-red-600'}`}>{s.action}</span></div>
                      <div className="flex items-center gap-3">
                        <div className={`text-lg font-bold ${s.probability >= 60 ? 'text-green-400' : 'text-yellow-400'}`}>{s.probability}%</div>
                        <button onClick={() => openTrade(s.action, s.symbol, s.price)} disabled={!sessionId} className={`px-4 py-2 rounded-lg text-sm font-bold ${s.action === 'LONG' ? 'bg-green-600' : 'bg-red-600'}`}>{s.action}</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
                      <div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">Цена</div><div className="text-white">${formatPrice(s.price)}</div></div>
                      <div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">TP</div><div className="text-green-400">${formatPrice(s.tp)}</div></div>
                      <div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">SL</div><div className="text-red-400">${formatPrice(s.sl)}</div></div>
                      <div className="bg-black/30 rounded p-2 text-center"><div className="text-gray-500">Инд</div><div className="text-white text-[10px]">RSI:{s.rsi} ST:{s.stoch} ADX:{s.adx}</div></div>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3"><div className="text-xs text-purple-400 mb-1">🤖 AI</div><div className="text-xs text-gray-300">{s.aiReason}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis && mode === 'manual' && (
          <div className="bg-black/40 rounded-xl border border-purple-500/20 overflow-hidden mb-6">
            <div className="p-3 bg-purple-950/20 border-b border-purple-500/20 text-sm font-bold text-purple-300">📈 ГРАФИК {symbol}</div>
            <iframe src={`https://s.tradingview.com/widgetembed/?frame_id=tv_${symbol}_${Date.now()}&symbol=BYBIT:${symbol}&interval=15&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=000&theme=dark&style=1&locale=ru`} width="100%" height="400" frameBorder="0" className="w-full" />
          </div>
        )}

        <div className="bg-black/40 rounded-xl border border-purple-500/20 overflow-hidden">
          <div className="p-3 bg-purple-950/20 border-b border-purple-500/20 text-sm font-bold text-purple-300">📜 ИСТОРИЯ ({trades.length})</div>
          <div className="divide-y divide-gray-800 max-h-60 overflow-y-auto">
            {trades.length === 0 ? <div className="p-6 text-center text-gray-500 text-sm">Нет сделок</div> : trades.map((t: Trade) => (
              <div key={t.id} className="p-3 flex justify-between items-center text-sm">
                <div><span className={t.action === 'LONG' ? 'text-green-400' : 'text-red-400'}>{t.action}</span><span className="ml-2 text-gray-400">{t.symbol}</span><span className="ml-2 text-gray-600 text-xs">{t.time}</span></div>
                <div className="flex items-center gap-3">
                  {t.exitPrice ? <span className={t.profit! >= 0 ? 'text-green-400' : 'text-red-400'}>{t.profit! >= 0 ? '+' : ''}{t.profit}%</span> : <button onClick={() => closeTrade(t.id, analysis?.entry || 0)} className="px-3 py-1 bg-red-600/50 rounded text-xs">Закрыть</button>}
                  <button onClick={() => deleteTrade(t.id)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
