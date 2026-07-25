// src/utils/candleService.ts

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface YahooResponse {
  chart: {
    result?: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: number[];
          high: number[];
          low: number[];
          close: number[];
          volume: number[];
        }>;
      };
    }>;
    error?: { code: string; description: string };
  };
}

interface PriceCache {
  [symbol: string]: {
    candles: Candle[];
    timestamp: number;
  };
}

// Yahoo Finance symbols mapping
const YAHOO_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EURUSD=X',
  'GBP/USD': 'GBPUSD=X',
  'USD/JPY': 'USDJPY=X',
  'USD/CHF': 'USDCHF=X',
  'AUD/USD': 'AUDUSD=X',
  'USD/CAD': 'USDCAD=X',
  'NZD/USD': 'NZDUSD=X',
  'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X',
  'EUR/GBP': 'EURGBP=X',
  'EUR/CHF': 'EURCHF=X',
  'BTC/USD': 'BTC-USD',
  'ETH/USD': 'ETH-USD',
  'XAU/USD': 'GC=F',
  'AAPL': 'AAPL',
  'GOOGL': 'GOOGL',
  'MSFT': 'MSFT',
  'TSLA': 'TSLA',
  'AMZN': 'AMZN',
  'META': 'META',
  'NFLX': 'NFLX',
  'NVDA': 'NVDA',
  // Добавьте остальные активы по необходимости
};

const priceCache: PriceCache = {};
const CACHE_DURATION = 30000; // 30 секунд

function getYahooSymbol(symbol: string): string {
  // Сначала проверяем прямое соответствие
  if (YAHOO_SYMBOLS[symbol]) {
    return YAHOO_SYMBOLS[symbol];
  }

  // Для OTC пар
  if (symbol.includes('OTC')) {
    const base = symbol.replace(' OTC', '').replace('/', '-');
    return `${base}`;
  }

  // Для валютных пар с /, кроме уже обработанных
  if (symbol.includes('/')) {
    const parts = symbol.split('/');
    if (parts.length === 2) {
      return `${parts[0]}${parts[1]}=X`;
    }
  }

  // Для акций - возвращаем как есть
  return symbol;
}

function getFallbackSymbol(symbol: string): string {
  // Для open.er-api.com используем базовые валюты
  if (symbol.includes('/')) {
    return symbol.split('/')[0].toLowerCase();
  }
  return symbol.toLowerCase();
}

async function fetchYahooCandles(symbol: string): Promise<Candle[]> {
  try {
    const yahooSymbol = getYahooSymbol(symbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1h`;
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    
    console.log(`Fetching Yahoo Finance data for ${symbol} (${yahooSymbol})`);
    
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }
    
    const data: YahooResponse = await response.json();
    
    if (!data.chart?.result || data.chart.error) {
      throw new Error('No data from Yahoo Finance');
    }

    const result = data.chart.result[0];
    const quote = result.indicators.quote[0];
    
    if (!result.timestamp || !quote) {
      throw new Error('Invalid data structure');
    }

    const candles: Candle[] = result.timestamp.map((timestamp, i) => {
      const date = new Date(timestamp * 1000);
      return {
        time: date.toISOString(),
        open: quote.open[i] ?? 0,
        high: quote.high[i] ?? 0,
        low: quote.low[i] ?? 0,
        close: quote.close[i] ?? 0,
        volume: quote.volume[i] ?? 0,
      };
    }).filter(candle => 
      candle.open > 0 && candle.high > 0 && 
      candle.low > 0 && candle.close > 0
    );

    if (candles.length < 2) {
      throw new Error('Not enough candles');
    }

    console.log(`✅ Yahoo Finance: Got ${candles.length} candles for ${symbol}`);
    return candles;

  } catch (error) {
    console.warn(`Yahoo Finance failed for ${symbol}, trying fallback...`, error);
    return fetchFallbackCandles(symbol);
  }
}

async function fetchFallbackCandles(symbol: string): Promise<Candle[]> {
  try {
    const baseCurrency = getFallbackSymbol(symbol);
    const url = `https://open.er-api.com/v6/latest/${baseCurrency.toUpperCase()}`;
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error('Fallback API failed');
    }
    
    const data = await response.json();
    
    if (!data.rates) {
      throw new Error('No rates data');
    }

    // Генерируем свечи на основе данных
    return generateCandlesFromRate(data, symbol);
    
  } catch (error) {
    console.warn(`Fallback API failed for ${symbol}, generating artificial data`);
    return generateArtificialCandles(symbol);
  }
}

async function fetchFallbackCandlesForStock(symbol: string): Promise<Candle[]> {
  // Для акций используем Finnhub как второй fallback
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=d9hrerpr01qjmfda64ggd9hrerpr01qjmfda64h0`;
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl);
    const data = await response.json();
    
    if (data.c) {
      return generateStockCandlesFromQuote(data);
    }
    
    throw new Error('No stock data');
  } catch {
    return generateArtificialCandles(symbol);
  }
}

function generateCandlesFromRate(data: { rates: Record<string, number>; time_last_update_utc: string }, symbol: string): Candle[] {
  const now = new Date();
  const basePrice = symbol.includes('/') 
    ? data.rates[symbol.split('/')[1]] || 1
    : data.rates['USD'] || 1;
  
  const candles: Candle[] = [];
  for (let i = 59; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60000);
    const noise = (Math.random() - 0.5) * 0.002;
    const price = basePrice * (1 + noise);
    
    candles.push({
      time: time.toISOString(),
      open: price * (1 - noise * 0.3),
      high: price * (1 + Math.abs(noise) * 0.5),
      low: price * (1 - Math.abs(noise) * 0.5),
      close: price,
      volume: Math.floor(Math.random() * 1000) + 100,
    });
  }
  
  console.log(`⚠️ Generated ${candles.length} candles from rate for ${symbol}`);
  return candles;
}

function generateStockCandlesFromQuote(quote: { c: number; h: number; l: number; o: number }): Candle[] {
  const now = new Date();
  const candles: Candle[] = [];
  
  for (let i = 59; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60000);
    const progress = i / 59;
    const price = quote.o + (quote.c - quote.o) * (1 - progress) + (Math.random() - 0.5) * (quote.h - quote.l) * 0.1;
    
    candles.push({
      time: time.toISOString(),
      open: price * (1 - Math.random() * 0.001),
      high: price * (1 + Math.random() * 0.002),
      low: price * (1 - Math.random() * 0.002),
      close: price,
      volume: Math.floor(Math.random() * 100000) + 10000,
    });
  }
  
  return candles;
}

function generateArtificialCandles(symbol: string): Candle[] {
  const now = new Date();
  let price = symbol.includes('BTC') ? 45000 + Math.random() * 1000 :
              symbol.includes('ETH') ? 2500 + Math.random() * 100 :
              symbol.includes('XAU') ? 1950 + Math.random() * 30 :
              symbol.includes('/') ? 1 + Math.random() * 0.5 : 
              100 + Math.random() * 50;

  const candles: Candle[] = [];
  for (let i = 59; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60000);
    const change = (Math.random() - 0.5) * price * 0.002;
    price = Math.max(price + change, 0.01);
    
    candles.push({
      time: time.toISOString(),
      open: price,
      high: price * (1 + Math.random() * 0.001),
      low: price * (1 - Math.random() * 0.001),
      close: price * (1 + (Math.random() - 0.5) * 0.0005),
      volume: Math.floor(Math.random() * 1000) + 100,
    });
  }
  
  console.log(`🔄 Generated artificial candles for ${symbol}`);
  return candles;
}

export async function fetchCandles(symbol: string): Promise<Candle[]> {
  const now = Date.now();
  const cached = priceCache[symbol];
  
  // Возвращаем кэш если он свежий
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    console.log(`📦 Using cached data for ${symbol}`);
    return cached.candles;
  }

  console.log(`🔄 Fetching fresh candles for ${symbol}`);
  
  try {
    const candles = await fetchYahooCandles(symbol);
    
    if (candles.length > 0) {
      priceCache[symbol] = { candles, timestamp: now };
      return candles;
    }
    
    throw new Error('No candles returned');
  } catch (error) {
    console.error(`Failed to fetch candles for ${symbol}:`, error);
    
    // Если есть старый кэш, возвращаем его
    if (cached) {
      console.log(`⚠️ Using expired cache for ${symbol}`);
      return cached.candles;
    }
    
    // Генерируем искусственные данные как последний fallback
    const artificialCandles = generateArtificialCandles(symbol);
    priceCache[symbol] = { candles: artificialCandles, timestamp: now };
    return artificialCandles;
  }
}

export function clearPriceCache(): void {
  Object.keys(priceCache).forEach(key => delete priceCache[key]);
}

export type { Candle, PriceCache };
