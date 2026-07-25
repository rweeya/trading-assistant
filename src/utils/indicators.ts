// src/utils/indicators.ts
import { Candle } from './candleService';

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  crossed: 'up' | 'down' | null;
}

export interface RSIData {
  rsi: number;
  overbought: boolean;
  oversold: boolean;
}

export interface StochasticData {
  k: number;
  d: number;
  crossed: 'up' | 'down' | null;
}

export interface ADXResult {
  adx: number;
  plusDI: number;
  minusDI: number;
  trending: boolean;
}

export interface EMAValues {
  ema20: number;
  ema50: number;
  trend: 'up' | 'down' | 'neutral';
}

export interface IndicatorsResult {
  macd: MACDResult;
  rsi: RSIData;
  stochastic: StochasticData;
  adx: ADXResult;
  ema: EMAValues;
}

function calculateEMA(prices: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = prices[0];
  
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  
  return ema;
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const difference = prices[i] - prices[i - 1];
    if (difference >= 0) {
      gains += difference;
    } else {
      losses -= difference;
    }
  }

  if (losses === 0) return 100;
  if (gains === 0) return 0;

  const rs = (gains / period) / (losses / period);
  return 100 - (100 / (1 + rs));
}

function calculateStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14,
  smoothK: number = 3,
  smoothD: number = 3
): StochasticData {
  if (closes.length < period) {
    return { k: 50, d: 50, crossed: null };
  }

  const kValues: number[] = [];
  
  for (let i = period - 1; i < closes.length; i++) {
    const highSlice = highs.slice(i - period + 1, i + 1);
    const lowSlice = lows.slice(i - period + 1, i + 1);
    const highestHigh = Math.max(...highSlice);
    const lowestLow = Math.min(...lowSlice);
    
    const k = highestHigh !== lowestLow
      ? ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100
      : 50;
    
    kValues.push(k);
  }

  const k = kValues.slice(-smoothK).reduce((a, b) => a + b) / smoothK;
  const d = kValues.slice(-smoothD).reduce((a, b) => a + b) / smoothD;

  // Определяем пересечение
  let crossed: 'up' | 'down' | null = null;
  if (kValues.length >= 2) {
    const prevK = kValues[kValues.length - 2];
    const prevD = kValues.length >= smoothD + 1 
      ? kValues.slice(-smoothD - 1, -1).reduce((a, b) => a + b) / smoothD
      : prevK;
    
    if (prevK < prevD && k > d) {
      crossed = 'up';
    } else if (prevK > prevD && k < d) {
      crossed = 'down';
    }
  }

  return { k, d, crossed };
}

export function calculateIndicators(candles: Candle[]): IndicatorsResult {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  
  // RSI
  const rsiValue = calculateRSI(closes, 14);
  const rsi: RSIData = {
    rsi: rsiValue,
    overbought: rsiValue > 70,
    oversold: rsiValue < 30,
  };

  // Stochastic
  const stochastic = calculateStochastic(highs, lows, closes);

  // MACD
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12 - ema26;
  const signalLine = calculateEMA([...Array(9).fill(macdLine), macdLine], 9);
  const histogram = macdLine - signalLine;

  // Определяем пересечение MACD
  let crossed: 'up' | 'down' | null = null;
  if (closes.length >= 2) {
    const prevCloses = closes.slice(0, -1);
    const prevEma12 = calculateEMA(prevCloses, 12);
    const prevEma26 = calculateEMA(prevCloses, 26);
    const prevMacd = prevEma12 - prevEma26;
    const prevSignal = calculateEMA([...Array(9).fill(prevMacd), prevMacd], 9);
    
    if (prevMacd <= prevSignal && macdLine > signalLine) {
      crossed = 'up';
    } else if (prevMacd >= prevSignal && macdLine < signalLine) {
      crossed = 'down';
    }
  }

  const macd: MACDResult = {
    macd: macdLine,
    signal: signalLine,
    histogram,
    crossed,
  };

  // ADX
  const adxResult = calculateADX(highs, lows, closes, 14);
  
  // EMA
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema: EMAValues = {
    ema20,
    ema50,
    trend: ema20 > ema50 ? 'up' : ema20 < ema50 ? 'down' : 'neutral',
  };

  return { macd, rsi, stochastic, adx: adxResult, ema };
}

function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): ADXResult {
  if (closes.length < period + 1) {
    return { adx: 20, plusDI: 25, minusDI: 25, trending: false };
  }

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    const prevHigh = highs[i - 1];
    const prevLow = lows[i - 1];

    const trValue = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    tr.push(trValue);

    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const atr = tr.slice(-period).reduce((a, b) => a + b) / period;
  
  const smoothedPlusDM = plusDM.slice(-period).reduce((a, b) => a + b) / period;
  const smoothedMinusDM = minusDM.slice(-period).reduce((a, b) => a + b) / period;

  const plusDI = atr > 0 ? (smoothedPlusDM / atr) * 100 : 0;
  const minusDI = atr > 0 ? (smoothedMinusDM / atr) * 100 : 0;

  const dxSum = Math.abs(plusDI - minusDI);
  const dx = (plusDI + minusDI) > 0 ? (dxSum / (plusDI + minusDI)) * 100 : 0;

  return {
    adx: dx,
    plusDI,
    minusDI,
    trending: dx > 25,
  };
}

export function generateSignal(
  indicators: IndicatorsResult,
  price: number
): {
  direction: 'LONG' | 'SHORT' | null;
  probability: number;
  reasons: string[];
  mandatoryMet: boolean;
  confirmationsMet: number;
} {
  const { macd, rsi, stochastic, adx, ema } = indicators;
  const reasons: string[] = [];
  let probability = 0;
  let direction: 'LONG' | 'SHORT' | null = null;

  // === ОБЯЗАТЕЛЬНЫЕ УСЛОВИЯ ===
  const hasMacdCross = macd.crossed !== null;
  
  if (!hasMacdCross) {
    return {
      direction: null,
      probability: 0,
      reasons: ['SKIP: MACD не пересек сигнальную линию'],
      mandatoryMet: false,
      confirmationsMet: 0,
    };
  }

  // Определяем направление по MACD
  if (macd.crossed === 'up') {
    direction = 'LONG';
    probability += 30;
    reasons.push('✅ MACD пересек вверх (обязательное)');
  } else if (macd.crossed === 'down') {
    direction = 'SHORT';
    probability += 30;
    reasons.push('✅ MACD пересек вниз (обязательное)');
  }

  const mandatoryMet = true;
  let confirmationsMet = 0;

  // === ПОДТВЕРЖДЕНИЯ (нужно 1 из 3) ===
  
  // RSI подтверждение
  if (direction === 'LONG' && rsi.rsi < 50 && !rsi.oversold) {
    probability += 20;
    confirmationsMet++;
    reasons.push(`✅ RSI(${rsi.rsi.toFixed(1)}) < 50 для LONG`);
  } else if (direction === 'SHORT' && rsi.rsi > 50 && !rsi.overbought) {
    probability += 20;
    confirmationsMet++;
    reasons.push(`✅ RSI(${rsi.rsi.toFixed(1)}) > 50 для SHORT`);
  }

  // Stochastic подтверждение
  if (direction === 'LONG' && stochastic.k < 40) {
    probability += 20;
    confirmationsMet++;
    reasons.push(`✅ Stochastic K(${stochastic.k.toFixed(1)}) < 40`);
  } else if (direction === 'SHORT' && stochastic.k > 60) {
    probability += 20;
    confirmationsMet++;
    reasons.push(`✅ Stochastic K(${stochastic.k.toFixed(1)}) > 60`);
  }

  // ADX подтверждение
  if (adx.adx > 15 && adx.trending) {
    probability += 15;
    confirmationsMet++;
    reasons.push(`✅ ADX(${adx.adx.toFixed(1)}) > 15, тренд есть`);
  }

  // === БОНУСЫ ===
  
  // EMA бонус
  if (direction === 'LONG' && ema.trend === 'up') {
    probability += 10;
    reasons.push(`✨ EMA тренд вверх (бонус)`);
  } else if (direction === 'SHORT' && ema.trend === 'down') {
    probability += 10;
    reasons.push(`✨ EMA тренд вниз (бонус)`);
  }

  // Stochastic пересечение бонус
  if (stochastic.crossed === direction?.toLowerCase()) {
    probability += 5;
    reasons.push(`✨ Stochastic пересечение в сторону тренда`);
  }

  // Ограничение вероятности
  probability = Math.min(Math.max(probability, 0), 100);

  // Проверка минимальных подтверждений
  if (confirmationsMet < 1) {
    return {
      direction: null,
      probability: 0,
      reasons: [`SKIP: Подтверждений ${confirmationsMet}/1`, ...reasons],
      mandatoryMet: true,
      confirmationsMet,
    };
  }

  return {
    direction,
    probability,
    reasons,
    mandatoryMet,
    confirmationsMet,
  };
}

export type { Candle };
