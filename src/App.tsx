import { useState, useRef, useEffect } from 'react';

const AI_TOKEN = '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';

const calcRSI = (p: number[]) => {
  if (p.length < 15) return 50;
  let g = 0, l = 0;
  for (let i = p.length - 14; i < p.length; i++) { const d = p[i] - p[i - 1]; if (d >= 0) g += d; else l -= d; }
  if (l === 0) return 100;
  return Math.round(100 - 100 / (1 + (g / 14) / (l / 14)));
};

const calcEMA = (p: number[], per: number) => {
  if (p.length < per) return p[p.length - 1] || 0;
  const k = 2 / (per + 1); let e = p[0];
  for (let i = 1; i < p.length; i++) e = (p[i] - e) * k + e;
  return e;
};

const calcMACD = (p: number[]) => p.length >= 35 ? parseFloat((calcEMA(p, 12) - calcEMA(p, 26)).toFixed(4)) : 0;

const calcStoch = (p: number[]) => {
  if (p.length < 14) return 50;
  const s = p.slice(-14); const h = Math.max(...s), l = Math.min(...s);
  return h === l ? 50 : Math.round(((p[p.length - 1] - l) / (h - l)) * 100);
};

const calcADX = (p: number[]) => {
  if (p.length < 28) return 0;
  const tr: number[] = [], pDM: number[] = [], mDM: number[] = [];
  for (let i = 1; i < p.length; i++) {
    const h = Math.max(p[i], p[i - 1]), l = Math.min(p[i], p[i - 1]);
    tr.push(h - l);
    pDM.push(Math.max(0, p[i] - p[i - 1]));
    mDM.push(Math.max(0, p[i - 1] - p[i]));
  }
  const smooth = (d: number[]) => {
    const k = 2 / 15; let e = d[0];
    for (let i = 1; i < d.length; i++) e = d[i] * k + e * (1 - k);
    return e;
  };
  const atrVal = smooth(tr);
  if (!atrVal) return 0;
  return Math.round(Math.abs(smooth(pDM) - smooth(mDM)) / (smooth(pDM) + smooth(mDM)) * 100);
};

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
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [searchSymbol, setSearchSymbol] = useState('');
  const [pairs, setPairs] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState<Trade[]>(() => JSON.parse(localStorage.getItem('trades') || '[]'));
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem('sessionId'));
  const priceCache = useRef<Map<string, number[]>>(new Map());

  const sessionTrades = trades.filter(t => t.sessionId === sessionId);
  const totalTrades = trades.filter(t => t.exitPrice !== null);
  const wins = totalTrades.filter(t => (t.profit || 0) > 0).length;
  const winRate = totalTrades.length > 0 ? Math.round((wins / totalTrades.length) * 100) : 0;
  const sessionWinRate = sessionTrades.filter(t => t.exitPrice).length > 0
    ? Math.round((sessionTrades.filter(t => (t.profit || 0) > 0).length / sessionTrades.filter(t => t.exitPrice).length) * 100) : 0;
  const totalProfit = totalTrades.reduce((s, t) => s + (t.profit || 0), 0);
  const sessionProfit = sessionTrades.reduce((s, t) => s + (t.profit || 0), 0);

  const formatPrice = (p: number) => p >= 100 ? p.toFixed(2) : p >= 1 ? p.toFixed(4) : p.toFixed(6);

  useEffect(() => {
    localStorage.setItem('trades', JSON.stringify(trades));
    if (sessionId) localStorage.setItem('sessionId', sessionId);
    else localStorage.removeItem('sessionId');
  }, [trades, sessionId]);

  useEffect(() => {
    fetch('https://api.bybit.com/v5/market/tickers?category=spot')
      .then(r => r.json())
      .then(d => {
        if (d.result?.list) {
          setPairs(d.result.list.filter((t: any) => t.symbol.endsWith('USDT')).map((t: any) => t.symbol));
        }
      });
  }, []);

  const filteredPairs = pairs.filter(p => p.includes(searchSymbol.toUpperCase())).slice(0, 50);

  const fetchKlines = async (sym: string): Promise<number[]> => {
    try {
      const res = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${sym}&interval=1&limit=100`);
      const data = await res.json();
      if (data.retCode === 0 && data.result?.list) {
        return data.result.list.reverse().map((c: any) => parseFloat(c[4]));
      }
    } catch (e) { console.error(e); }
    return [];
  };

  const analyze = async () => {
    setLoading(true);
    try {
      const klines = await fetchKlines(symbol);
      if (klines.length < 50) { setLoading(false); return; }

      const price = klines[klines.length - 1];
      const rsi = calcRSI(klines);
      const stoch = calcStoch(klines);
      const adx = calcADX(klines);
      const macd = calcMACD(klines);
      const ema20 = calcEMA(klines, 20);

      let action: 'LONG' | 'SHORT' | 'SKIP' = 'SKIP';
      let probability = 0;
      let tp = price, sl = price;

      if (rsi < 35 && stoch < 25 && macd > 0 && price > ema20 && adx > 20) {
        action = 'LONG';
        probability = rsi < 25 ? 75 : 60;
        tp = price * 1.015;
        sl = price * 0.995;
      } else if (rsi > 65 && stoch > 75 && macd < 0 && price < ema20 && adx > 20) {
        action = 'SHORT';
        probability = rsi > 75 ? 75 : 60;
        tp = price * 0.985;
        sl = price * 1.005;
      }

      let aiText = '';
      try {
        const aiRes = await fetch('https://api-inference.huggingface.co/models/google/flan-t5-small', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${AI_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputs: `${symbol}: RSI=${rsi} Stoch=${stoch} ADX=${adx}. Signal=${action}. Explain in 2 sentences.`,
            parameters: { max_new_tokens: 50, temperature: 0.3 }
          })
        });
        const aiData = await aiRes.json();
        aiText = aiData?.[0]?.generated_text || `${action} сигнал. RSI=${rsi}, Stoch=${stoch}, ADX=${adx}`;
      } catch { aiText = `${action} сигнал. RSI=${rsi}, Stoch=${stoch}, ADX=${adx}`; }

      setAnalysis({ action, probability, rsi, stoch, adx, macd, tp, sl, entry: price, aiText });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const startSession = () => {
    const id = Date.now().toString();
    setSessionId(id);
    localStorage.setItem('sessionId', id);
  };

  const endSession = () => {
    setSessionId(null);
    localStorage.removeItem('sessionId');
  };

  const openTrade = (action: 'LONG' | 'SHORT') => {
    if (!analysis || !sessionId) return;
    const trade: Trade = {
      id: Date.now().toString(),
      symbol,
      action,
      entryPrice: analysis.entry,
      exitPrice: null,
      profit: null,
      time: new Date().toLocaleString(),
      sessionId
    };
    setTrades(prev => [trade, ...prev]);
    window.open(`https://www.bybit.com/trade/spot/${symbol.replace('USDT', '')}/USDT`, '_blank');
  };

  const closeTrade = (tradeId: string) => {
    const price = analysis?.entry || 0;
    setTrades(prev => prev.map(t => {
      if (t.id !== tradeId) return t;
      const profit = t.action === 'LONG' ? (price - t.entryPrice) / t.entryPrice * 100 : (t.entryPrice - price) / t.entryPrice * 100;
      return { ...t, exitPrice: price, profit: Math.round(profit * 100) / 100 };
    }));
  };

  const deleteTrade = (tradeId: string) => {
    setTrades(prev => prev.filter(t => t.id !== tradeId));
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 pointer-events-none z-0">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="absolute w-0.5 h-0.5 bg-purple-400 rounded-full animate-pulse"
            style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100}%`, animationDuration: `${3+Math.random()*5}s`, opacity: 0.2+Math.random()*0.3 }} />
        ))}
      </div>

      <header className="relative z-10 border-b border-purple-500/20 bg-black/90 backdrop-blur p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">🤖 AI TRADING ASSISTANT</h1>
          <div className="flex gap-4 text-sm">
            <div className="text-right"><div className="text-gray-500">WR (сессия)</div><div className="font-bold text-green-400">{sessionWinRate}%</div></div>
            <div className="text-right"><div className="text-gray-500">WR (всё)</div><div className="font-bold text-yellow-400">{winRate}%</div></div>
            <div className="text-right"><div className="text-gray-500">P&L (сессия)</div><div className={`font-bold ${sessionProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{sessionProfit >= 0 ? '+' : ''}{sessionProfit}%</div></div>
            <div className="text-right"><div className="text-gray-500">P&L (всё)</div><div className={`font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalProfit >= 0 ? '+' : ''}{totalProfit}%</div></div>
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

        <div className="bg-black/40 rounded-xl p-6 border border-purple-500/20 mb-6">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <input value={searchSymbol} onChange={e => setSearchSymbol(e.target.value)} placeholder="Поиск пары (BTC, ETH...)" className="w-full bg-black/60 border border-purple-500/30 rounded-lg px-4 py-3 text-white text-lg" />
              {searchSymbol && (
                <div className="absolute top-full left-0 right-0 bg-black/90 border border-purple-500/30 rounded-lg mt-1 max-h-60 overflow-y-auto z-20">
                  {filteredPairs.map(p => (
                    <div key={p} onClick={() => { setSymbol(p); setSearchSymbol(p); }} className={`px-4 py-2 cursor-pointer hover:bg-purple-500/20 ${symbol === p ? 'bg-purple-500/30' : ''}`}>{p}</div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={analyze} disabled={loading} className={`px-8 py-3 rounded-xl font-bold text-lg transition-all ${loading ? 'bg-gray-700 animate-pulse' : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-lg shadow-purple-500/20'}`}>
              {loading ? '⏳ АНАЛИЗ...' : '🔍 АНАЛИЗИРОВАТЬ'}
            </button>
          </div>

          {analysis && (
            <div className="space-y-4 animate-[fadeIn_0.5s_ease-out]">
              <div className={`p-6 rounded-xl border-2 ${analysis.action === 'LONG' ? 'bg-green-500/10 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : analysis.action === 'SHORT' ? 'bg-red-500/10 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'bg-gray-500/10 border-gray-500'}`}>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <span className="text-3xl font-bold">{analysis.action}</span>
                    <span className="ml-3 text-lg text-gray-400">{symbol}</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${analysis.probability >= 60 ? 'text-green-400' : 'text-yellow-400'}`}>{analysis.probability}%</div>
                    <div className="text-sm text-gray-500">вероятность</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                  <div className="bg-black/40 rounded-lg p-3 text-center"><div className="text-gray-500">Вход</div><div className="text-white font-bold">${formatPrice(analysis.entry)}</div></div>
                  <div className="bg-black/40 rounded-lg p-3 text-center"><div className="text-gray-500">TP (+1.5%)</div><div className="text-green-400 font-bold">${formatPrice(analysis.tp)}</div></div>
                  <div className="bg-black/40 rounded-lg p-3 text-center"><div className="text-gray-500">SL (-0.5%)</div><div className="text-red-400 font-bold">${formatPrice(analysis.sl)}</div></div>
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
                  <button onClick={() => openTrade('LONG')} disabled={!sessionId} className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${analysis.action === 'LONG' ? 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-500/30 animate-pulse' : 'bg-gray-700'}`}>🟢 LONG</button>
                  <button onClick={() => openTrade('SHORT')} disabled={!sessionId} className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${analysis.action === 'SHORT' ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/30 animate-pulse' : 'bg-gray-700'}`}>🔴 SHORT</button>
                  <button disabled={!sessionId} className="flex-1 py-3 rounded-xl font-bold text-lg bg-gray-700">⚪ SKIP</button>
                </div>
                {!sessionId && <p className="text-xs text-gray-500 mt-2 text-center">Начни сессию чтобы открывать сделки</p>}
              </div>
            </div>
          )}
        </div>

        {analysis && (
          <div className="bg-black/40 rounded-xl border border-purple-500/20 overflow-hidden mb-6">
            <div className="p-3 bg-purple-950/20 border-b border-purple-500/20 text-sm font-bold text-purple-300">📈 ГРАФИК {symbol}</div>
            <iframe src={`https://s.tradingview.com/widgetembed/?frame_id=tv_${symbol}_${Date.now()}&symbol=BYBIT:${symbol}&interval=15&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=000&theme=dark&style=1&locale=ru`} width="100%" height="400" frameBorder="0" className="w-full" />
          </div>
        )}

        <div className="bg-black/40 rounded-xl border border-purple-500/20 overflow-hidden">
          <div className="p-3 bg-purple-950/20 border-b border-purple-500/20 text-sm font-bold text-purple-300">📜 ИСТОРИЯ СДЕЛОК ({trades.length})</div>
          <div className="divide-y divide-gray-800 max-h-60 overflow-y-auto">
            {trades.length === 0 ? <div className="p-6 text-center text-gray-500 text-sm">Нет сделок</div> : trades.map(t => (
              <div key={t.id} className="p-3 flex justify-between items-center text-sm">
                <div>
                  <span className={t.action === 'LONG' ? 'text-green-400' : 'text-red-400'}>{t.action}</span>
                  <span className="ml-2 text-gray-400">{t.symbol}</span>
                  <span className="ml-2 text-gray-600 text-xs">{t.time}</span>
                </div>
                <div className="flex items-center gap-3">
                  {t.exitPrice ? (
                    <span className={t.profit! >= 0 ? 'text-green-400' : 'text-red-400'}>{t.profit! >= 0 ? '+' : ''}{t.profit}%</span>
                  ) : (
                    <button onClick={() => closeTrade(t.id)} className="px-3 py-1 bg-red-600/50 hover:bg-red-500 rounded text-xs">Закрыть</button>
                  )}
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
