import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { db } from '@/lib/dbClient';
import { STOCK_SEED_DATA } from '@/lib/stockData';
import { toast } from 'sonner';

const SimulationContext = createContext();

export function SimulationProvider({ children }) {
  const [currentSimIndex, setCurrentSimIndex] = useState(0);
  const [availableCash, setAvailableCash] = useState(0);
  const [initialCash, setInitialCash] = useState(0);
  const [maxSimIndex, setMaxSimIndex] = useState(0);

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
  }, []);

  const tickSimulation = useCallback(() => {
    setCurrentSimIndex(prev => Math.min(prev + 1, maxSimIndex));
  }, [maxSimIndex]);

  const setSimIndex = useCallback((idx) => {
    setCurrentSimIndex(Math.max(0, Math.min(idx, maxSimIndex)));
  }, [maxSimIndex]);

  const executeVirtualTrade = useCallback(async ({
    symbol, type, qty, price, sector, name, userEmail
  }) => {
    const totalValue = +(price * qty).toFixed(2);
    if (type === 'BUY' && availableCash < totalValue) {
      toast.error(`Insufficient funds. Need ₹${totalValue.toLocaleString('en-IN')}, have ₹${availableCash.toLocaleString('en-IN')}.`);
      return false;
    }
    if (type === 'BUY') setAvailableCash(prev => +(prev - totalValue).toFixed(2));
    else if (type === 'SELL') setAvailableCash(prev => +(prev + totalValue).toFixed(2));
    else { toast.error('Invalid trade type'); return false; }
    try {
      await db.entities.Trade.create({
        stock_symbol: symbol, stock_name: name, trade_type: type,
        quantity: qty, price, total_value: totalValue, sector,
        sim_date: currentSimDate, trade_date: currentSimDate, created_by: userEmail,
      });
      return true;
    } catch (err) {
      console.error('Trade creation failed:', err);
      toast.error('Failed to record trade');
      return false;
    }
  }, [availableCash, currentSimDate]);

  const value = useMemo(() => ({
    currentSimIndex, currentSimDate, availableCash, initialCash,
    maxSimIndex, dateLookup, initializeFromProfile,
    tickSimulation, setSimIndex, executeVirtualTrade,
  }), [currentSimIndex, currentSimDate, availableCash, initialCash, maxSimIndex, dateLookup,
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
