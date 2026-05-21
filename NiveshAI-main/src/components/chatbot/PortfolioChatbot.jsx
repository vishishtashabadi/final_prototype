import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, Send, X, ChevronRight, Sparkle, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Info, Lightbulb } from 'lucide-react';
import { processChatMessage } from './chatIntents';
import { formatCurrency } from '@/lib/stockData';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dbClient';
import { STOCK_SEED_DATA } from '@/lib/stockData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button'

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-muted rounded-2xl w-fit">
      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function ChatMessage({ message }) {
  if (message.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (message.responseType) {
      case 'commands':
        return (
          <div className="space-y-3">
            <p className="font-semibold text-sm">Here are the things I can do for you:</p>
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: 'Investment Advice', desc: 'Ask "What should I buy?"' },
                { label: 'Portfolio Summary', desc: 'Ask "How am I doing?"' },
                { label: 'What-If Scenarios', desc: 'Ask "What if I buy 10 shares of Reliance?"' },
                { label: 'Risk Analysis', desc: 'Ask "How risky is my portfolio?"' },
                { label: '50/30/20 Rule', desc: 'Ask "Show me my 50/30/20"' },
                { label: 'Daily Tip', desc: 'Ask "Give me a tip"' },
                { label: 'Watchlist Signals', desc: 'Ask "My watchlist"' },
                { label: 'Health Score', desc: 'Ask "How healthy is my portfolio?"' },
              ].map(cmd => (
                <div key={cmd.label} className="flex items-center justify-between bg-background/50 p-2.5 rounded-lg border border-border/50">
                  <div>
                    <p className="text-sm font-medium">{cmd.label}</p>
                    <p className="text-xs text-muted-foreground">{cmd.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        );

      case 'recommendations':
        return (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
            <div className="grid grid-cols-1 gap-2">
              {message.stocks?.map(s => (
                <div key={s.symbol} className="p-3 bg-background/50 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{s.symbol}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.signal?.includes('BUY') ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{s.signal}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.name}</p>
                  <p className="text-sm font-semibold mt-1">{formatCurrency(s.price)}</p>
                  <p className="text-xs text-muted-foreground mt-1 italic">{s.reasoning}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case 'whatif':
        return (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
            {message.result && (
              <div className="p-3 bg-background/50 rounded-lg border border-border/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Cost:</span>
                  <span className="font-semibold">{formatCurrency(message.result.totalCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your New Position:</span>
                  <span className="font-semibold">{message.result.newTotalQty} shares @ avg {formatCurrency(message.result.newAvg)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Investable:</span>
                  <span className="font-semibold">{formatCurrency(message.result.investablePerMonth)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Recovery Time:</span>
                  <span className="font-semibold">{message.result.monthsToRecover.toFixed(1)} months</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Signal:</span>
                  <span className={`font-semibold ${message.result.signal?.includes('BUY') ? 'text-emerald-600' : 'text-amber-600'}`}>{message.result.signal}</span>
                </div>
                {!message.result.canAfford && (
                  <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 p-2 rounded">
                    <AlertCircle className="w-4 h-4" /> This may exceed your monthly investable amount.
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'risk':
        return (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
            {message.analysis && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${message.analysis.score}%`,
                        backgroundColor: message.analysis.score < 30 ? '#10b981' : message.analysis.score < 60 ? '#f59e0b' : '#ef4444'
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold w-12 text-right">{message.analysis.score}/100</span>
                </div>
                <div className="space-y-1">
                  {message.analysis.factors.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {f.type === 'risk' ? <AlertCircle className="w-3 h-3 text-red-500" /> : <CheckCircle className="w-3 h-3 text-emerald-500" />}
                      <span className={f.type === 'risk' ? 'text-red-600' : 'text-emerald-600'}>{f.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'summary':
        return (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
            {message.pnl !== undefined && (
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-background/50 rounded-lg border border-border/50 text-center">
                  <TrendingUp className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Up</p>
                  <p className="text-lg font-bold text-emerald-600">{message.upStocks}</p>
                </div>
                <div className="p-2 bg-background/50 rounded-lg border border-border/50 text-center">
                  <TrendingDown className="w-4 h-4 text-red-500 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Down</p>
                  <p className="text-lg font-bold text-red-500">{message.downStocks}</p>
                </div>
              </div>
            )}
          </div>
        );

      case 'fiftyThirtyTwenty':
        return (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Needs (50%)</span>
                  <span className="font-semibold">{formatCurrency(message.needs)}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '50%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Wants (30%)</span>
                  <span className="font-semibold">{formatCurrency(message.wants)}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full" style={{ width: '30%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Invest (20%)</span>
                  <span className="font-semibold">{formatCurrency(message.invest)}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '20%' }} />
                </div>
              </div>
            </div>
          </div>
        );

      case 'watchlist':
        return (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
            <div className="grid grid-cols-1 gap-2">
              {message.stocks?.map(s => (
                <div key={s.symbol} className="p-3 bg-background/50 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{s.symbol}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.signal?.includes('BUY') ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{s.signal || 'HOLD'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.name}</p>
                  <p className="text-xs italic mt-1">{s.reasoning}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case 'tip':
        return (
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed whitespace-pre-line">{message.content}</div>
          </div>
        );

      case 'health':
        return (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <span className="text-sm">Keep monitoring and rebalancing regularly</span>
            </div>
          </div>
        );

      case 'text':
      default:
        return <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>;
    }
  };

  return (
    <div className="flex items-start gap-2.5">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${message.isBot ? 'bg-primary/10' : 'bg-muted'}`}>
        {message.isBot ? <Bot className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-muted/80 px-4 py-2.5 rounded-2xl rounded-tl-sm border border-border/50">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default function PortfolioChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      type: 'bot',
      isBot: true,
      content: "Hello! I&apos;m your Portfolio Assistant. How can I help you today?",
      responseType: 'text'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const { user } = useAuth();

  const { data: profileData } = useQuery({
    queryKey: ['financial-profile', user?.email],
    queryFn: () => db.entities.FinancialProfile.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: dbStocks } = useQuery({
    queryKey: ['stocks'],
    queryFn: () => db.entities.Stock.list(),
  });

  const { data: trades } = useQuery({
    queryKey: ['trades', user?.email],
    queryFn: () => db.entities.Trade.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: watchlist } = useQuery({
    queryKey: ['watchlist', user?.email],
    queryFn: () => db.entities.Watchlist.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const stocks = dbStocks?.length > 0 ? dbStocks : STOCK_SEED_DATA;
  const profile = profileData?.[0] || null;

  // Build holdings
  const holdingsMap = {};
  (trades || []).forEach(t => {
    if (!holdingsMap[t.stock_symbol]) holdingsMap[t.stock_symbol] = { qty: 0, invested: 0, sector: t.sector };
    if (t.trade_type === 'BUY') { holdingsMap[t.stock_symbol].qty += t.quantity; holdingsMap[t.stock_symbol].invested += t.total_value; }
    else { holdingsMap[t.stock_symbol].qty -= t.quantity; holdingsMap[t.stock_symbol].invested -= t.price * t.quantity; }
  });
  const holdings = Object.entries(holdingsMap)
    .filter(([_, h]) => h.qty > 0)
    .map(([symbol, h]) => {
      const stock = stocks.find(s => s.symbol === symbol);
      const currentVal = (stock?.current_price || 0) * h.qty;
      return { symbol, ...h, currentVal, pnl: currentVal - h.invested, sector: h.sector || stock?.sector };
    });

  const context = { profile, holdings, watchlist: watchlist || [], stocks, trades: trades || [] };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (textOverride) => {
    const text = textOverride || input.trim();
    if (!text) return;
    setInput('');

    setMessages(prev => [...prev, { id: Date.now(), type: 'user', isBot: false, content: text, responseType: 'text' }]);
    setIsTyping(true);

    setTimeout(() => {
      const response = processChatMessage(text, context);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'bot',
        isBot: true,
        content: response.content,
        responseType: response.type || 'text',
        ...response
      }]);
    }, 1200 + Math.random() * 800);
  };

  const quickCommands = [
    'What should I buy?',
    'Explain my portfolio',
    'How risky is my portfolio?',
    'Show me my 50/30/20',
    'Give me a tip',
  ];

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center"
          >
            <Sparkle className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] h-[560px] max-h-[calc(100vh-96px)] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Portfolio Assistant</h3>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-muted-foreground">Online</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Commands */}
            {messages.length <= 2 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {quickCommands.map(cmd => (
                  <button
                    key={cmd}
                    onClick={() => handleSend(cmd)}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 border border-border/50 text-muted-foreground transition-colors"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-border">
              <div className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask me anything..."
                  className="flex-1 h-10 rounded-full text-sm bg-muted border-0 focus-visible:ring-1"
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  size="icon"
                  className="w-10 h-10 rounded-full flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
