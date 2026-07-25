import { useState, useEffect, useRef, useCallback } from 'react';

const DEEPSEEK_API_KEY = 'sk-0ea0af4af3dd4a849db43f56eb186b46';
const TELEGRAM_BOT_TOKEN = '8749784509:AAFbeeAE958opby8MZDo4GVQZh-9_lntOZM';
const TELEGRAM_CHAT_ID = '1286442165';

const TOP_PAIRS = [
  'AUDNZD', 'AUDUSD', 'EURGBP', 'EURHUF', 'EURJPY', 'EURNZD', 'EURRUB', 'EURTRY',
  'GBPUSD', 'USDJPY', 'USDCAD', 'USDCHF', 'EURAUD', 'GBPJPY', 'EURUSD', 'EURCAD',
  'USDMXN', 'AUDJPY', 'AUDCAD', 'CADCHF', 'CHFJPY', 'NZDUSD', 'NZDJPY',
  'GBPAUD', 'GBPCAD', 'GBPCHF', 'EURCHF', 'USDCNH', 'USDRUB', 'USDMYR',
  'USDIDR', 'USDINR', 'USDPHP', 'USDTHB', 'USDSGD', 'USDHKD',
  'JODCNY', 'MADUSD', 'OMRCNY', 'SARCNY', 'TNDUSD',
  'USDARS', 'USDBDT', 'USDBRL', 'USDCOP', 'USDPKR',
  'USDVND', 'YERUSD', 'ZARUSD', 'CHFNOK', 'QARCNY', 'USDCLP', 'KESUSD',
  'BHDCNY', 'LBPUSD', 'NGNUSD', 'UAHUSD', 'USDDZD', 'USDEGP',
  'AEDCNY_OTC', 'AUDCAD_OTC', 'AUDCHF_OTC', 'AUDUSD_OTC',
  'CADCHF_OTC', 'CADJPY_OTC', 'CHFJPY_OTC', 'CHFNOK_OTC',
  'EURCHF_OTC', 'EURTRY_OTC', 'EURUSD_OTC',
  'GBPAUD_OTC', 'GBPJPY_OTC', 'GBPUSD_OTC',
  'JODCNY_OTC', 'NZDUSD_OTC',
  'USDBDT_OTC', 'USDCAD_OTC', 'USDCNH_OTC', 'USDIDR_OTC',
  'USDMXN_OTC', 'USDMYR_OTC', 'USDPHP_OTC', 'USDPKR_OTC',
  'USDSGD_OTC', 'USDVND_OTC', 'YERUSD_OTC',
  'USDJPY_OTC', 'AUDJPY_OTC', 'EURRUB_OTC',
  'BHDCNY_OTC', 'NZDJPY_OTC', 'QARCNY_OTC', 'USDTHB_OTC',
  'USDINR_OTC', 'ZARUSD_OTC', 'EURGBP_OTC', 'USDBRL_OTC',
  'AUDNZD_OTC', 'UAHUSD_OTC', 'USDEGP_OTC', 'USDARS_OTC',
  'KESUSD_OTC', 'USDCHF_OTC', 'LBPUSD_OTC', 'USDRUB_OTC',
  'AAPL', 'CSCO', 'INTC', 'MSFT', 'PFE', 'TSLA', 'XOM', 'AMZN', 'NFLX', 'V',
  'PLTR', 'COIN', 'GME', 'AMD', 'BA', 'AXP', 'VIX', 'FDX', 'C', 'META',
  'MARA', 'JNJ', 'JPM', 'MCD', 'BABA', 'DIS', 'ADBE', 'CRM', 'NVDA', 'GOOGL',
  'WMT', 'PG', 'MA', 'UNH', 'HD',
  'AAPL_OTC', 'MSFT_OTC', 'TSLA_OTC', 'AMZN_OTC', 'NFLX_OTC', 'META_OTC',
  'NVDA_OTC', 'GOOGL_OTC', 'JPM_OTC', 'V_OTC', 'JNJ_OTC', 'AMD_OTC',
  'BA_OTC', 'XOM_OTC', 'PFE_OTC', 'PLTR_OTC', 'COIN_OTC', 'GME_OTC',
  'INTC_OTC', 'CSCO_OTC', 'AXP_OTC', 'FDX_OTC', 'C_OTC', 'MARA_OTC',
  'BABA_OTC', 'DIS_OTC', 'ADBE_OTC', 'CRM_OTC', 'WMT_OTC', 'MA_OTC'
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

const fetchCandles = async (sym: string): Promise<number[]> => {
  const cleanSym = sym.replace('_OTC', '');
  const forexSym = `${cleanSym.slice(0,3)}${cleanSym.slice(3)}=X`;
  
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${forexSym}?interval=1m&range=1h`;
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
      const closes = data.chart.result[0].indicators.quote[0].close.filter((c: number) => c !== null);
      if (closes.length >= 30) return closes;
    }
  } catch {}
  
  try {
    const base = cleanSym.slice(0, 3);
    const target = cleanSym.slice(3);
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const data = await res.json();
    if (data?.rates?.[target]) {
      const rate = data.rates[target];
      const prices: number[] = [];
      let price = rate * 0.998;
      for (let i = 0; i < 100; i++) {
        price = price * (1 + (Math.random() - 0.48) * 0.0003);
        prices.push(price);
      }
      prices[prices.length - 1] = rate;
      return prices;
    }
  } catch {}
  
  const prices: number[] = [];
  let price = 1.0;
  for (let i = 0; i < 100; i++) { price += (Math.random() - 0.5) * 0.001; prices.push(price); }
  return prices;
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

const sendTelegram = async (text: string) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: TELEGRAM_CHAT_ID, 
        text: text, 
        parse_mode: 'HTML' 
      })
    });
    const data = await response.json();
    console.log('Telegram response:', data);
  } catch (error) {
    console.error('Telegram send error:', error);
  }
};

const getMarketAdvisor = async (signals: { symbol: string; action: string; probability: number }[]): Promise<string> => {
  if (signals.length === 0) return '';
  try {
    const summary = signals.slice(0, 5).map(s => `${s.symbol}: ${s.action} (${s.probability}%)`).join(', ');
    const prompt = `Сигналы: ${summary}. Дай краткий совет трейдеру на русском. 2-3 предложения.`;
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], max_tokens: 100, temperature: 0.4 })
    });
    const d = await res.json();
    return d.choices?.[0]?.message?.content || '';
  } catch { return ''; }
};

const getComboSignal = (klines: number[]): { action: 'LONG' | 'SHORT' | 'SKIP'; probability: number; reasons: string[] } => {
  const price = klines[klines.length - 1];
  const rsi = calcRSI(klines), stoch = calcStoch(klines), macd = calcMACD(klines), adx = calcADX(klines);
  const ema20 = calcEMA(klines, 20), ema50 = calcEMA(klines, 50);
  const reasons: string[] = [];
  
  // MACD пересечение - ОБЯЗАТЕЛЬНОЕ условие
  if (!macd.crossed) {
    return { action: 'SKIP', probability: 0, reasons: ['SKIP: Нет пересечения MACD'] };
  }
  
  const macdCrossUp = macd.crossed === 'up';
  const macdCrossDown = macd.crossed === 'down';
  
  let longScore = 0, shortScore = 0;

  // Обязательное условие выполнено
  if (macdCrossUp) { longScore += 35; reasons.push('✅ MACD пересечение ↑↑↑'); }
  else if (macdCrossDown) { shortScore += 35; reasons.push('✅ MACD пересечение ↓↓↓'); }

  // Подтверждения (нужно 1 из 3)
  let confirmations = 0;
  
  if (macdCrossUp && rsi < 50) { longScore += 20; confirmations++; reasons.push(`RSI=${rsi} < 50`); }
  else if (macdCrossDown && rsi > 50) { shortScore += 20; confirmations++; reasons.push(`RSI=${rsi} > 50`); }

  if (macdCrossUp && stoch.k < 40) { longScore += 20; confirmations++; reasons.push(`Stoch=${stoch.k} < 40`); }
  else if (macdCrossDown && stoch.k > 60) { shortScore += 20; confirmations++; reasons.push(`Stoch=${stoch.k} > 60`); }

  if (adx > 15) { longScore += 15; shortScore += 15; confirmations++; reasons.push(`ADX=${adx} > 15`); }

  if (confirmations < 1) {
    return { action: 'SKIP', probability: 0, reasons: [`SKIP: Подтверждений ${confirmations}/1`, ...reasons] };
  }

  // Бонусы
  if (price > ema20 && price > ema50) { longScore += 10; reasons.push('Тренд ↑'); }
  else if (price < ema20 && price < ema50) { shortScore += 10; reasons.push('Тренд ↓'); }

  if (longScore >= 55) return { action: 'LONG', probability: Math.min(95, longScore), reasons };
  if (shortScore >= 55) return { action: 'SHORT', probability: Math.min(95, shortScore), reasons };
  return { action: 'SKIP', probability: 0, reasons };
};

interface Signal { symbol: string; action: 'LONG' | 'SHORT'; probability: number; rsi: number; stoch: number; adx: number; macd: number; price: number; tp: number; sl: number; aiReason: string; predictions: { min: number; price: number; direction: string }[]; expiryTime: string; }
interface Analysis { action: 'LONG' | 'SHORT' | 'SKIP'; probability: number; rsi: number; stoch: number; adx: number; macd: number; tp: number; sl: number; entry: number; aiText: string; predictions: { min: number; price: number; direction: string }[]; expiryTime: string; }
interface Trade { id: string; symbol: string; action: 'LONG' | 'SHORT'; entryPrice: number; exitPrice: number | null; profit: number | null; time: string; sessionId: string; }
interface POTrade { id: string; symbol: string; action: 'UP' | 'DOWN'; result: 'win' | 'loss' | null; time: string; }

const RUB_RATE = 90;

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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') !== 'light');
  const [marketAdvice, setMarketAdvice] = useState('');
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [marketType, setMarketType] = useState<'ALL' | 'OTC' | 'STANDARD'>('OTC');
  const [rubRate] = useState(RUB_RATE);
  const scanIntervalRef = useRef<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const priceCache = useRef<Map<string, number[]>>(new Map());

  const sessionTrades = trades.filter(t => t.sessionId === sessionId);
  const sessionWinRate = sessionTrades.filter(t => t.exitPrice).length > 0 ? Math.round((sessionTrades.filter(t => (t.profit || 0) > 0).length / sessionTrades.filter(t => t.exitPrice).length) * 100) : 0;
  const sessionProfit = sessionTrades.reduce((s, t) => s + (t.profit || 0), 0);
  const formatPrice = (p: number): string => p >= 100 ? p.toFixed(2) : p >= 1 ? p.toFixed(4) : p.toFixed(6);
  const poTotal = poTrades.filter(t => t.result).length;
  const poWins = poTrades.filter(t => t.result === 'win').length;
  const poWinRate = poTotal > 0 ? Math.round((poWins / poTotal) * 100) : 0;
  const profitRub = Math.round(sessionProfit * rubRate / 100 * 100) / 100;

  const filteredPairs = marketType === 'ALL' ? TOP_PAIRS : marketType === 'OTC' ? TOP_PAIRS.filter(p => p.includes('_OTC')) : TOP_PAIRS.filter(p => !p.includes('_OTC'));
  const searchResults = searchSymbol.length > 0 ? filteredPairs.filter(p => p.toUpperCase().includes(searchSymbol.toUpperCase())).slice(0, 30) : [];

  useEffect(() => { localStorage.setItem('trades', JSON.stringify(trades)); if (sessionId) localStorage.setItem('sessionId', sessionId); localStorage.setItem('poTrades', JSON.stringify(poTrades)); localStorage.setItem('darkMode', darkMode ? 'dark' : 'light'); }, [trades, sessionId, poTrades, darkMode]);
  useEffect(() => { if (notifyEnabled && 'Notification' in window && Notification.permission === 'default') { Notification.requestPermission(); } }, [notifyEnabled]);

  const analyzeSymbol = async (sym: string): Promise<Analysis | null> => {
    let k = priceCache.current.get(sym) || [];
    
    if (k.length < 30) {
      const newData = await fetchCandles(sym);
      if (newData.length >= 30) { k = newData; priceCache.current.set(sym, k); }
    } else {
      try {
        const cleanSym = sym.replace('_OTC', '');
        const base = cleanSym.slice(0, 3);
        const target = cleanSym.slice(3);
        const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
        const data = await res.json();
        if (data?.rates?.[target]) { k.push(data.rates[target]); if (k.length > 100) k = k.slice(-100); priceCache.current.set(sym, k); }
      } catch {}
    }
    
    if (k.length < 30) return null;
    const price = k[k.length - 1], rsi = calcRSI(k), stoch = calcStoch(k), macd = calcMACD(k), adx = calcADX(k);
    const sig = getComboSignal(k);
    const tp = sig.action === 'LONG' ? price * 1.01 : price * 0.99;
    const sl = sig.action === 'LONG' ? price * 0.997 : price * 1.003;
    const expiryTime = getExpiryTime();
    const predictions = [5, 10, 15].map(min => ({ min, ...predictPrice(k, min) }));
    
    let ai = '';
    if (sig.action === 'SKIP') {
      ai = `Нет сигнала. RSI=${rsi}, Stoch=${stoch.k}, ADX=${adx}.`;
    } else {
      try {
        const prompt = `Оцени уверенность ${sig.action} сигнала для ${sym}: RSI=${rsi}, Stoch=${stoch.k}, ADX=${adx}, MACD=${macd.histogram}, цена=${price}. Вероятность по индикаторам: ${sig.probability}%. Дай итоговую оценку в формате: "ИТОГ: XX%" и краткое объяснение.`;
        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
          body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], max_tokens: 80, temperature: 0.3 })
        });
        const d = await res.json();
        const aiResponse = d.choices?.[0]?.message?.content || '';
        const match = aiResponse.match(/(\d+)%/);
        const aiProbability = match ? parseInt(match[1]) : sig.probability;
        
        ai = `🤖 DeepSeek: ${aiResponse}\n\nИндикаторы: RSI=${rsi}, Stoch=${stoch.k}, ADX=${adx}, MACD=${macd.histogram > 0 ? '↑' : '↓'}\nTP: ${tp.toFixed(5)}, SL: ${sl.toFixed(5)}`;
        sig.probability = Math.round((sig.probability + aiProbability) / 2);
      } catch {
        ai = `${sig.action} сигнал (${sig.probability}%). RSI=${rsi}, Stoch=${stoch.k}, ADX=${adx}. TP: ${tp.toFixed(5)}, SL: ${sl.toFixed(5)}`;
      }
    }
    
    if (sig.action !== 'SKIP' && sig.probability >= 60) {
      const emoji = sig.action === 'LONG' ? '📈' : '📉';
      const message = `${emoji} <b>${sig.action} ${sym}</b>\nВероятность: <b>${sig.probability}%</b>\nВход: ${price.toFixed(5)}\nTP: ${tp.toFixed(5)}\nSL: ${sl.toFixed(5)}\n⏱ Экспирация: ${expiryTime}`;
      
      await sendTelegram(message);
      
      if (notifyEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`${sig.action} ${sym}`, {
          body: `${sig.probability}% | Вход: ${price.toFixed(5)}`,
        });
      }
    }
    
    return { action: sig.action, probability: sig.probability, rsi, stoch: stoch.k, adx, macd: macd.histogram, tp, sl, entry: price, aiText: ai, predictions, expiryTime };
  };

  const analyze = async () => { 
    setLoading(true); 
    const r = await analyzeSymbol(symbol); 
    if (r) { setAnalysis(r); }
    setLoading(false); 
  };

  const autoScan = useCallback(async () => {
    if (autoScanning) return;
    setAutoScanning(true);
    
    const sigs: Signal[] = [];
    const pairs = filteredPairs;
    
    for (let i = 0; i < pairs.length; i += 3) {
      const batch = pairs.slice(i, i + 3);
      const results = await Promise.all(batch.map(sym => analyzeSymbol(sym)));
      
      results.forEach((result, idx) => { 
        if (result && result.action !== 'SKIP' && result.probability >= 60) {
          const symbol = batch[idx];
          if (!sigs.find(s => s.symbol === symbol)) {
            sigs.push({ 
              symbol, 
              action: result.action, 
              probability: result.probability, 
              rsi: result.rsi, 
              stoch: result.stoch, 
              adx: result.adx, 
              macd: result.macd, 
              price: result.entry, 
              tp: result.tp, 
              sl: result.sl, 
              aiReason: result.aiText, 
              predictions: result.predictions, 
              expiryTime: result.expiryTime 
            });
          }
        }
      });
      
      setAutoSignals([...sigs].sort((a, b) => b.probability - a.probability));
      await new Promise(r => setTimeout(r, 300));
    }
    
    setLastAutoScan(new Date().toLocaleTimeString());
    setAutoScanning(false);
    
    if (sigs.length > 0) {
      showToast(`🎯 ${sigs.length} сигналов!`);
    }
    
    const advice = await getMarketAdvisor(sigs.slice(0, 5));
    setMarketAdvice(advice);
  }, [filteredPairs, autoScanning]);

  useEffect(() => { 
    if (mode === 'auto') { 
      autoScan(); 
      scanIntervalRef.current = window.setInterval(() => {
        setAutoSignals([]);
        autoScan(); 
      }, 120000); 
    } 
    return () => { 
      if (scanIntervalRef.current) { 
        clearInterval(scanIntervalRef.current); 
        scanIntervalRef.current = null; 
      } 
    }; 
  }, [mode, autoScan]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const startSession = () => { const id = Date.now().toString(); setSessionId(id); localStorage.setItem('sessionId', id); showToast('🚀 Сессия!'); };
  const endSession = () => { setSessionId(null); localStorage.removeItem('sessionId'); showToast('🏁 Завершено'); };
  
  const openTrade = (action: 'LONG' | 'SHORT', sym: string, price: number) => {
    if (!sessionId) { showToast('⚠️ Начни сессию!'); return; }
    setTrades(prev => [{ id: Date.now().toString(), symbol: sym, action, entryPrice: price, exitPrice: null, profit: null, time: new Date().toLocaleTimeString(), sessionId }, ...prev]);
    const cleanSym = sym.replace('_OTC', '');
    window.open(`https://pocketoption.com/trading?pair=${cleanSym.slice(0, 3)}/${cleanSym.slice(3)}`, '_blank');
  };
  
  const closeTrade = (id: string) => { setTrades(prev => prev.map(t => t.id !== id ? t : { ...t, exitPrice: 0, profit: 0 })); };
  const deleteTrade = (id: string) => { setTrades(prev => prev.filter(t => t.id !== id)); };
  const resetSession = () => { setTrades(prev => prev.filter(t => t.sessionId !== sessionId)); setSessionId(null); localStorage.removeItem('sessionId'); showToast('🔄 Сброс'); };
  const addPOTrade = (action: 'UP' | 'DOWN', symbol: string, result: 'win' | 'loss') => {
    setPoTrades(prev => [{ id: Date.now().toString(), symbol, action, result, time: new Date().toLocaleTimeString() }, ...prev]);
    showToast(result === 'win' ? '🟢 +' : '🔴 -');
  };
  const exportCSV = () => {
    const csv = ['symbol,action,entryPrice,exitPrice,profit,time', ...trades.map(t => `${t.symbol},${t.action},${t.entryPrice},${t.exitPrice || ''},${t.profit || ''},${t.time}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'trades.csv'; a.click();
    showToast('📥 CSV скачан');
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-black text-white' : 'bg-gray-100 text-black'}`}>
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-purple-600 px-6 py-3 rounded-xl font-bold animate-pulse text-sm shadow-lg">{toast}</div>}
      
      <div className="fixed inset-0 pointer-events-none z-0">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="absolute w-0.5 h-0.5 bg-purple-400 rounded-full animate-pulse" 
            style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100}%`, animationDuration: `${3+Math.random()*4}s`, opacity: 0.04+Math.random()*0.1 }} />
        ))}
      </div>

      <header className={`relative z-10 border-b border-purple-500/20 backdrop-blur p-4 ${darkMode ? 'bg-black/90' : 'bg-white/90'}`}>
        <div className="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">🤖 AI SIGNAL SCANNER</h1>
            <div className="flex gap-1 bg-black/40 rounded-lg p-1">
              <button onClick={() => setMode('manual')} className={`px-2 py-1 rounded text-xs font-bold ${mode === 'manual' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>🔍</button>
              <button onClick={() => setMode('auto')} className={`px-2 py-1 rounded text-xs font-bold ${mode === 'auto' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>🤖</button>
            </div>
            <div className="flex gap-1 bg-black/40 rounded-lg p-1">
              <button onClick={() => setMarketType('ALL')} className={`px-2 py-1 rounded text-xs ${marketType === 'ALL' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Все</button>
              <button onClick={() => setMarketType('STANDARD')} className={`px-2 py-1 rounded text-xs ${marketType === 'STANDARD' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Стандарт</button>
              <button onClick={() => setMarketType('OTC')} className={`px-2 py-1 rounded text-xs ${marketType === 'OTC' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>OTC</button>
            </div>
            <button onClick={() => setNotifyEnabled(!notifyEnabled)} className={`text-xs ${notifyEnabled ? 'text-green-400' : 'text-gray-500'}`}>{notifyEnabled ? '🔔' : '🔕'}</button>
            <button onClick={() => setDarkMode(!darkMode)} className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-300 text-gray-700'}`}>{darkMode ? '☀️' : '🌙'}</button>
          </div>
          <div className="flex gap-3 text-sm items-center">
            <div className="text-right"><div className="text-gray-500">WR</div><div className="font-bold text-green-400">{sessionWinRate}%</div></div>
            <div className="text-right"><div className="text-gray-500">P/L</div><div className={`font-bold ${sessionProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>${sessionProfit.toFixed(2)}</div></div>
            <div className="text-right"><div className="text-gray-500">₽</div><div className="font-bold text-purple-400">{profitRub} ₽</div></div>
            <div className="text-right"><div className="text-gray-500">PO</div><div className="font-bold text-cyan-400">{poWinRate}%</div></div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto p-4">
        <div className="flex gap-2 mb-4 flex-wrap">
          {!sessionId ? (
            <button onClick={startSession} className="px-4 py-2 bg-green-600 rounded-lg font-bold text-sm">🚀 Старт сессии</button>
          ) : (
            <>
              <button onClick={endSession} className="px-4 py-2 bg-red-600 rounded-lg font-bold text-sm">🏁 Завершить</button>
              <button onClick={resetSession} className="px-4 py-2 bg-yellow-600 rounded-lg font-bold text-sm">🔄 Сброс</button>
              <button onClick={exportCSV} className="px-4 py-2 bg-blue-600 rounded-lg font-bold text-sm">📥 CSV</button>
            </>
          )}
        </div>

        {mode === 'manual' && (
          <div className="mb-6">
            <div className="flex gap-2 mb-3 relative">
              <input
                value={searchSymbol}
                onChange={(e) => { setSearchSymbol(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Поиск актива..."
                className={`flex-1 px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border`}
              />
              <button onClick={analyze} disabled={loading} className="px-6 py-2 bg-purple-600 rounded-lg font-bold disabled:opacity-50">
                {loading ? '⏳' : '🔍'} Анализ
              </button>
              {showDropdown && searchResults.length > 0 && (
                <div className={`absolute top-full mt-1 w-full max-h-48 overflow-y-auto rounded-lg shadow-xl z-20 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  {searchResults.map(p => (
                    <div key={p} className={`px-4 py-2 cursor-pointer hover:bg-purple-600 text-sm ${symbol === p ? 'bg-purple-600' : ''}`}
                      onClick={() => { setSymbol(p); setSearchSymbol(p); setShowDropdown(false); }}>
                      {p}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {analysis && (
              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-gray-800/50 border-purple-500/30' : 'bg-white border-purple-200'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-xl font-bold">{symbol}</h3>
                    <div className="text-sm text-gray-400">Цена: {formatPrice(analysis.entry)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${analysis.action === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                      {analysis.action} {analysis.probability}%
                    </div>
                    <div className="text-xs text-gray-400">⏱ {analysis.expiryTime}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>RSI<br/><span className="font-bold">{analysis.rsi}</span></div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>Stoch<br/><span className="font-bold">{analysis.stoch}</span></div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>ADX<br/><span className="font-bold">{analysis.adx}</span></div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>MACD<br/><span className="font-bold">{analysis.macd > 0 ? '↑' : '↓'}</span></div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                  {analysis.predictions.map((p, i) => (
                    <div key={i} className={`p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      {p.min}мин<br/>
                      <span className={`font-bold ${p.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>{formatPrice(p.price)}</span>
                    </div>
                  ))}
                </div>

                {analysis.action !== 'SKIP' && (
                  <div className="flex gap-2 mb-3">
                    <button onClick={() => openTrade(analysis.action as 'LONG' | 'SHORT', symbol, analysis.entry)}
                      className={`flex-1 py-3 rounded-lg font-bold text-lg ${analysis.action === 'LONG' ? 'bg-green-600' : 'bg-red-600'}`}>
                      {analysis.action === 'LONG' ? '📈 ВВЕРХ' : '📉 ВНИЗ'}
                    </button>
                  </div>
                )}
                
                <div className={`p-3 rounded-lg text-xs whitespace-pre-line ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  {analysis.aiText}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'auto' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-400">
                {autoScanning ? '⏳ Сканирование...' : `Последнее: ${lastAutoScan || '-'}`}
                {' | '}{filteredPairs.length} активов
              </div>
              <button onClick={autoScan} disabled={autoScanning} className="px-4 py-2 bg-purple-600 rounded-lg text-sm font-bold disabled:opacity-50">
                🔄 Сканировать
              </button>
            </div>

            {marketAdvice && (
              <div className={`p-3 mb-4 rounded-lg text-sm border border-purple-500/30 ${darkMode ? 'bg-purple-900/20' : 'bg-purple-50'}`}>
                🤖 {marketAdvice}
              </div>
            )}

            <div className="grid gap-3">
              {autoSignals.map((sig, i) => (
                <div key={i} className={`p-4 rounded-xl border ${darkMode ? 'bg-gray-800/50 border-purple-500/30' : 'bg-white border-purple-200'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold">{sig.symbol}</h3>
                      <div className="text-sm text-gray-400">{formatPrice(sig.price)} | ⏱ {sig.expiryTime}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${sig.action === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                        {sig.action} {sig.probability}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
                    <div className={`p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>RSI<br/><span className="font-bold">{sig.rsi}</span></div>
                    <div className={`p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>Stoch<br/><span className="font-bold">{sig.stoch}</span></div>
                    <div className={`p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>ADX<br/><span className="font-bold">{sig.adx}</span></div>
                    <div className={`p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>MACD<br/><span className="font-bold">{sig.macd > 0 ? '↑' : '↓'}</span></div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                    {sig.predictions.map((p, j) => (
                      <div key={j} className={`p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        {p.min}мин<br/>
                        <span className={`font-bold ${p.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>{formatPrice(p.price)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mb-3">
                    <button onClick={() => openTrade(sig.action, sig.symbol, sig.price)}
                      className={`flex-1 py-2 rounded-lg font-bold ${sig.action === 'LONG' ? 'bg-green-600' : 'bg-red-600'}`}>
                      {sig.action === 'LONG' ? '📈 ВВЕРХ' : '📉 ВНИЗ'}
                    </button>
                  </div>

                  <div className={`p-2 rounded-lg text-xs whitespace-pre-line ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    {sig.aiReason.slice(0, 300)}
                  </div>
                </div>
              ))}
              {autoSignals.length === 0 && !autoScanning && (
                <div className="text-center text-gray-500 py-8">Нет сигналов. Нажмите "Сканировать"</div>
              )}
            </div>
          </div>
        )}

        {sessionId && (
          <div className={`mt-6 p-4 rounded-xl border ${darkMode ? 'bg-gray-800/50 border-purple-500/30' : 'bg-white border-purple-200'}`}>
            <h3 className="font-bold mb-3">🎯 Pocket Option WinRate</h3>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => addPOTrade('UP', symbol, 'win')} className="px-4 py-2 bg-green-600 rounded-lg font-bold text-sm">🟢 ВВЕРХ Win</button>
              <button onClick={() => addPOTrade('UP', symbol, 'loss')} className="px-4 py-2 bg-red-600 rounded-lg font-bold text-sm">🔴 ВВЕРХ Loss</button>
              <button onClick={() => addPOTrade('DOWN', symbol, 'win')} className="px-4 py-2 bg-green-600 rounded-lg font-bold text-sm">🟢 ВНИЗ Win</button>
              <button onClick={() => addPOTrade('DOWN', symbol, 'loss')} className="px-4 py-2 bg-red-600 rounded-lg font-bold text-sm">🔴 ВНИЗ Loss</button>
            </div>
            {poTrades.length > 0 && (
              <div className="mt-3 text-xs text-gray-400 max-h-32 overflow-y-auto">
                {poTrades.slice(0, 20).map((t, i) => (
                  <div key={i} className="flex justify-between py-1 border-b border-gray-700/30">
                    <span>{t.time}</span>
                    <span>{t.symbol} {t.action}</span>
                    <span className={t.result === 'win' ? 'text-green-400' : 'text-red-400'}>{t.result}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {sessionId && sessionTrades.length > 0 && (
          <div className={`mt-4 p-4 rounded-xl border ${darkMode ? 'bg-gray-800/50 border-purple-500/30' : 'bg-white border-purple-200'}`}>
            <h3 className="font-bold mb-3">📊 История сделок</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sessionTrades.map(t => (
                <div key={t.id} className={`flex justify-between items-center p-2 rounded text-sm ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <div>
                    <span className="font-bold">{t.symbol}</span>
                    <span className={`ml-2 ${t.action === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>{t.action}</span>
                  </div>
                  <div className="text-xs text-gray-400">{formatPrice(t.entryPrice)}</div>
                  <div className="text-xs text-gray-400">{t.time}</div>
                  {!t.exitPrice ? (
                    <button onClick={() => closeTrade(t.id)} className="px-2 py-1 bg-yellow-600 rounded text-xs">Закрыть</button>
                  ) : (
                    <button onClick={() => deleteTrade(t.id)} className="px-2 py-1 bg-red-600 rounded text-xs">🗑</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
