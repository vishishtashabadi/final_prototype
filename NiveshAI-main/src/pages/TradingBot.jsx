import { db } from '@/lib/dbClient';

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useAuth } from '@/lib/AuthContext';
import { useSimulation } from '@/context/SimulationContext';
import { STOCK_SEED_DATA, calculateUserSuitability, formatCurrency } from '@/lib/stockData';
import {
  runSignalConfirmation,
  generateSignalReasoning,
  calculatePositionSize,
  Signal,
} from '@/lib/tradingEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BotSignalCard from '@/components/bot/BotSignalCard';
import BotScannerTable from '@/components/bot/BotScannerTable';
import BotIndicatorPanel from '@/components/bot/BotIndicatorPanel';
import BotRiskPanel from '@/components/bot/BotRiskPanel';
import BotMarketStateCard from '@/components/bot/BotMarketStateCard';
import { motion } from 'framer-motion';
import {
  Sparkles, Play, RefreshCw, Shield, Zap, BarChart2, Eye, EyeOff
} from 'lucide-react';

export default function TradingBot() {
  const { user } = useAuth();
  const sim = useSimulation();
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('scanner');
  const [advancedView, setAdvancedView] = useState(false);

  const { data: dbStocks } = useQuery({ queryKey: ['stocks'], queryFn: () => db.entities.Stock.list() });
  const { data: profile } = useQuery({
    queryKey: ['financial-profile', user?.email],
    queryFn: () => db.entities.FinancialProfile.filter({ created_by: user?.email }),
    enabled: !!user?.email,
    select: data => data?.[0],
  });
  const { data: trades } = useQuery({
    queryKey: ['trades', user?.email],
    queryFn: () => db.entities.Trade.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const stocks = useMemo(() => dbStocks?.length > 0 ? dbStocks : STOCK_SEED_DATA, [dbStocks]);

  // Run full scan analysis on all stocks
  const scanResults = useMemo(() => {
    return stocks.map(stock => {
      const ohlcv = stock.ohlcv_data || [];
      const analysis = runSignalConfirmation(ohlcv);
      const reasoning = generateSignalReasoning(analysis);

      // Use new dynamic position sizing instead of hardcoded Kelly
      const sizing = calculatePositionSize(stock, profile);

      // Dynamic user suitability score
      const profileFit = calculateUserSuitability(stock, profile);
      const adjustedProfitScore = Math.max(0, analysis.profitScore * (0.7 + (profileFit / 100) * 0.3));

      return {
        ...stock,
        analysis,
        reasoning,
        sizing,
        botSignal: analysis.signal,
        profitScore: analysis.profitScore,
        profileFit,
        adjustedProfitScore,
      };
    }).sort((a, b) => b.adjustedProfitScore - a.adjustedProfitScore);
  }, [stocks, profile]);

  const selectedStock = useMemo(
    () => scanResults.find(s => s.symbol === selectedSymbol) || scanResults[0],
    [scanResults, selectedSymbol]
  );

  // Aggregate market stats
  const marketStats = useMemo(() => {
    const strongBuy = scanResults.filter(s => s.botSignal === Signal.STRONG_BUY).length;
    const buy = scanResults.filter(s => s.botSignal === Signal.BUY).length;
    const hold = scanResults.filter(s => s.botSignal === Signal.HOLD).length;
    const sell = scanResults.filter(s => s.botSignal === Signal.SELL).length;
    const strongSell = scanResults.filter(s => s.botSignal === Signal.STRONG_SELL).length;
    const bullish = strongBuy + buy;
    const bearish = sell + strongSell;
    const sentiment = bullish > bearish + 3 ? 'BULLISH' : bearish > bullish + 3 ? 'BEARISH' : 'NEUTRAL';
    const topPicks = scanResults.filter(s => [Signal.STRONG_BUY, Signal.BUY].includes(s.botSignal)).slice(0, 5);
    return { strongBuy, buy, hold, sell, strongSell, bullish, bearish, sentiment, topPicks };
  }, [scanResults]);

  // Portfolio context
  const queryClient = useQueryClient();
  const [tradePending, setTradePending] = useState(false);

  const holdingsMap = useMemo(() => {
    const map = {};
    (trades || []).forEach(t => {
      if (!map[t.stock_symbol]) map[t.stock_symbol] = { qty: 0, invested: 0 };
      if (t.trade_type === 'BUY') { map[t.stock_symbol].qty += t.quantity; map[t.stock_symbol].invested += t.total_value; }
      else { map[t.stock_symbol].qty -= t.quantity; }
    });
    return map;
  }, [trades]);

  const heldQty = selectedStock ? holdingsMap[selectedStock.symbol]?.qty || 0 : 0;
  const recommendedAction = selectedStock
    ? ([Signal.STRONG_BUY, Signal.BUY].includes(selectedStock.botSignal) ? 'BUY'
      : ([Signal.STRONG_SELL, Signal.SELL].includes(selectedStock.botSignal) ? 'SELL' : 'HOLD'))
    : 'HOLD';
  const recommendedQty = recommendedAction === 'BUY'
    ? selectedStock?.sizing?.shareQty || 1
    : recommendedAction === 'SELL'
      ? Math.min(heldQty, selectedStock?.sizing?.shareQty || 1)
      : 0;

  const handleBotTrade = async (tradeType) => {
    if (!selectedStock || !user?.email) {
      toast.error('Please log in to execute trades');
      return;
    }
    if (!sim.currentSimDate) {
      toast.error('Simulation date not set. Visit Dashboard first.');
      return;
    }

    const qty = tradeType === 'SELL'
      ? Math.max(1, Math.min(heldQty, selectedStock.sizing?.shareQty || 1))
      : Math.max(1, selectedStock.sizing?.shareQty || 1);

    if (tradeType === 'SELL' && heldQty === 0) {
      toast.error('No holdings available to sell');
      return;
    }

    // Cash check
    if (tradeType === 'BUY') {
      const totalCost = selectedStock.current_price * qty;
      if (sim.availableCash < totalCost) {
        toast.error(`Need ₹${(totalCost).toLocaleString('en-IN')}, have ₹${sim.availableCash.toLocaleString('en-IN')}`);
        return;
      }
    }

    setTradePending(true);
    const ok = await sim.executeVirtualTrade({
      symbol: selectedStock.symbol,
      type: tradeType,
      qty,
      price: selectedStock.current_price,
      sector: selectedStock.sector,
      name: selectedStock.name,
      userEmail: user?.email,
    });
    setTradePending(false);

    if (ok) {
      queryClient.invalidateQueries({ queryKey: ['trades', user?.email] });
      toast.success('Virtual trade executed successfully!');
    }
  };

  const handleRecommendedTrade = () => {
    if (recommendedAction === 'HOLD') {
      toast('No strong action recommended for this stock right now.');
      return;
    }
    handleBotTrade(recommendedAction);
  };

  const handleScan = useCallback(() => {
    setIsRunning(true);
    setScanProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setScanProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setIsRunning(false);
      }
    }, 80);
  }, []);

  const sentimentColor = {
    BULLISH: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    BEARISH: 'text-red-600 bg-red-50 border-red-200',
    NEUTRAL: 'text-amber-600 bg-amber-50 border-amber-200',
  }[marketStats.sentiment];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-dm font-bold">Smart Invest Guide</h1>
            <p className="text-sm text-muted-foreground">Your friendly AI assistant for smart investing</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`text-xs px-3 py-1 border ${sentimentColor}`}>
            Market: {marketStats.sentiment}
          </Badge>
          <Button
            onClick={handleScan}
            disabled={isRunning}
            className="gap-2"
            size="sm"
          >
            {isRunning ? (
              <><RefreshCw className="w-4 h-4 animate-spin" />Scanning...</>
            ) : (
              <><Play className="w-4 h-4" />Run Full Scan</>
            )}
          </Button>
        </div>
      </div>

      {/* Scan Progress */}
      {isRunning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Scanning {stocks.length} stocks for the best opportunities...</span>
            <span>{scanProgress}%</span>
          </div>
          <Progress value={scanProgress} className="h-2" />
        </motion.div>
      )}

      {/* Market Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Strong Buy', value: marketStats.strongBuy, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Buy', value: marketStats.buy, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Hold', value: marketStats.hold, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Sell', value: marketStats.sell, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Strong Sell', value: marketStats.strongSell, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Top Picks', value: marketStats.topPicks.length, color: 'text-primary', bg: 'bg-primary/10' },
        ].map(stat => (
          <Card key={stat.label} className={`${stat.bg} border-0`}>
            <CardContent className="p-3 text-center">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Scanner + Tabs */}
        <div className="xl:col-span-2 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="scanner" className="gap-1.5 text-xs"><BarChart2 className="w-3.5 h-3.5" />Scanner</TabsTrigger>
              <TabsTrigger value="signals" className="gap-1.5 text-xs"><Zap className="w-3.5 h-3.5" />Top Signals</TabsTrigger>
              <TabsTrigger value="risk" className="gap-1.5 text-xs"><Shield className="w-3.5 h-3.5" />Risk Manager</TabsTrigger>
            </TabsList>

            <TabsContent value="scanner" className="mt-4">
              <BotScannerTable
                scanResults={scanResults}
                selectedSymbol={selectedSymbol || scanResults[0]?.symbol}
                onSelect={setSelectedSymbol}
                holdingsMap={holdingsMap}
              />
            </TabsContent>

            <TabsContent value="signals" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {scanResults.filter(s => [Signal.STRONG_BUY, Signal.BUY].includes(s.botSignal)).slice(0, 6).map(stock => (
                  <BotSignalCard
                    key={stock.symbol}
                    stock={stock}
                    onClick={() => { setSelectedSymbol(stock.symbol); setActiveTab('scanner'); }}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="risk" className="mt-4">
              <BotRiskPanel
                scanResults={scanResults}
                trades={trades || []}
                stocks={stocks}
                profile={profile}
                holdingsMap={holdingsMap}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Detail Panel */}
        <div className="space-y-4">
          <BotMarketStateCard stock={selectedStock} />
          {selectedStock && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Quick Trade</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setAdvancedView(!advancedView)} className="text-xs gap-1">
                    {advancedView ? <><EyeOff className="w-3 h-3" /> Hide Advanced</> : <><Eye className="w-3 h-3" /> Advanced View</>}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!advancedView ? (
                  <>
                    <div className="p-3 bg-muted/50 rounded-lg text-sm leading-relaxed">
                      <p className="font-medium text-primary mb-1">Our Analysis:</p>
                      {selectedStock.reasoning}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                      <div>
                        <div className="text-xs text-emerald-700 font-medium">Profile Match</div>
                        <div className="text-xl font-bold text-emerald-600">{selectedStock.profileFit}% Match</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-emerald-700 font-medium">Suggested Amount</div>
                        <div className="text-lg font-bold text-emerald-600">₹{selectedStock.sizing?.positionSize?.toLocaleString()}</div>
                        <div className="text-xs text-emerald-600">{selectedStock.sizing?.shareQty} shares</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        Recommended action for <span className="font-semibold">{selectedStock.symbol}</span> based on your profile.
                      </p>
                      <Badge variant="secondary" className="text-xs px-2 py-1 uppercase">
                        {recommendedAction}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        onClick={handleRecommendedTrade}
                        disabled={tradePending || recommendedAction === 'HOLD' || (recommendedAction === 'SELL' && heldQty === 0)}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {recommendedAction === 'HOLD' ? 'No Action' : `${recommendedAction} ${recommendedQty || ''} Shares`}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleBotTrade('SELL')}
                        disabled={tradePending || heldQty === 0}
                      >
                        Sell {heldQty || 0}
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total to invest: ₹{selectedStock.sizing?.positionSize?.toLocaleString()} ({selectedStock.sizing?.riskPercent}% of your budget)
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground mb-2">
                      Showing advanced technical indicators for power users.
                    </div>
                    <BotIndicatorPanel stock={selectedStock} />
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
