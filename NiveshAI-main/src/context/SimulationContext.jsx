import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { db } from '@/lib/dbClient';
import { STOCK_SEED_DATA } from '@/lib/stockData';
import { toast } from 'sonner';

const FEE_RATE = 0.001;
const SIP_INTERVAL = 30;

const SimulationContext = createContext();

export function SimulationProvider({ children }) {
  const [currentSimIndex, setCurrentSimIndex] = useState(0);
  const [availableCash, setAvailableCash] = useState(0);
  const [initialCash, setInitialCash] = useState(0);
  const [maxSimIndex, setMaxSimIndex] = useState(0);
  const [globalTimeframe, setGlobalTimeframe] = useState('1Y');
  const [monthlySIPAmount, setMonthlySIPAmount] = useState(0);
  const [cashFlows, setCashFlows] = useState([]);

  const lastSipIndex = useRef(-1);

  const dateLookup = useMemo(() => {
    const stock = STOCK_SEED_DATA[0];
    return stock?.ohlcv_data?.map(d => d.date) || [];
  }, []);

  const currentSimDate = dateLookup[currentSimIndex] || '';

  const initializeFromProfile = useCallback((profile) => {
    const cash = profile?.investable_amount || 0;
    setAvailableCash(cash);
    setInitialCash(cash);
    setCurrentSimIndex(0);
    const stock = STOCK_SEED_DATA[0];
    setMaxSimIndex(stock?.ohlcv_data ? stock.ohlcv_data.length - 1 : 0);
    setCashFlows([]);
    lastSipIndex.current = -1;
    const sip = Math.round((profile?.monthly_income || 0) * 0.1);
    setMonthlySIPAmount(sip);
  }, []);

  const recordFlow = useCallback((amount, label) => {
    setCashFlows(prev => [...prev, { date: currentSimDate, amount, label }]);
  }, [currentSimDate]);

  const tickSimulation = useCallback(() => {
    setCurrentSimIndex(prev => {
      const next = Math.min(prev + 1, maxSimIndex);
      const nextDate = dateLookup[next];
      if (nextDate && monthlySIPAmount > 0 && next - lastSipIndex.current >= SIP_INTERVAL) {
        const sip = monthlySIPAmount;
        setAvailableCash(c => +(c + sip).toFixed(2));
        recordFlow(sip, 'Monthly SIP');
        lastSipIndex.current = next;
      }
      return next;
    });
  }, [maxSimIndex, dateLookup, monthlySIPAmount, recordFlow]);

  const setSimIndex = useCallback((idx) => {
    setCurrentSimIndex(Math.max(0, Math.min(idx, maxSimIndex)));
  }, [maxSimIndex]);

  const executeVirtualTrade = useCallback(async ({
    symbol, type, qty, price, sector, name, userEmail
  }) => {
    const grossValue = +(price * qty).toFixed(2);
    const fee = +(grossValue * FEE_RATE).toFixed(2);
    const totalWithFees = +(grossValue + fee).toFixed(2);

    if (type === 'BUY' && availableCash < totalWithFees) {
      toast.error(`Insufficient funds. Need ₹${totalWithFees.toLocaleString('en-IN')} (incl. ₹${fee.toLocaleString('en-IN')} fee), have ₹${availableCash.toLocaleString('en-IN')}.`);
      return false;
    }
    if (type === 'BUY') setAvailableCash(prev => +(prev - totalWithFees).toFixed(2));
    else if (type === 'SELL') setAvailableCash(prev => +(prev + grossValue - fee).toFixed(2));
    else { toast.error('Invalid trade type'); return false; }
    try {
      await db.entities.Trade.create({
        stock_symbol: symbol, stock_name: name, trade_type: type,
        quantity: qty, price, total_value: grossValue, sector,
        fees_paid: fee,
        sim_date: currentSimDate, trade_date: currentSimDate, created_by: userEmail,
      });
      recordFlow(-fee, `Trading fee (${type} ${symbol})`);
      return true;
    } catch (err) {
      console.error('Trade creation failed:', err);
      toast.error('Failed to record trade');
      return false;
    }
  }, [availableCash, currentSimDate, recordFlow]);

  const nextSipIndex = monthlySIPAmount > 0 && lastSipIndex.current + SIP_INTERVAL <= maxSimIndex
    ? lastSipIndex.current + SIP_INTERVAL : null;
  const nextSipDate = nextSipIndex !== null ? dateLookup[nextSipIndex] : null;
  const nextSipAmount = monthlySIPAmount;

  const value = useMemo(() => ({
    currentSimIndex, currentSimDate, availableCash, initialCash,
    maxSimIndex, dateLookup, globalTimeframe, setGlobalTimeframe,
    monthlySIPAmount, nextSipDate, nextSipAmount, cashFlows,
    initializeFromProfile, tickSimulation, setSimIndex, executeVirtualTrade,
  }), [currentSimIndex, currentSimDate, availableCash, initialCash, maxSimIndex, dateLookup,
      globalTimeframe, monthlySIPAmount, nextSipDate, nextSipAmount, cashFlows,
      initializeFromProfile, tickSimulation, setSimIndex, executeVirtualTrade]);

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used within SimulationProvider');
  return ctx;
}
