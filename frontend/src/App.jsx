import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, Trash2, Wifi, WifiOff, ExternalLink, Newspaper, Hash, TrendingUp, Activity, Wallet, Plus, TrendingDown, Lightbulb } from 'lucide-react';

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
  
  // 포트폴리오 입력 상태
  const [pfSymbol, setPfSymbol] = useState("");
  const [pfPrice, setPfPrice] = useState("");
  const [pfQty, setPfQty] = useState("");

  // 백테스팅 관련 상태
  const [backtestData, setBacktestData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const ws = useRef(null);

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

  // 수익률 계산 로직
  const calculatePnL = () => {
    let totalBuy = 0;
    let totalEval = 0;

    portfolio.forEach(p => {
      const currentPrice = prices.find(pr => pr.market === p.symbol)?.price || 0;
      const buyAmt = p.avg_price * parseFloat(p.quantity);
      const evalAmt = currentPrice * parseFloat(p.quantity);
      totalBuy += buyAmt;
      totalEval += evalAmt;
    });

    const profit = totalEval - totalBuy;
    const rate = totalBuy > 0 ? (profit / totalBuy) * 100 : 0;

    return { totalBuy, totalEval, profit, rate };
  };

  const pnl = calculatePnL();

  // 포트폴리오 관리 함수
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
        setPortfolio(prev => {
          const filtered = prev.filter(p => p.symbol !== data.symbol);
          return [...filtered, data];
        });
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
      if (res.ok) {
        const data = await res.json();
        setBacktestData({ ...data, word });
      }
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-slate-400 text-sm animate-pulse">개인 맞춤형 대시보드 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* 상단 헤더: 자산 요약 포함 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Bell className="text-blue-600 w-6 h-6 animate-pulse" />
              <h1 className="text-xl font-black tracking-tighter text-slate-900 uppercase">Coinness Pro</h1>
            </div>
            
            {/* 자산 요약 Ticker */}
            <div className="hidden lg:flex items-center gap-6 border-l border-slate-100 pl-6">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Estimated Assets</span>
                <span className="text-sm font-black text-slate-800">₩{pnl.totalEval.toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Net Profit</span>
                <span className={`text-sm font-black ${pnl.profit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  {pnl.profit >= 0 ? '+' : ''}{pnl.profit.toLocaleString()} ({pnl.rate.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {prices.map(p => (
               <div key={p.market} className="flex flex-col items-end border-r border-slate-100 pr-4 last:border-0">
                 <div className="flex items-center gap-1">
                   <span className="text-[9px] font-black text-slate-400">{p.market}</span>
                   {p.kp !== undefined && (
                     <span className={`text-[8px] font-bold px-1 rounded ${p.kp > 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                       {p.kp > 0 ? '+' : ''}{p.kp}%
                     </span>
                   )}
                 </div>
                 <span className={`text-xs font-mono font-bold ${p.change > 0 ? 'text-red-500' : p.change < 0 ? 'text-blue-500' : 'text-slate-700'}`}>
                   {p.price.toLocaleString()}
                 </span>
               </div>
             ))}

            <div className={`w-3 h-3 rounded-full ${wsStatus ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 왼쪽 사이드바 (4컬럼): 자산 관리 & 키워드 */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* 포트폴리오 관리 */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Wallet size={20} className="text-blue-500"/> Portfolio</h2>
            <form onSubmit={addPortfolio} className="grid grid-cols-3 gap-2 mb-6">
              <input type="text" placeholder="BTC" value={pfSymbol} onChange={e=>setPfSymbol(e.target.value)} className="col-span-1 px-2 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"/>
              <input type="number" placeholder="평단가" value={pfPrice} onChange={e=>setPfPrice(e.target.value)} className="col-span-1 px-2 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"/>
              <input type="text" placeholder="수량" value={pfQty} onChange={e=>setPfQty(e.target.value)} className="col-span-1 px-2 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"/>
              <button type="submit" className="col-span-3 bg-slate-900 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors">
                <Plus size={14}/> 보유 자산 추가/수정
              </button>
            </form>

            <div className="space-y-2">
              {portfolio.map(p => {
                const cur = prices.find(pr => pr.market === p.symbol)?.price || 0;
                const prf = ((cur - p.avg_price) / p.avg_price) * 100;
                return (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <div>
                      <div className="text-xs font-black text-slate-800">{p.symbol} <span className="text-[10px] text-slate-400 font-normal">({p.quantity}개)</span></div>
                      <div className="text-[10px] text-slate-500">평단: {p.avg_price.toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div className={`text-xs font-bold ${prf >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {prf.toFixed(2)}%
                      </div>
                      <button onClick={() => deletePortfolio(p.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 키워드 및 백테스팅 */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Hash size={20} className="text-slate-400"/> Watchlist</h2>
            <form onSubmit={addKeyword} className="mb-4 relative">
              <input type="text" value={newKeyword} onChange={e=>setNewKeyword(e.target.value)} placeholder="키워드..." className="w-full px-4 py-2 border rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500"/>
              <button type="submit" className="absolute right-3 top-2.5 text-slate-400"><Search size={18}/></button>
            </form>
            <div className="flex flex-wrap gap-2">
              {keywords.map(kw => (
                <div key={kw.id} className="group flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full text-xs hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-all border border-slate-100" onClick={() => runBacktest(kw.word)}>
                  {kw.word}
                  <button onClick={(e) => {e.stopPropagation(); deleteKeyword(kw.id)}} className="text-slate-300 hover:text-red-500"><Trash2 size={10}/></button>
                </div>
              ))}
            </div>
          </section>

          {/* 백테스팅 리포트 */}
          {(isAnalyzing || backtestData) && (
            <section className="bg-blue-600 text-white p-6 rounded-3xl shadow-xl animate-in slide-in-from-left-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black uppercase text-sm tracking-widest">Backtest: {backtestData?.word}</h3>
                {isAnalyzing && <Activity size={16} className="animate-spin"/>}
              </div>
              {backtestData && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 p-3 rounded-2xl">
                    <div className="text-[9px] font-bold opacity-60 uppercase">Win Rate</div>
                    <div className="text-xl font-black">{backtestData.win_rate}%</div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-2xl">
                    <div className="text-[9px] font-bold opacity-60 uppercase">Avg Profit</div>
                    <div className="text-xl font-black">{backtestData.avg_profit}%</div>
                  </div>
                </div>
              )}
            </section>
          )}

          <button onClick={async () => fetch(`${API_BASE}/test-telegram`, {method:'POST'})} className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black py-4 rounded-3xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 uppercase text-xs tracking-widest">
            <Bell size={16} className="fill-current" /> Test Alert
          </button>
        </div>

        {/* 메인 뉴스 피드 (8컬럼) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* TradingView 차트 섹션 */}
          <section className="bg-white p-2 rounded-[2rem] border-2 border-slate-100 shadow-xl overflow-hidden h-[500px] relative">
            <div id="tradingview_widget" className="w-full h-full" />
            <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-200 text-[10px] font-black z-10">
              REAL-TIME CHART (UPBIT:BTCKRW)
            </div>
          </section>

          <div className="flex items-center justify-between">
            <h2 className="font-black text-2xl text-slate-900 tracking-tighter uppercase flex items-center gap-3">
              <Activity className="text-blue-600" /> Intelligence Feed
            </h2>
          </div>

          <div className="space-y-6">
            {news.map((item, idx) => (
              <article key={item.id || idx} className={`bg-white p-8 rounded-[2rem] border-2 transition-all hover:border-blue-400 hover:shadow-2xl ${item.matched_keywords ? 'border-blue-100 bg-blue-50/10' : 'border-slate-100 shadow-sm'}`}>
                <div className="flex flex-wrap gap-2 mb-4">
                  {item.matched_keywords && item.matched_keywords.split(', ').map(k => (
                    <span key={k} className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-lg shadow-sm">#{k}</span>
                  ))}
                  <span className={`text-[10px] font-black px-3 py-1 rounded-lg shadow-sm uppercase ${
                    item.ai_sentiment === '호재' ? 'bg-green-500 text-white' : 
                    item.ai_sentiment === '악재' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {item.ai_sentiment}
                  </span>
                </div>
                
                <h3 className="font-black text-xl text-slate-900 leading-tight mb-4">{item.title}</h3>
                
                <div className="space-y-4">
                  <div className="bg-slate-50 p-5 rounded-2xl border-l-4 border-slate-200">
                    <div className="text-[10px] font-black text-slate-400 uppercase mb-2">AI Summary</div>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{item.ai_summary}</p>
                  </div>

                  {/* AI 맞춤 전략 섹션 (중요!) */}
                  {item.ai_strategy && (
                    <div className="bg-amber-50 p-5 rounded-2xl border-l-4 border-amber-400 shadow-sm">
                      <div className="flex items-center gap-2 text-amber-700 text-[10px] font-black uppercase mb-2">
                        <Lightbulb size={14} /> My Portfolio Strategy
                      </div>
                      <p className="text-sm text-amber-900 font-bold leading-relaxed">{item.ai_strategy}</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center text-[10px] font-bold text-slate-400">
                  <span className="flex items-center gap-1 uppercase"><Activity size={12}/> {new Date(item.created_at).toLocaleString()}</span>
                  <a href="https://coinness.com/" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-widest">
                    Source Link <ExternalLink size={14} />
                  </a>
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
