/**
 * ELITE TRADING ENGINE - JavaScript port of elite_trading_bot.py
 * Implements all core strategies: RSI, MACD, EMA, Bollinger, ADX, Stochastic,
 * Volume Profile, ATR, Market Regime, Fibonacci levels, Kelly Criterion,
 * Support/Resistance, Divergence Detection, 8-Signal Confirmation System
 */

export const Signal = { STRONG_BUY: 'STRONG_BUY', BUY: 'BUY', HOLD: 'HOLD', SELL: 'SELL', STRONG_SELL: 'STRONG_SELL' };
export const MarketRegime = { BULL_TRENDING: 'BULL_TRENDING', BEAR_TRENDING: 'BEAR_TRENDING', HIGH_VOLATILITY: 'HIGH_VOLATILITY', LOW_VOLATILITY: 'LOW_VOLATILITY', CONSOLIDATION: 'CONSOLIDATION', TRENDING_UP: 'TRENDING_UP', TRENDING_DOWN: 'TRENDING_DOWN' };
export const MarketState = { NORMAL: 'NORMAL', VOLATILE: 'VOLATILE', CRASH: 'CRASH', RECOVERY: 'RECOVERY' };

export function ema(prices, period) {
  if (!prices || prices.length === 0) return [];
  const k = 2 / (period + 1);
  const result = [];
  let val = prices[0];
  for (let i = 0; i < prices.length; i++) { val = prices[i] * k + val * (1 - k); result.push(+val.toFixed(4)); }
  return result;
}

export function sma(prices, period) {
  const result = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(+(sum / period).toFixed(4));
  }
  return result;
}

export function calculateRSI(ohlcv, period = 14) {
  if (!ohlcv || ohlcv.length < period + 1) return [];
  const closes = ohlcv.map(d => d.close);
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  let avgG = 0, avgL = 0;
  for (let i = 0; i < period; i++) { if (changes[i] > 0) avgG += changes[i]; else avgL += Math.abs(changes[i]); }
  avgG /= period; avgL /= period;
  const result = [];
  const push = (d, ag, al) => { const rs = al === 0 ? 100 : ag / al; result.push({ date: d, value: +(100 - 100 / (1 + rs)).toFixed(2) }); };
  push(ohlcv[period].date, avgG, avgL);
  for (let i = period; i < changes.length; i++) {
    avgG = (avgG * (period - 1) + (changes[i] > 0 ? changes[i] : 0)) / period;
    avgL = (avgL * (period - 1) + (changes[i] < 0 ? Math.abs(changes[i]) : 0)) / period;
    push(ohlcv[i + 1].date, avgG, avgL);
  }
  return result;
}

export function calculateMACD(ohlcv, fast = 12, slow = 26, signalPeriod = 9) {
  if (!ohlcv || ohlcv.length < slow + signalPeriod) return [];
  const closes = ohlcv.map(d => d.close);
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = emaFast.map((v, i) => +(v - emaSlow[i]).toFixed(4));
  const macdSignalLine = ema(macdLine.slice(slow - 1), signalPeriod);
  const result = [];
  for (let i = slow - 1 + signalPeriod - 1; i < ohlcv.length; i++) {
    const idx = i - (slow - 1 + signalPeriod - 1);
    const macdVal = macdLine[i], sigVal = macdSignalLine[idx];
    result.push({ date: ohlcv[i].date, macd: macdVal, signal: sigVal, histogram: +(macdVal - sigVal).toFixed(4) });
  }
  return result;
}

export function calculateBollingerBands(ohlcv, period = 20, stdDev = 2) {
  if (!ohlcv || ohlcv.length < period) return [];
  const result = [];
  for (let i = period - 1; i < ohlcv.length; i++) {
    const slice = ohlcv.slice(i - period + 1, i + 1).map(d => d.close);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);
    const upper = +(mean + stdDev * sd).toFixed(2);
    const lower = +(mean - stdDev * sd).toFixed(2);
    const bandwidth = mean > 0 ? +((upper - lower) / mean * 100).toFixed(2) : 0;
    result.push({ date: ohlcv[i].date, middle: +mean.toFixed(2), upper, lower, bandwidth, squeeze: bandwidth < 3.0 });
  }
  return result;
}

export function calculateATR(ohlcv, period = 14) {
  if (!ohlcv || ohlcv.length < period + 1) return [];
  const trs = [];
  for (let i = 1; i < ohlcv.length; i++) {
    const h = ohlcv[i].high, l = ohlcv[i].low, pc = ohlcv[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const result = [];
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push({ date: ohlcv[period].date, value: +atr.toFixed(4) });
  for (let i = period; i < trs.length; i++) { atr = (atr * (period - 1) + trs[i]) / period; result.push({ date: ohlcv[i + 1].date, value: +atr.toFixed(4) }); }
  return result;
}

export function calculateADX(ohlcv, period = 14) {
  if (!ohlcv || ohlcv.length < period * 2) return [];
  const plusDM = [], minusDM = [], tr = [];
  for (let i = 1; i < ohlcv.length; i++) {
    const upMove = ohlcv[i].high - ohlcv[i - 1].high, downMove = ohlcv[i - 1].low - ohlcv[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    const h = ohlcv[i].high, l = ohlcv[i].low, pc = ohlcv[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const smoothTR = sma(tr, period), smoothPlusDM = sma(plusDM, period), smoothMinusDM = sma(minusDM, period);
  const result = [], dxHistory = [];
  for (let i = 0; i < smoothTR.length; i++) {
    const plusDI = smoothTR[i] > 0 ? 100 * smoothPlusDM[i] / smoothTR[i] : 0;
    const minusDI = smoothTR[i] > 0 ? 100 * smoothMinusDM[i] / smoothTR[i] : 0;
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? 100 * Math.abs(plusDI - minusDI) / diSum : 0;
    dxHistory.push(dx);
    if (dxHistory.length >= period) {
      const adx = dxHistory.slice(-period).reduce((a, b) => a + b, 0) / period;
      result.push({ date: ohlcv[i + period].date, adx: +adx.toFixed(2), plusDI: +plusDI.toFixed(2), minusDI: +minusDI.toFixed(2), trending: adx > 25 });
    }
  }
  return result;
}

export function calculateStochastic(ohlcv, kPeriod = 14, dPeriod = 3) {
  if (!ohlcv || ohlcv.length < kPeriod) return [];
  const kValues = [];
  for (let i = kPeriod - 1; i < ohlcv.length; i++) {
    const slice = ohlcv.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map(d => d.high)), low = Math.min(...slice.map(d => d.low));
    const k = high === low ? 50 : +((ohlcv[i].close - low) / (high - low) * 100).toFixed(2);
    kValues.push({ date: ohlcv[i].date, k });
  }
  const result = [];
  for (let i = dPeriod - 1; i < kValues.length; i++) {
    const d = kValues.slice(i - dPeriod + 1, i + 1).reduce((a, b) => a + b.k, 0) / dPeriod;
    result.push({ date: kValues[i].date, k: kValues[i].k, d: +d.toFixed(2) });
  }
  return result;
}

export function calculateVolumeProfile(ohlcv) {
  if (!ohlcv || ohlcv.length === 0) return { averageVolume: 0, volumeRatio: 1, highVolumeDay: false };
  const volumes = ohlcv.map(d => d.volume);
  const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const lastVol = volumes[volumes.length - 1] || 0;
  return { averageVolume: +avg.toFixed(0), volumeRatio: avg > 0 ? +(lastVol / avg).toFixed(2) : 1, highVolumeDay: lastVol > avg * 1.5, volumeTrend: volumes.slice(-5).reduce((a, b) => a + b, 0) / 5 > avg ? 'rising' : 'falling' };
}

// ── Pivot Points (no lookahead) ──
export function calculatePivotPoints(ohlcv) {
  if (!ohlcv || ohlcv.length < 5) return { support: [], resistance: [] };
  const support = [], resistance = [];
  // Start at index 3 so we have prev2, prev1, curr; pivot confirmed after 2 trailing bars
  for (let i = 3; i < ohlcv.length; i++) {
    const prev2 = ohlcv[i - 3], prev1 = ohlcv[i - 2], curr = ohlcv[i - 1];
    if (curr.low < prev2.low && curr.low < prev1.low) support.push({ price: curr.low, date: curr.date, strength: 1 });
    if (curr.high > prev2.high && curr.high > prev1.high) resistance.push({ price: curr.high, date: curr.date, strength: 1 });
  }
  return { support: support.slice(-5), resistance: resistance.slice(-5) };
}

export function calculateFibonacciLevels(ohlcv) {
  if (!ohlcv || ohlcv.length < 10) return null;
  const recent = ohlcv.slice(-20);
  const high = Math.max(...recent.map(d => d.high)), low = Math.min(...recent.map(d => d.low));
  const diff = high - low;
  return { high, low, level_0: +low.toFixed(2), level_236: +(low + diff * 0.236).toFixed(2), level_382: +(low + diff * 0.382).toFixed(2), level_500: +(low + diff * 0.5).toFixed(2), level_618: +(low + diff * 0.618).toFixed(2), level_786: +(low + diff * 0.786).toFixed(2), level_100: +high.toFixed(2), target_382: +(low + diff * 0.382).toFixed(2), target_618: +(low + diff * 0.618).toFixed(2), target_100: +high.toFixed(2) };
}

export function detectRSIDivergence(ohlcv, rsiValues) {
  if (!ohlcv || !rsiValues || ohlcv.length < 10 || rsiValues.length < 5) return { bullish: false, bearish: false };
  const recentOHLCV = ohlcv.slice(-10), recentRSI = rsiValues.slice(-10);
  const priceLow1 = Math.min(...recentOHLCV.slice(0, 5).map(d => d.low)), priceLow2 = Math.min(...recentOHLCV.slice(5).map(d => d.low));
  const rsiLow1 = Math.min(...recentRSI.slice(0, 5).map(d => d.value)), rsiLow2 = Math.min(...recentRSI.slice(5).map(d => d.value));
  const bullish = priceLow2 < priceLow1 && rsiLow2 > rsiLow1;
  const priceHigh1 = Math.max(...recentOHLCV.slice(0, 5).map(d => d.high)), priceHigh2 = Math.max(...recentOHLCV.slice(5).map(d => d.high));
  const rsiHigh1 = Math.max(...recentRSI.slice(0, 5).map(d => d.value)), rsiHigh2 = Math.max(...recentRSI.slice(5).map(d => d.value));
  const bearish = priceHigh2 > priceHigh1 && rsiHigh2 < rsiHigh1;
  return { bullish, bearish };
}

export function detectMarketState(ohlcv, bb, adx, rsi) {
  if (!ohlcv || ohlcv.length < 5) return MarketState.NORMAL;
  const latestBB = bb?.[bb.length - 1], latestADX = adx?.[adx.length - 1]?.adx || 20, latestRSI = rsi?.[rsi.length - 1]?.value || 50, bwPct = latestBB?.bandwidth || 5;
  const closes = ohlcv.slice(-6);
  const momentum5 = closes.length > 1 ? ((closes[closes.length - 1].close - closes[0].close) / closes[0].close) * 100 : 0;
  if (bwPct > 15 || latestADX > 75 || latestRSI < 20 || momentum5 < -5) return MarketState.CRASH;
  if (bwPct >= 8 && bwPct <= 15 && latestADX >= 15 && latestADX <= 75) return MarketState.VOLATILE;
  if (latestRSI < 35 && momentum5 > 0) return MarketState.RECOVERY;
  return MarketState.NORMAL;
}

export function detectMarketRegime(ohlcv, adxData) {
  if (!ohlcv || ohlcv.length < 50) return MarketRegime.CONSOLIDATION;
  const closes = ohlcv.map(d => d.close);
  const sma20 = sma(closes, 20), sma50 = sma(closes, Math.min(50, Math.max(20, closes.length - 1)));
  const latestADX = adxData?.[adxData.length - 1], adxVal = latestADX?.adx || 20;
  const lastClose = closes[closes.length - 1], lastSMA20 = sma20[sma20.length - 1], lastSMA50 = sma50[sma50.length - 1];
  const lookback = Math.min(10, closes.length - 1);
  const momentum = ((lastClose - closes[closes.length - lookback - 1]) / closes[closes.length - lookback - 1]) * 100;
  if (adxVal > 25) {
    if (lastClose > lastSMA20 && lastSMA20 > lastSMA50 && momentum > 2) return MarketRegime.BULL_TRENDING;
    if (lastClose < lastSMA20 && lastSMA20 < lastSMA50 && momentum < -2) return MarketRegime.BEAR_TRENDING;
    if (momentum > 0) return MarketRegime.TRENDING_UP;
    return MarketRegime.TRENDING_DOWN;
  }
  const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const volPct = Math.sqrt(variance) * 100;
  if (volPct > 2) return MarketRegime.HIGH_VOLATILITY;
  if (volPct < 0.5) return MarketRegime.LOW_VOLATILITY;
  return MarketRegime.CONSOLIDATION;
}

// ── Position Sizing with fee deduction ──
export function calculatePositionSize(stock, userProfile) {
  const capital = userProfile?.investable_amount || 50000;
  const riskAppetite = userProfile?.risk_appetite || 'moderate';
  const experience = userProfile?.investment_experience || 'beginner';
  const goals = userProfile?.investment_goals || 'balanced_growth';

  let volatilityScore = 0;
  const ohlcv = stock?.ohlcv_data || [];
  if (ohlcv.length > 2) {
    const returns = [];
    for (let i = 1; i < ohlcv.length; i++) returns.push((ohlcv[i].close - ohlcv[i - 1].close) / ohlcv[i - 1].close);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    volatilityScore = Math.sqrt(variance) * 100;
  }

  let baseRiskPct = 0.02;
  if (riskAppetite === 'conservative') baseRiskPct = 0.01;
  if (riskAppetite === 'aggressive') baseRiskPct = 0.04;
  if (experience === 'beginner') baseRiskPct *= 0.5;
  else if (experience === 'intermediate') baseRiskPct *= 0.75;
  const goalFactors = { wealth_preservation: 0.5, stable_income: 0.7, balanced_growth: 1.0, aggressive_growth: 1.5, speculation: 2.0 };
  baseRiskPct *= (goalFactors[goals] || 1.0);
  const volFactor = volatilityScore > 0 ? Math.max(0.5, 1 - volatilityScore / 5) : 1;
  const adjustedRiskPct = Math.min(0.1, Math.max(0.005, baseRiskPct * volFactor));

  const positionSize = capital * adjustedRiskPct;
  // Deduct assumed 0.1% fee before calculating share quantity to prevent overdraft
  const priceWithFee = stock.current_price > 0 ? stock.current_price * 1.001 : 1;
  const shareQty = stock.current_price > 0 ? Math.max(1, Math.floor(positionSize / priceWithFee)) : 0;

  let label = 'Small Position';
  if (adjustedRiskPct > 0.02) label = 'Moderate Position';
  if (adjustedRiskPct > 0.05) label = 'Significant Position';
  if (adjustedRiskPct > 0.08) label = 'Large Position';
  return { positionSize: Math.round(positionSize), shareQty, riskPercent: +(adjustedRiskPct * 100).toFixed(2), label, capital, volatilityScore: +volatilityScore.toFixed(4) };
}

export function calculateDynamicStopLoss(entryPrice, atrValue, multiplier = 2.5) { return +(entryPrice - atrValue * multiplier).toFixed(2); }
export function calculateTrailingStop(currentPrice, highSinceBuy, atrValue, multiplier = 2.0) { return +(highSinceBuy - atrValue * multiplier).toFixed(2); }

// ── 8-Signal Confirmation System ──
export function runSignalConfirmation(ohlcv) {
  if (!ohlcv || ohlcv.length < 30) return { signal: Signal.HOLD, confirmations: 0, confidence: 0, details: {} };
  const rsiData = calculateRSI(ohlcv), macdData = calculateMACD(ohlcv), bbData = calculateBollingerBands(ohlcv);
  const atrData = calculateATR(ohlcv), adxData = calculateADX(ohlcv), stochData = calculateStochastic(ohlcv);
  const volumeProfile = calculateVolumeProfile(ohlcv);
  const { support, resistance } = calculatePivotPoints(ohlcv);
  const fibLevels = calculateFibonacciLevels(ohlcv);
  const rsDiv = detectRSIDivergence(ohlcv, rsiData);
  const marketState = detectMarketState(ohlcv, bbData, adxData, rsiData);
  const regime = detectMarketRegime(ohlcv, adxData);

  const latestClose = ohlcv[ohlcv.length - 1].close, latestRSI = rsiData[rsiData.length - 1]?.value ?? 50;
  const latestMACD = macdData[macdData.length - 1], latestBB = bbData[bbData.length - 1];
  const latestADX = adxData[adxData.length - 1], latestStoch = stochData[stochData.length - 1];
  const latestATR = atrData[atrData.length - 1]?.value ?? 0;

  const closes = ohlcv.map(d => d.close);
  const ema20 = ema(closes, 20), ema50 = ema(closes, Math.min(50, closes.length - 1));
  const goldenCross = ema20[ema20.length - 1] > ema50[ema50.length - 1], deathCross = ema20[ema20.length - 1] < ema50[ema50.length - 1];
  const sma200 = closes.length >= 200 ? sma(closes, 200) : sma(closes, Math.min(closes.length - 1, 100));
  const aboveSMA200 = sma200.length > 0 && latestClose > sma200[sma200.length - 1];

  let bull = 0, bear = 0;
  const d = {};
  if (latestRSI < 30) { bull++; d.rsi = { status: 'BULLISH', value: latestRSI, reason: 'Oversold (<30)' }; }
  else if (latestRSI > 70) { bear++; d.rsi = { status: 'BEARISH', value: latestRSI, reason: 'Overbought (>70)' }; }
  else if (latestRSI >= 40 && latestRSI <= 60) { bull += 0.5; d.rsi = { status: 'NEUTRAL', value: latestRSI, reason: 'Neutral zone' }; }
  else { d.rsi = { status: 'NEUTRAL', value: latestRSI, reason: 'Neutral' }; }
  if (latestMACD) {
    if (latestMACD.histogram > 0 && latestMACD.macd > latestMACD.signal) { bull++; d.macd = { status: 'BULLISH', histogram: latestMACD.histogram, reason: 'MACD above signal, positive histogram' }; }
    else if (latestMACD.histogram < 0 && latestMACD.macd < latestMACD.signal) { bear++; d.macd = { status: 'BEARISH', histogram: latestMACD.histogram, reason: 'MACD below signal, negative histogram' }; }
    else { d.macd = { status: 'NEUTRAL', histogram: latestMACD?.histogram, reason: 'MACD crossing' }; }
  }
  if (goldenCross) { bull++; d.ema = { status: 'BULLISH', reason: 'Golden Cross: EMA20 > EMA50' }; }
  else if (deathCross) { bear++; d.ema = { status: 'BEARISH', reason: 'Death Cross: EMA20 < EMA50' }; }
  else { d.ema = { status: 'NEUTRAL', reason: 'No crossover' }; }
  if (latestBB) {
    if (latestClose <= latestBB.lower) { bull++; d.bollinger = { status: 'BULLISH', reason: 'Price at lower band (oversold)', squeeze: latestBB.squeeze }; }
    else if (latestClose >= latestBB.upper) { bear++; d.bollinger = { status: 'BEARISH', reason: 'Price at upper band (overbought)', squeeze: latestBB.squeeze }; }
    else if (latestBB.squeeze) { bull += 0.5; d.bollinger = { status: 'SQUEEZE', reason: 'Bollinger Squeeze - breakout imminent', squeeze: true }; }
    else { d.bollinger = { status: 'NEUTRAL', reason: 'Price within bands', squeeze: false }; }
  }
  const atrPct = latestClose > 0 ? (latestATR / latestClose) * 100 : 1;
  d.atr = { value: +latestATR.toFixed(2), pct: +atrPct.toFixed(2), highVol: atrPct > 2.5 };
  if (latestADX) {
    if (latestADX.adx > 25 && latestADX.plusDI > latestADX.minusDI) { bull++; d.adx = { status: 'BULLISH', adx: latestADX.adx, reason: 'Strong uptrend (ADX>25, +DI>-DI)' }; }
    else if (latestADX.adx > 25 && latestADX.minusDI > latestADX.plusDI) { bear++; d.adx = { status: 'BEARISH', adx: latestADX.adx, reason: 'Strong downtrend (ADX>25, -DI>+DI)' }; }
    else { d.adx = { status: 'NEUTRAL', adx: latestADX?.adx, reason: 'Weak trend (ADX<25)' }; }
  }
  if (latestStoch) {
    if (latestStoch.k < 20 && latestStoch.d < 20) { bull++; d.stochastic = { status: 'BULLISH', k: latestStoch.k, d: latestStoch.d, reason: 'Stochastic oversold (<20)' }; }
    else if (latestStoch.k > 80 && latestStoch.d > 80) { bear++; d.stochastic = { status: 'BEARISH', k: latestStoch.k, d: latestStoch.d, reason: 'Stochastic overbought (>80)' }; }
    else { d.stochastic = { status: 'NEUTRAL', k: latestStoch?.k, d: latestStoch?.d, reason: 'Neutral range' }; }
  }
  if (volumeProfile.highVolumeDay && volumeProfile.volumeRatio > 1.5) { bull += 0.5; d.volume = { status: 'BULLISH', ratio: volumeProfile.volumeRatio, reason: 'High volume confirms move' }; }
  else if (volumeProfile.volumeRatio < 0.5) { d.volume = { status: 'WEAK', ratio: volumeProfile.volumeRatio, reason: 'Low volume - weak signal' }; }
  else { d.volume = { status: 'NEUTRAL', ratio: volumeProfile.volumeRatio, reason: 'Normal volume' }; }
  if (rsDiv.bullish) { bull++; d.divergence = { type: 'BULLISH', reason: 'Bullish RSI divergence detected' }; }
  else if (rsDiv.bearish) { bear++; d.divergence = { type: 'BEARISH', reason: 'Bearish RSI divergence detected' }; }
  else { d.divergence = { type: 'NONE', reason: 'No divergence' }; }
  if (aboveSMA200) bull += 0.5; else bear += 0.5;
  const regimeBlocks = regime === MarketRegime.TRENDING_DOWN || regime === MarketRegime.BEAR_TRENDING;
  const crash = marketState === MarketState.CRASH;
  const net = bull - bear;
  const confidence = +Math.min(100, Math.abs(net) / 9 * 100 + 35).toFixed(1);
  let signal;
  if (crash || regimeBlocks) { if (net < -1) signal = Signal.STRONG_SELL; else if (net < 0) signal = Signal.SELL; else signal = Signal.HOLD; }
  else if (net >= 3.5) signal = Signal.STRONG_BUY;
  else if (net >= 1.5) signal = Signal.BUY;
  else if (net <= -3) signal = Signal.STRONG_SELL;
  else if (net <= -1.5) signal = Signal.SELL;
  else signal = Signal.HOLD;
  const stopLoss = calculateDynamicStopLoss(latestClose, latestATR);
  const pt1 = fibLevels?.target_382 ?? +(latestClose * 1.038).toFixed(2);
  const pt2 = fibLevels?.target_618 ?? +(latestClose * 1.062).toFixed(2);
  const pt3 = fibLevels?.target_100 ?? +(latestClose * 1.10).toFixed(2);
  const riskReward = stopLoss > 0 ? +((pt2 - latestClose) / (latestClose - stopLoss)).toFixed(2) : 0;
  return { signal, confirmations: Math.round(Math.max(bull, bear) * 2) / 2, bullishSignals: +bull.toFixed(1), bearishSignals: +bear.toFixed(1), confidence, details: d, indicators: { rsi: latestRSI, macd: latestMACD, bb: latestBB, atr: latestATR, adx: latestADX, stoch: latestStoch }, marketState, regime, divergence: rsDiv, fibonacci: fibLevels, support: support.slice(-3), resistance: resistance.slice(-3), stopLoss, profitTarget1: pt1, profitTarget2: pt2, profitTarget3: pt3, riskReward, profitScore: +Math.min(10, Math.max(0, net * 1.2 + 3)).toFixed(1), goldenCross, deathCross, volumeProfile, aboveSMA200 };
}

export function multiTimeframeConfluence(ohlcv) {
  if (!ohlcv || ohlcv.length < 20) return { confluence: 'NEUTRAL', score: 0 };
  function resample(data, n) { const out = []; for (let i = n - 1; i < data.length; i += n) { const s = data.slice(i - n + 1, i + 1); out.push({ date: data[i].date, open: s[0].open, high: Math.max(...s.map(d => d.high)), low: Math.min(...s.map(d => d.low)), close: s[s.length - 1].close, volume: s.reduce((a, d) => a + d.volume, 0) }); } return out; }
  const t1 = resample(ohlcv.slice(-20), 1), t5 = resample(ohlcv, 5), t15 = resample(ohlcv, 15);
  const qt = d => { if (d.length < 5) return 0; const c = d.map(x => x.close), e5 = ema(c, Math.min(5, c.length)), e10 = ema(c, Math.min(10, c.length)); return e5[e5.length - 1] > e10[e10.length - 1] ? 1 : e5[e5.length - 1] < e10[e10.length - 1] ? -1 : 0; };
  const s = qt(t1) + qt(t5) + qt(t15);
  return { confluence: s >= 2 ? 'BULLISH' : s <= -2 ? 'BEARISH' : s > 0 ? 'SLIGHTLY_BULLISH' : s < 0 ? 'SLIGHTLY_BEARISH' : 'NEUTRAL', score: s, t1m: qt(t1), t5m: qt(t5), t15m: qt(t15) };
}

export function generateSignalReasoning(analysis) {
  const { signal, details, marketState, regime, confirmations, riskReward } = analysis;
  const r = [];
  if (signal === 'STRONG_BUY') r.push('The stock is showing strong signs that it may go up soon. Multiple indicators agree on this.');
  else if (signal === 'BUY') r.push('The stock looks like it could be a good time to buy. Most indicators are positive.');
  else if (signal === 'SELL') r.push('The stock may be due for a drop. It might be wise to sell or wait before buying.');
  else if (signal === 'STRONG_SELL') r.push('Multiple warning signs are flashing. The stock is likely to go down.');
  else r.push('The signals are mixed right now. It is safer to wait and watch.');
  if (details.rsi) { const v = details.rsi.value; if (v < 35) r.push(`The stock has dropped a lot recently (RSI at ${v?.toFixed(0)}), meaning it might be undervalued.`); else if (v > 65) r.push(`The stock has risen a lot recently (RSI at ${v?.toFixed(0)}), meaning it might be overvalued.`); }
  if (details.macd?.status === 'BULLISH') r.push('Recent buying momentum is picking up speed — a positive sign.');
  else if (details.macd?.status === 'BEARISH') r.push('Recent selling pressure is increasing — a cautious sign.');
  if (details.ema?.status === 'BULLISH') r.push('Short-term momentum is stronger than the long-term trend, which is encouraging.');
  else if (details.ema?.status === 'BEARISH') r.push('Short-term momentum is slowing down compared to the long-term trend, suggesting caution.');
  if (details.bollinger?.squeeze) r.push('The stock is in a tight range — a bigger move may happen soon.');
  else if (details.bollinger?.status === 'BULLISH') r.push('The price is near its lower range, which sometimes means it is undervalued.');
  else if (details.bollinger?.status === 'BEARISH') r.push('The price is near its upper range, which sometimes means it is overvalued.');
  if (details.adx?.status === 'BULLISH') r.push(`The uptrend is strong (trend strength: ${details.adx.adx?.toFixed(0)}), meaning the upward move has solid backing.`);
  else if (details.adx?.status === 'BEARISH') r.push(`The downtrend is strong (trend strength: ${details.adx.adx?.toFixed(0)}), meaning the downward move has solid backing.`);
  if (details.volume?.status === 'BULLISH') r.push(`Trading volume is high (${details.volume.ratio?.toFixed(1)}x normal), confirming the move is real.`);
  if (regime === 'BULL_TRENDING') r.push('The overall market is in an upward phase, which supports buying.');
  else if (regime === 'BEAR_TRENDING' || regime === 'TRENDING_DOWN') r.push('The overall market is in a downward phase — safer to be cautious with new buys.');
  if (marketState === 'CRASH') r.push('The market is in a crash-like state — extreme caution needed.');
  else if (marketState === 'VOLATILE') r.push('The market is very volatile — consider smaller positions.');
  else if (marketState === 'RECOVERY') r.push('The market is recovering from a dip — early signs of improvement.');
  if (riskReward > 0) r.push(`For every ₹1 you risk, you may gain ₹${riskReward}.`);
  r.push(`Signal strength: ${confirmations} out of 8 indicators confirmed.`);
  return r.join(' ');
}
