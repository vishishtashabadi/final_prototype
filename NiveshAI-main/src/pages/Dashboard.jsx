import { db } from '@/lib/dbClient';

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { STOCK_SEED_DATA, formatCurrency } from '@/lib/stockData';
import { useSimulation } from '@/context/SimulationContext';
import { computePortfolioSummary } from '@/lib/portfolioEngine';
import StatsRow from '@/components/dashboard/StatsRow';
import PortfolioChart from '@/components/dashboard/PortfolioChart';
import SectorAllocation from '@/components/dashboard/SectorAllocation';
import TopMovers from '@/components/dashboard/TopMovers';
import QuickSignals from '@/components/dashboard/QuickSignals';
import PortfolioHealthScore from '@/components/dashboard/PortfolioHealthScore';
import InvestmentProjection from '@/components/dashboard/InvestmentProjection';
import AIInsightFeed from '@/components/dashboard/AIInsightFeed';
import MarketBreadth from '@/components/dashboard/MarketBreadth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Wallet, BarChart3, Clock, LineChart } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stocks, setStocks] = useState([]);
  const sim = useSimulation();

  const { data: profiles, isLoading: loadingProfile } = useQuery({
    queryKey: ['financial-profile', user?.email],
    queryFn: () => db.entities.FinancialProfile.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: dbStocks, isLoading: loadingStocks } = useQuery({
    queryKey: ['stocks'],
    queryFn: () => db.entities.Stock.list(),
  });

  const { data: trades } = useQuery({
    queryKey: ['trades', user?.email],
    queryFn: () => db.entities.Trade.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  useEffect(() => {
    setStocks(dbStocks?.length > 0 ? dbStocks : STOCK_SEED_DATA);
  }, [dbStocks]);

  const profile = profiles?.[0];

  // Initialize simulation cash once profile loads
  useEffect(() => {
    if (profile) {
      sim.initializeFromProfile(profile);
    }
  }, [profile]);

  useEffect(() => {
    if (!loadingProfile && profiles && profiles.length === 0) {
      navigate('/onboarding');
    }
  }, [loadingProfile, profiles, navigate]);

  // ── Portfolio summary via engine ──
  const summary = useMemo(() => {
    if (!sim.currentSimDate || !stocks.length) return null;
    return computePortfolioSummary(
      trades || [],
      stocks,
      sim.currentSimDate,
      sim.initialCash,
    );
  }, [trades, stocks, sim.currentSimDate, sim.initialCash]);

  // ── Legacy holdings map (for health score etc.) ──
  const holdings = useMemo(() => {
    if (!summary) return [];
    return summary.holdings.map(h => ({
      symbol: h.symbol,
      qty: h.qty,
      invested: h.totalCost,
      sector: h.sector,
      currentVal: h.currentValue,
      pnl: h.pnl,
      currentPrice: h.currentPrice,
    }));
  }, [summary]);

  // Override the investable amount shown in StatsRow with actual available cash
  const enhancedProfile = useMemo(() => {
    if (!profile) return profile;
    return { ...profile, investable_amount: sim.availableCash };
  }, [profile, sim.availableCash]);

  if (loadingProfile || loadingStocks) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-mint pulse-live inline-block" />
            <span className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
              Sim: {sim.currentSimDate || 'N/A'} · Day {sim.currentSimIndex + 1}/{sim.maxSimIndex + 1}
            </span>
            <button onClick={() => sim.setSimIndex(0)} className="text-xs text-primary hover:underline ml-2">Reset</button>
          </div>
          <h1 className="text-2xl lg:text-3xl font-space font-bold text-foreground">
            Welcome back, <span className="text-cyan">{user?.full_name?.split(' ')[0] || 'Investor'}</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Here's how your portfolio is performing on this simulation date</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => sim.tickSimulation()}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5"
          >
            <Clock className="w-4 h-4" /> Next Day
          </button>
        </div>
      </div>

      {/* Aggregate summary bar */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Portfolio Value', value: formatCurrency(summary.totalPortfolioValue), icon: Wallet, color: 'bg-primary/10 text-primary', sub: 'Cash + Market' },
            { label: 'Total P&L', value: `${summary.totalPnL >= 0 ? '+' : ''}${formatCurrency(summary.totalPnL)}`, icon: summary.totalPnL >= 0 ? TrendingUp : TrendingDown, color: summary.totalPnL >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600', sub: `${summary.totalPnLPct >= 0 ? '+' : ''}${summary.totalPnLPct}%` },
            { label: 'Available Cash', value: formatCurrency(sim.availableCash), icon: Wallet, color: 'bg-blue-50 text-blue-600', sub: `${summary.holdingsCount} holdings` },
            { label: 'Simulation Date', value: sim.currentSimDate?.slice(5) || '--', icon: LineChart, color: 'bg-amber-50 text-amber-600', sub: `Day ${sim.currentSimIndex + 1}` },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    <p className={`text-xl font-dm font-bold mt-1 ${stat.label === 'Total P&L' ? (summary.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-500') : ''}`}>{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Legacy StatsRow (for secondary metrics like buy signals) */}
      <StatsRow trades={trades || []} stocks={stocks} profile={enhancedProfile} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {summary ? (
            <PortfolioChart trades={trades || []} stocks={stocks} equityData={summary.equityCurveData} />
          ) : (
            <PortfolioChart trades={trades || []} stocks={stocks} />
          )}
        </div>
        <div className="space-y-6">
          <MarketBreadth stocks={stocks} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AIInsightFeed stocks={stocks} holdings={holdings} profile={profile} />
        </div>
        {summary ? (
          <SectorAllocation trades={trades || []} stocks={stocks} sectorData={summary.sectorAllocation} />
        ) : (
          <SectorAllocation trades={trades || []} stocks={stocks} />
        )}
      </div>

      {holdings.length > 0 && (
        <PortfolioHealthScore holdings={holdings} stocks={stocks} profile={profile} />
      )}

      <InvestmentProjection profile={profile} />

      {summary && (
        <TopMovers trades={trades || []} stocks={stocks} gainers={summary.topGainers} losers={summary.topLosers} />
      )}

      <QuickSignals stocks={stocks} />
    </div>
  );
}
