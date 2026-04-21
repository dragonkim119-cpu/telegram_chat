import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, Trash2, Wifi, WifiOff, ExternalLink, Newspaper, Hash, TrendingUp, Activity, Wallet, Plus, Lightbulb } from 'lucide-react';

const API_BASE = "/api";
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${protocol}//${window.location.host}/ws`;

function App() {
  const [news, setNews] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [prices, setPrices] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [alertMsg, setAlertMsg] = useState(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [wsStatus, setWsStatus] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [pfSymbol, setPfSymbol] = useState("");
  const [pfPrice, setPfPrice] = useState("");
  const [pfQty, setPfQty] = useState("");
  const [backtestData, setBacktestData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const ws = useRef(null);

  // 트레이딩뷰 차트 로드
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (window.TradingView) {
        new window.TradingView.widget({
          "autosize": true,
          "symbol": "UPBIT:BTCKRW",
          "interval": "60",
          "timezone": "Asia/Seoul",
          "theme": "light",
          "style": "1",
          "locale": "kr",
          "toolbar_bg": "#f1f3f6",
          "enable_publishing": false,
          "allow_symbol_change": true,
          "container_id": "tradingview_widget"
        });
      }
    };
    document.head.appendChild(script);
  }, []);

  // 초기 데이터 로딩
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [newsRes, kwRes, pfRes] = await Promise.all([
          fetch(`${API_BASE}/news`),
          fetch(`${API_BASE}/keywords`),
          fetch(`${API_BASE}/portfolio`)
        ]);
        if (newsRes.ok) setNews(await newsRes.json());
        if (kwRes.ok) setKeywords(await kwRes.json());
        if (pfRes.ok) setPortfolio(await pfRes.json());
      } catch (error) {
        console.error("Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 웹소켓 연결
  useEffect(() => {
    const connectWS = () => {
      ws.current = new WebSocket(WS_URL);
      ws.current.onopen = () => setWsStatus(true);
      ws.current.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "news") setNews(prev => [msg.data, ...prev].slice(0, 100));
        else if (msg.type === "market") setPrices(msg.data);
        else if (msg.type === "alert") {
          setAlertMsg(msg);
          setTimeout(() => setAlertMsg(null), 10000);
        }
      };
      ws.current.onclose = () => {
        setWsStatus(false);
        setTimeout(connectWS, 3000);
      };
    };
    connectWS();
    return () => ws.current?.close();
  }, []);

  const calculatePnL = () => {
    let totalBuy = 0; let totalEval = 0;
    portfolio.forEach(p => {
      const currentPrice = prices.find(pr => pr.market === p.symbol)?.price || 0;
      totalBuy += p.avg_price * parseFloat(p.quantity);
      totalEval += currentPrice * parseFloat(p.quantity);
    });
    const profit = totalEval - totalBuy;
    const rate = totalBuy > 0 ? (profit / totalBuy) * 100 : 0;
    return { totalBuy, totalEval, profit, rate };
  };

  const pnl = calculatePnL();

  const addPortfolio = async (e) => {
    e.preventDefault();
    if (!pfSymbol || !pfPrice || !pfQty) return;
    try {
      const res = await fetch(`${API_BASE}/portfolio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: pfSymbol.toUpperCase(), avg_price: parseInt(pfPrice), quantity: pfQty })
      });
      if (res.ok) {
        const data = await res.json();
        setPortfolio(prev => [...prev.filter(p => p.symbol !== data.symbol), data]);
        setPfSymbol(""); setPfPrice(""); setPfQty("");
      }
    } catch (e) { alert("저장 실패"); }
  };

  const deletePortfolio = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/portfolio/${id}`, { method: 'DELETE' });
      if (res.ok) setPortfolio(prev => prev.filter(p => p.id !== id));
    } catch (e) { alert("삭제 실패"); }
  };

  const runBacktest = async (word) => {
    setIsAnalyzing(true);
    setBacktestData(null);
    try {
      const res = await fetch(`${API_BASE}/backtest/${encodeURIComponent(word)}`);
      if (res.ok) setBacktestData({ ...await res.json(), word });
    } catch (error) { } finally { setIsAnalyzing(false); }
  };

  const addKeyword = async (e) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newKeyword.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setKeywords(prev => [...prev, data]);
        setNewKeyword("");
      }
    } catch (e) { }
  };

  const deleteKeyword = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/keywords/${id}`, { method: 'DELETE' });
      if (res.ok) setKeywords(prev => prev.filter(k => k.id !== id));
    } catch (e) { }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-10">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Bell className="text-blue-600 w-6 h-6 animate-pulse" />
              <h1 className="text-xl font-bold tracking-tight">Coinness Dashboard</h1>
            </div>
            <div className="hidden md:flex items-center gap-6 border-l pl-6 border-slate-100">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold">총 자산</span>
                <span className="text-sm font-bold">₩{pnl.totalEval.toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold">수익률</span>
                <span className={`text-sm font-bold ${pnl.profit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  {pnl.rate.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {prices.map(p => (
                <div key={p.market} className="flex flex-col items-end border-r border-slate-100 pr-3 last:border-0">
                  <span className="text-[9px] font-bold text-slate-400">{p.market}</span>
                  <span className={`text-xs font-mono font-bold ${p.change > 0 ? 'text-red-500' : 'text-blue-500'}`}>{p.price.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className={`w-3 h-3 rounded-full ${wsStatus ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-4 space-y-6">
          {/* 포트폴리오 */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Wallet size={18}/> 포트폴리오</h2>
            <form onSubmit={addPortfolio} className="grid grid-cols-3 gap-2 mb-4">
              <input type="text" placeholder="BTC" value={pfSymbol} onChange={e=>setPfSymbol(e.target.value)} className="p-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"/>
              <input type="number" placeholder="평단" value={pfPrice} onChange={e=>setPfPrice(e.target.value)} className="p-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"/>
              <input type="text" placeholder="수량" value={pfQty} onChange={e=>setPfQty(e.target.value)} className="p-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"/>
              <button type="submit" className="col-span-3 bg-slate-800 text-white py-2 rounded-lg text-xs font-bold hover:bg-slate-700">자산 추가</button>
            </form>
            <div className="space-y-2">
              {portfolio.map(p => {
                const cur = prices.find(pr => pr.market === p.symbol)?.price || 0;
                const prf = p.avg_price > 0 ? ((cur - p.avg_price) / p.avg_price) * 100 : 0;
                return (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                    <div className="text-xs font-bold">{p.symbol} ({p.quantity})</div>
                    <div className="flex items-center gap-3">
                      <div className={`text-xs font-bold ${prf >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{prf.toFixed(2)}%</div>
                      <button onClick={() => deletePortfolio(p.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 키워드 */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Hash size={18}/> Watchlist</h2>
            <form onSubmit={addKeyword} className="mb-4 relative">
              <input type="text" value={newKeyword} onChange={e=>setNewKeyword(e.target.value)} placeholder="키워드..." className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"/>
              <button type="submit" className="absolute right-2 top-2 text-slate-400"><Search size={18}/></button>
            </form>
            <div className="flex flex-wrap gap-2">
              {keywords.map(kw => (
                <div key={kw.id} className="group flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full text-xs hover:bg-blue-100 cursor-pointer transition-all" onClick={() => runBacktest(kw.word)}>
                  {kw.word}
                  <button onClick={(e) => {e.stopPropagation(); deleteKeyword(kw.id)}} className="text-slate-300 hover:text-red-500"><Trash2 size={10}/></button>
                </div>
              ))}
            </div>
          </section>

          {/* 백테스트 리포트 */}
          {(isAnalyzing || backtestData) && (
            <section className="bg-blue-600 text-white p-6 rounded-2xl shadow-lg animate-in slide-in-from-bottom-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm uppercase">Backtest: {backtestData?.word}</h3>
                {isAnalyzing && <Activity size={16} className="animate-spin"/>}
              </div>
              {backtestData && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 p-3 rounded-xl text-center">
                    <div className="text-[9px] opacity-60">승률</div>
                    <div className="text-xl font-bold">{backtestData.win_rate}%</div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl text-center">
                    <div className="text-[9px] opacity-60">평균 수익률</div>
                    <div className="text-xl font-bold">{backtestData.avg_profit}%</div>
                  </div>
                </div>
              )}
            </section>
          )}

          <button onClick={async () => fetch(`${API_BASE}/test-telegram`, {method:'POST'})} className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold py-3 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95">
            <Bell size={16} className="fill-current" /> 텔레그램 테스트
          </button>
        </aside>

        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden h-[500px] relative">
            <div id="tradingview_widget" className="w-full h-full" />
          </section>

          <div className="space-y-4">
            {news.map((item, idx) => (
              <article key={item.id || idx} className={`bg-white p-6 rounded-2xl border transition-all hover:shadow-md ${item.matched_keywords ? 'border-blue-200 bg-blue-50/20' : 'border-slate-100 shadow-sm'}`}>
                <div className="flex gap-2 mb-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.ai_sentiment === '호재' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>{item.ai_sentiment}</span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-3">{item.title}</h3>
                <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl mb-3 italic">{item.ai_summary}</p>
                {item.ai_strategy && (
                  <div className="bg-amber-50 p-4 rounded-xl border-l-4 border-amber-400 text-sm font-bold text-amber-900 flex gap-2">
                    <Lightbulb size={18} className="shrink-0 text-amber-600" />
                    {item.ai_strategy}
                  </div>
                )}
                <div className="mt-4 text-[11px] text-slate-400 flex justify-between border-t pt-3">
                  <span>{new Date(item.created_at).toLocaleString()}</span>
                  <a href="https://coinness.com/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">코인니스 원문</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
