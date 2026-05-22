// Pre-seeded NIFTY 50 stocks with realistic OHLCV data

// Sector phase templates — each sector has distinct trend timing so they're uncorrelated
const SECTOR_PHASE_TEMPLATES = {
  Energy: [
    { startDay: 0, endDay: 0.12, bias: 0.0020 }, { startDay: 0.12, endDay: 0.28, bias: -0.0015 },
    { startDay: 0.28, endDay: 0.55, bias: 0.0025 }, { startDay: 0.55, endDay: 0.68, bias: -0.0020 },
    { startDay: 0.68, endDay: 0.82, bias: 0.0010 }, { startDay: 0.82, endDay: 1.0, bias: -0.0005 },
  ],
  IT: [
    { startDay: 0, endDay: 0.18, bias: 0.0030 }, { startDay: 0.18, endDay: 0.35, bias: -0.0010 },
    { startDay: 0.35, endDay: 0.50, bias: 0.0015 }, { startDay: 0.50, endDay: 0.65, bias: -0.0030 },
    { startDay: 0.65, endDay: 0.78, bias: 0.0020 }, { startDay: 0.78, endDay: 1.0, bias: 0.0010 },
  ],
  Banking: [
    { startDay: 0, endDay: 0.10, bias: 0.0010 }, { startDay: 0.10, endDay: 0.22, bias: 0.0025 },
    { startDay: 0.22, endDay: 0.42, bias: -0.0018 }, { startDay: 0.42, endDay: 0.60, bias: 0.0020 },
    { startDay: 0.60, endDay: 0.75, bias: -0.0025 }, { startDay: 0.75, endDay: 1.0, bias: 0.0015 },
  ],
  Telecom: [
    { startDay: 0, endDay: 0.08, bias: -0.0010 }, { startDay: 0.08, endDay: 0.25, bias: 0.0020 },
    { startDay: 0.25, endDay: 0.45, bias: 0.0010 }, { startDay: 0.45, endDay: 0.60, bias: -0.0020 },
    { startDay: 0.60, endDay: 0.80, bias: 0.0030 }, { startDay: 0.80, endDay: 1.0, bias: -0.0015 },
  ],
  FMCG: [
    { startDay: 0, endDay: 0.15, bias: 0.0005 }, { startDay: 0.15, endDay: 0.30, bias: 0.0015 },
    { startDay: 0.30, endDay: 0.52, bias: -0.0010 }, { startDay: 0.52, endDay: 0.70, bias: 0.0010 },
    { startDay: 0.70, endDay: 0.85, bias: -0.0015 }, { startDay: 0.85, endDay: 1.0, bias: 0.0020 },
  ],
  Auto: [
    { startDay: 0, endDay: 0.10, bias: 0.0025 }, { startDay: 0.10, endDay: 0.22, bias: -0.0030 },
    { startDay: 0.22, endDay: 0.40, bias: 0.0018 }, { startDay: 0.40, endDay: 0.58, bias: 0.0025 },
    { startDay: 0.58, endDay: 0.72, bias: -0.0020 }, { startDay: 0.72, endDay: 1.0, bias: 0.0012 },
  ],
  Pharma: [
    { startDay: 0, endDay: 0.20, bias: 0.0012 }, { startDay: 0.20, endDay: 0.38, bias: -0.0022 },
    { startDay: 0.38, endDay: 0.55, bias: 0.0015 }, { startDay: 0.55, endDay: 0.68, bias: 0.0025 },
    { startDay: 0.68, endDay: 0.82, bias: -0.0008 }, { startDay: 0.82, endDay: 1.0, bias: 0.0018 },
  ],
  Metals: [
    { startDay: 0, endDay: 0.08, bias: -0.0020 }, { startDay: 0.08, endDay: 0.20, bias: 0.0035 },
    { startDay: 0.20, endDay: 0.38, bias: -0.0025 }, { startDay: 0.38, endDay: 0.55, bias: 0.0020 },
    { startDay: 0.55, endDay: 0.72, bias: 0.0015 }, { startDay: 0.72, endDay: 1.0, bias: -0.0030 },
  ],
  'Financial Services': [
    { startDay: 0, endDay: 0.12, bias: 0.0022 }, { startDay: 0.12, endDay: 0.30, bias: 0.0015 },
    { startDay: 0.30, endDay: 0.48, bias: -0.0020 }, { startDay: 0.48, endDay: 0.62, bias: 0.0018 },
    { startDay: 0.62, endDay: 0.78, bias: -0.0012 }, { startDay: 0.78, endDay: 1.0, bias: 0.0028 },
  ],
  Infrastructure: [
    { startDay: 0, endDay: 0.10, bias: 0.0018 }, { startDay: 0.10, endDay: 0.24, bias: -0.0028 },
    { startDay: 0.24, endDay: 0.45, bias: 0.0032 }, { startDay: 0.45, endDay: 0.60, bias: -0.0015 },
    { startDay: 0.60, endDay: 0.78, bias: 0.0010 }, { startDay: 0.78, endDay: 1.0, bias: -0.0020 },
  ],
};

function generateOHLCV(basePrice, days = 730, volatility = 0.02, sectorBias = 'IT') {
  const data = [];
  let price = basePrice;
  const startDate = new Date('2023-04-15');
  const raw = SECTOR_PHASE_TEMPLATES[sectorBias] || SECTOR_PHASE_TEMPLATES.IT;
  const phases = raw.map(p => ({
    startDay: Math.floor(p.startDay * days),
    endDay: Math.floor(p.endDay * days),
    dailyBias: p.bias,
  }));

  let idx = 0;
  for (let i = 0; idx < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const phase = phases.find(p => idx >= p.startDay && idx < p.endDay) || phases[phases.length - 1];
    const noise = (Math.random() - 0.5) * volatility * price;
    const drift = phase.dailyBias * price;
    const change = drift + noise;
    const open = +(price + (Math.random() - 0.5) * volatility * price * 0.3).toFixed(2);
    const close = +(price + change).toFixed(2);
    const high = +(Math.max(open, close) + Math.random() * volatility * price * 0.4).toFixed(2);
    const low = +(Math.min(open, close) - Math.random() * volatility * price * 0.4).toFixed(2);
    const volume = Math.floor(800000 + Math.random() * 12000000);
    data.push({ date: date.toISOString().split('T')[0], open, high, low, close, volume });
    price = close;
    idx++;
  }
  return data;
}

export const STOCK_SEED_DATA = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd", sector: "Energy", current_price: 2945.60, market_cap: "Large Cap", pe_ratio: 28.5, dividend_yield: 0.34, week_52_high: 3217.60, week_52_low: 2220.30, risk_level: "Medium", signal: "BUY", signal_reasoning: "RSI at 42 indicates the stock is neither overbought nor oversold. The 20-day SMA has crossed above the 50-day SMA forming a Golden Cross — a classic bullish signal. Strong quarterly results with 18% YoY revenue growth in retail and telecom segments support upside momentum.", description: "India's largest conglomerate with interests in petrochemicals, retail, telecom (Jio), and digital services.", ohlcv_data: generateOHLCV(2850, 730, 0.015, 'Energy') },
  { symbol: "TCS", name: "Tata Consultancy Services", sector: "IT", current_price: 3892.45, market_cap: "Large Cap", pe_ratio: 32.1, dividend_yield: 1.18, week_52_high: 4243.80, week_52_low: 3311.00, risk_level: "Low", signal: "HOLD", signal_reasoning: "MACD histogram is flattening near zero line, suggesting consolidation. The stock trades near its 50-day moving average. IT sector faces headwinds from US spending cuts, but TCS's diversified client base provides stability. Wait for breakout above ₹4,000 for fresh entry.", description: "India's largest IT services company and a global leader in consulting, technology, and digital solutions.", ohlcv_data: generateOHLCV(3800, 730, 0.012, 'IT') },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd", sector: "Banking", current_price: 1842.30, market_cap: "Large Cap", pe_ratio: 20.8, dividend_yield: 1.12, week_52_high: 1880.00, week_52_low: 1430.00, risk_level: "Low", signal: "STRONG_BUY", signal_reasoning: "The stock has broken above its 200-day SMA with rising volumes — a strong bullish confirmation. RSI at 58 shows room for upside. HDFC Bank posted record net profit with improving NIM (Net Interest Margins). The merger synergies are fully priced in, making this a value pick.", description: "India's largest private sector bank with a strong retail franchise and consistent growth track record.", ohlcv_data: generateOHLCV(1780, 730, 0.013, 'Banking') },
  { symbol: "INFY", name: "Infosys Ltd", sector: "IT", current_price: 1578.90, market_cap: "Large Cap", pe_ratio: 27.3, dividend_yield: 2.45, week_52_high: 1988.50, week_52_low: 1352.60, risk_level: "Low", signal: "BUY", signal_reasoning: "RSI has bounced from oversold territory (32→48). The stock is at 52-week support with strong dividend yield of 2.45%. AI/cloud deals pipeline is robust. The price-to-book ratio of 8.2 is below 3-year average. Good entry point for long-term investors.", description: "Global leader in next-generation digital services and consulting, enabling clients across 56 countries.", ohlcv_data: generateOHLCV(1520, 730, 0.018, 'IT') },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd", sector: "Banking", current_price: 1312.75, market_cap: "Large Cap", pe_ratio: 18.2, dividend_yield: 0.78, week_52_high: 1362.35, week_52_low: 1045.00, risk_level: "Low", signal: "BUY", signal_reasoning: "Bollinger Bands show a squeeze pattern indicating an imminent breakout. Price above all major moving averages. Consistent 20%+ ROE over 8 quarters. Asset quality remains strong with GNPA at 2.16%. Best-in-class banking stock for steady compounding.", description: "India's second-largest private sector bank with a strong presence across banking and financial services.", ohlcv_data: generateOHLCV(1280, 730, 0.014, 'Banking') },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", sector: "Telecom", current_price: 1685.20, market_cap: "Large Cap", pe_ratio: 78.5, dividend_yield: 0.48, week_52_high: 1779.00, week_52_low: 1200.00, risk_level: "Medium", signal: "HOLD", signal_reasoning: "MACD is in bullish territory but momentum is weakening. High PE ratio of 78.5x makes valuation rich. However, ARPU growth from tariff hikes and 5G monetization provide long-term tailwinds. Accumulate on dips below ₹1,600.", description: "India's leading telecom operator with growing digital TV, data center, and enterprise businesses.", ohlcv_data: generateOHLCV(1650, 730, 0.016, 'Telecom') },
  { symbol: "SBIN", name: "State Bank of India", sector: "Banking", current_price: 812.45, market_cap: "Large Cap", pe_ratio: 10.2, dividend_yield: 1.65, week_52_high: 912.10, week_52_low: 680.00, risk_level: "Medium", signal: "STRONG_BUY", signal_reasoning: "Trading at a significant discount to book value (P/B 1.8x vs sector avg 2.5x). RSI at 38 suggests oversold conditions. SBI's net NPA at 0.57% is at historical lows. Government capex spending will boost corporate loan growth. Dividend yield of 1.65% provides downside protection.", description: "India's largest public sector bank with the widest branch network and growing digital banking capabilities.", ohlcv_data: generateOHLCV(790, 730, 0.018, 'Banking') },
  { symbol: "ITC", name: "ITC Ltd", sector: "FMCG", current_price: 438.25, market_cap: "Large Cap", pe_ratio: 26.8, dividend_yield: 3.12, week_52_high: 500.00, week_52_low: 390.00, risk_level: "Low", signal: "BUY", signal_reasoning: "ITC's demerger of hotel business is a positive catalyst. Highest dividend yield (3.12%) among Nifty stocks. FMCG segment growing at 12% CAGR. RSI at 45 with price near 200-day SMA support. Excellent risk-reward for income-seeking conservative investors.", description: "Diversified conglomerate with leading positions in FMCG, hotels, paperboards, packaging, and agri-business.", ohlcv_data: generateOHLCV(430, 730, 0.012, 'FMCG') },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", sector: "Auto", current_price: 742.80, market_cap: "Large Cap", pe_ratio: 8.5, dividend_yield: 0.35, week_52_high: 1066.00, week_52_low: 620.00, risk_level: "High", signal: "SELL", signal_reasoning: "Stock has formed a Death Cross (50-day SMA below 200-day SMA). JLR margins under pressure from EV transition costs. Volume decline of 15% in domestic CV segment. RSI at 35 but no reversal signal yet. Avoid until price stabilizes above ₹780.", description: "India's largest auto manufacturer, owner of Jaguar Land Rover, leading in EV transition with Nexon, Punch EV.", ohlcv_data: generateOHLCV(780, 730, 0.025, 'Auto') },
  { symbol: "WIPRO", name: "Wipro Ltd", sector: "IT", current_price: 462.30, market_cap: "Large Cap", pe_ratio: 22.8, dividend_yield: 0.22, week_52_high: 570.00, week_52_low: 380.00, risk_level: "Medium", signal: "HOLD", signal_reasoning: "Wipro underperforms IT peers. Revenue growth guidance of 1-3% is below industry average. However, AI-led deals are improving. Stock trades at 22.8x PE — cheaper than TCS/Infy. Wait for turnaround signals in Q2 earnings.", description: "Global IT, consulting, and business process services company with operations across 66 countries.", ohlcv_data: generateOHLCV(450, 730, 0.02, 'IT') },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Industries", sector: "Pharma", current_price: 1825.40, market_cap: "Large Cap", pe_ratio: 38.2, dividend_yield: 0.55, week_52_high: 1960.00, week_52_low: 1398.00, risk_level: "Medium", signal: "BUY", signal_reasoning: "Specialty portfolio (Ilumya, Cequa) growing at 30%+ in US markets. MACD shows bullish crossover. RSI at 52 is neutral with upside potential. R&D pipeline has 3 drugs in Phase-3 trials. Pharma sector benefits from defensive positioning during market volatility.", description: "India's largest pharma company, 4th largest specialty generics company globally.", ohlcv_data: generateOHLCV(1780, 730, 0.017, 'Pharma') },
  { symbol: "MARUTI", name: "Maruti Suzuki India Ltd", sector: "Auto", current_price: 12450.60, market_cap: "Large Cap", pe_ratio: 30.5, dividend_yield: 0.72, week_52_high: 13680.00, week_52_low: 10440.00, risk_level: "Medium", signal: "HOLD", signal_reasoning: "Auto sales volume up 8% YoY but ASP growth is slowing. SUV mix at 55% is positive for margins. EV entry delayed to 2025. RSI at 55 and price consolidating between ₹12,000-13,000. Hold for long-term; EV catalyst may rerate stock.", description: "India's largest passenger car manufacturer with over 42% market share. Subsidiary of Suzuki Motor Corporation.", ohlcv_data: generateOHLCV(12200, 730, 0.014, 'Auto') },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd", sector: "Metals", current_price: 152.35, market_cap: "Large Cap", pe_ratio: 55.0, dividend_yield: 2.35, week_52_high: 184.60, week_52_low: 120.00, risk_level: "High", signal: "SELL", signal_reasoning: "Global steel prices declining 12% QoQ. European operations continue to bleed with £800M annual losses. RSI at 28 is oversold but no volume-backed recovery seen. China dumping fears persist. Avoid until European restructuring clarity emerges.", description: "India's largest steel producer with integrated operations across mining, steel manufacturing, and distribution.", ohlcv_data: generateOHLCV(160, 730, 0.03, 'Metals') },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd", sector: "Financial Services", current_price: 8742.50, market_cap: "Large Cap", pe_ratio: 35.2, dividend_yield: 0.40, week_52_high: 9545.00, week_52_low: 6188.00, risk_level: "Medium", signal: "STRONG_BUY", signal_reasoning: "AUM growth at 34% YoY is industry-leading. New customer additions at 4.5M/quarter. MACD bullish crossover with rising histogram. RSI at 48 leaves room for rally. Fintech pivot with app-based lending driving operating leverage. Premium valuation justified by growth.", description: "India's largest NBFC with diversified lending portfolio across consumer, SME, commercial, and rural segments.", ohlcv_data: generateOHLCV(8500, 730, 0.018, 'Financial Services') },
  { symbol: "HCLTECH", name: "HCL Technologies Ltd", sector: "IT", current_price: 1645.80, market_cap: "Large Cap", pe_ratio: 25.6, dividend_yield: 3.52, week_52_high: 2000.00, week_52_low: 1380.00, risk_level: "Low", signal: "BUY", signal_reasoning: "Highest dividend yield in IT sector (3.52%). Strong services deal pipeline with $2.8B TCV in latest quarter. Price near 52-week support. RSI at 40 suggests recovery potential. AI services business growing at 45%+ making it a value pick in IT space.", description: "Third-largest Indian IT services company with strengths in engineering R&D and infrastructure management.", ohlcv_data: generateOHLCV(1600, 730, 0.016, 'IT') },
  { symbol: "ADANIENT", name: "Adani Enterprises Ltd", sector: "Infrastructure", current_price: 2380.90, market_cap: "Large Cap", pe_ratio: 72.0, dividend_yield: 0.05, week_52_high: 3480.00, week_52_low: 2025.00, risk_level: "High", signal: "HOLD", signal_reasoning: "High volatility stock with beta of 1.8. New airport and green hydrogen businesses provide long-term optionality. However, PE of 72x with thin margins makes valuation stretched. Suitable only for high-risk appetite investors with 5+ year horizon.", description: "Flagship Adani Group company with interests in airports, data centers, roads, green hydrogen, and mining.", ohlcv_data: generateOHLCV(2300, 730, 0.028, 'Infrastructure') },
  { symbol: "LTIM", name: "LTIMindtree Ltd", sector: "IT", current_price: 5245.30, market_cap: "Large Cap", pe_ratio: 34.8, dividend_yield: 1.15, week_52_high: 6360.00, week_52_low: 4582.00, risk_level: "Medium", signal: "BUY", signal_reasoning: "Post-merger integration complete. Deal wins up 22% YoY. MACD bullish divergence forming on daily chart. Price near strong support zone ₹5,100-5,200. Digital engineering segment growing at 25%. AI and cloud deals pipeline is strongest among mid-tier IT.", description: "Top-5 Indian IT company formed by merger of L&T Infotech and Mindtree, specializing in digital engineering.", ohlcv_data: generateOHLCV(5100, 730, 0.019, 'IT') },
  { symbol: "NESTLEIND", name: "Nestle India Ltd", sector: "FMCG", current_price: 2348.70, market_cap: "Large Cap", pe_ratio: 72.5, dividend_yield: 1.38, week_52_high: 2778.00, week_52_low: 2142.00, risk_level: "Low", signal: "HOLD", signal_reasoning: "Defensive stock with consistent 15% CAGR earnings growth. However, valuation at 72.5x PE is expensive. Volume growth at 7.8% is healthy. Maggi, KitKat brands have strong pricing power. Good for SIP-based accumulation rather than lump sum entry.", description: "India's largest food company, part of Nestle SA. Market leader in noodles, coffee, dairy, and confectionery.", ohlcv_data: generateOHLCV(2300, 730, 0.01, 'FMCG') },
  { symbol: "POWERGRID", name: "Power Grid Corporation", sector: "Energy", current_price: 315.40, market_cap: "Large Cap", pe_ratio: 18.5, dividend_yield: 4.20, week_52_high: 357.00, week_52_low: 252.00, risk_level: "Low", signal: "STRONG_BUY", signal_reasoning: "Highest dividend yield (4.2%) among Nifty stocks. Government capex on transmission infrastructure provides revenue visibility. ROE consistently above 18%. RSI at 44 with price above 200-day SMA. Perfect defensive pick for conservative investors seeking income.", description: "India's largest electric power transmission company, operating one of the world's largest transmission networks.", ohlcv_data: generateOHLCV(308, 730, 0.012, 'Energy') },
  { symbol: "ZOMATO", name: "Zomato Ltd", sector: "IT", current_price: 245.60, market_cap: "Large Cap", pe_ratio: 320.0, dividend_yield: 0.0, week_52_high: 304.50, week_52_low: 125.00, risk_level: "High", signal: "SELL", signal_reasoning: "Extreme valuation at 320x PE despite first-time profitability. Quick commerce (Blinkit) is cash-burning growth story. RSI at 62 approaching overbought. Competitive intensity from Swiggy, BigBasket increasing. Book profits; re-enter below ₹200 for long-term play.", description: "India's leading food delivery and quick commerce platform. Blinkit acquisition driving growth in instant delivery.", ohlcv_data: generateOHLCV(240, 730, 0.03, 'IT') },
];

STOCK_SEED_DATA.forEach(s => {
  const o = s.ohlcv_data;
  if (o && o.length > 0) s.current_price = o[o.length - 1].close;
});

export function calculateVolatility(ohlcv) {
  if (!ohlcv || ohlcv.length < 2) return 0;
  const returns = [];
  for (let i = 1; i < ohlcv.length; i++) returns.push((ohlcv[i].close - ohlcv[i - 1].close) / ohlcv[i - 1].close);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export function calculateUserSuitability(stock, userProfile) {
  if (!stock || !userProfile) return 50;
  const riskLevelScores = { Low: 20, Medium: 50, High: 80 };
  const stockRiskScore = riskLevelScores[stock.risk_level] || 50;
  const volatility = calculateVolatility(stock.ohlcv_data);
  const volatilityScore = Math.min(100, (volatility / 100) * 100);
  const userRiskMap = { conservative: 15, moderate: 50, aggressive: 85 };
  const userRiskScore = userRiskMap[userProfile.risk_appetite] || 50;
  const experienceMap = { beginner: 0, intermediate: 30, advanced: 60 };
  const experienceScore = experienceMap[userProfile.investment_experience] || 0;
  const goalMap = { wealth_preservation: 10, stable_income: 25, balanced_growth: 50, aggressive_growth: 75, speculation: 90 };
  const goalScore = goalMap[userProfile.investment_goals] || 50;
  const userComposite = (userRiskScore + experienceScore + goalScore) / 3;
  const stockComposite = (stockRiskScore + volatilityScore) / 2;
  const diff = Math.abs(userComposite - stockComposite);
  return Math.round(Math.min(100, Math.max(0, 100 - diff)));
}

export function calculateSMA(data, period) {
  const r = [];
  for (let i = period - 1; i < data.length; i++) { const s = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b.close, 0); r.push({ date: data[i].date, value: +(s / period).toFixed(2) }); }
  return r;
}

export function calculateRSI(data, period = 14) {
  if (data.length < period + 1) return [];
  const changes = [];
  for (let i = 1; i < data.length; i++) changes.push(data[i].close - data[i - 1].close);
  let avgG = 0, avgL = 0;
  for (let i = 0; i < period; i++) { if (changes[i] > 0) avgG += changes[i]; else avgL += Math.abs(changes[i]); }
  avgG /= period; avgL /= period;
  const r = [];
  const rs = avgL === 0 ? 100 : avgG / avgL;
  r.push({ date: data[period].date, value: +(100 - 100 / (1 + rs)).toFixed(2) });
  for (let i = period; i < changes.length; i++) {
    avgG = (avgG * (period - 1) + (changes[i] > 0 ? changes[i] : 0)) / period;
    avgL = (avgL * (period - 1) + (changes[i] < 0 ? Math.abs(changes[i]) : 0)) / period;
    const rs2 = avgL === 0 ? 100 : avgG / avgL;
    r.push({ date: data[i + 1].date, value: +(100 - 100 / (1 + rs2)).toFixed(2) });
  }
  return r;
}

export function getSignalColor(s) { const c = { STRONG_BUY: "text-emerald-600 bg-emerald-50 border-emerald-200", BUY: "text-green-600 bg-green-50 border-green-200", HOLD: "text-amber-600 bg-amber-50 border-amber-200", SELL: "text-orange-600 bg-orange-50 border-orange-200", STRONG_SELL: "text-red-600 bg-red-50 border-red-200" }; return c[s] || c.HOLD; }
export function getRiskColor(r) { const c = { Low: "text-emerald-600 bg-emerald-50", Medium: "text-amber-600 bg-amber-50", High: "text-red-600 bg-red-50" }; return c[r] || c.Medium; }
export function formatCurrency(amount) { if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`; if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`; return `₹${amount?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }
export function formatNumber(num) { return num?.toLocaleString('en-IN', { maximumFractionDigits: 2 }); }

export function calculateMACD(data, fast = 12, slow = 26, signal = 9) {
  if (data.length < slow + signal) return [];
  function ema(prices, period) { const k = 2 / (period + 1); let v = prices[0]; return prices.map(p => { v = p * k + v * (1 - k); return +v.toFixed(2); }); }
  const closes = data.map(d => d.close), emaF = ema(closes, fast), emaS = ema(closes, slow), macdL = emaF.map((v, i) => +(v - emaS[i]).toFixed(2)), macdS = ema(macdL.slice(slow - 1), signal);
  const r = [];
  for (let i = slow - 1 + signal - 1; i < data.length; i++) { const idx = i - (slow - 1 + signal - 1), m = macdL[i], s = macdS[idx]; r.push({ date: data[i].date, macd: m, signal: s, histogram: +(m - s).toFixed(2) }); }
  return r;
}

export function calculateBollingerBands(data, period = 20, stdDev = 2) {
  const r = [];
  for (let i = period - 1; i < data.length; i++) { const slice = data.slice(i - period + 1, i + 1), mean = slice.reduce((a, b) => a + b.close, 0) / period, variance = slice.reduce((a, b) => a + Math.pow(b.close - mean, 2), 0) / period, sd = Math.sqrt(variance); r.push({ date: data[i].date, middle: +mean.toFixed(2), upper: +(mean + stdDev * sd).toFixed(2), lower: +(mean - stdDev * sd).toFixed(2) }); }
  return r;
}

export function getDynamicPrice(stock) { if (!stock) return 0; const o = stock.ohlcv_data; if (o && o.length > 0) return o[o.length - 1].close; return stock.current_price || 0; }
