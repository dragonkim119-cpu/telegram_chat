import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, Trash2, Wifi, WifiOff, ExternalLink, Newspaper, Hash, TrendingUp, Activity, Wallet, Plus, TrendingDown, Lightbulb } from 'lucide-react';

// [중요] 배포 환경을 위한 절대 주소 설정
// Vercel 환경 변수에 VITE_BACKEND_URL이 등록되어 있어야 합니다.
const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
const API_BASE = backendUrl ? `${backendUrl}/api` : "/api";

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

  // 1. TradingView 차트 초기화 (안정성 강화)
  useEffect(() => {
    const initChart = () => {
      if (window.TradingView && document.getElementById('tradingview_widget')) {
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

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = initChart;
    document.head.appendChild(script);
  }, []);

  // 2. 초기 데이터 로딩
  useEffect(() => {
    const fetchData = async () => {
      if (!backendUrl && window.location.hostname !== 'localhost') {
        console.error("VITE_BACKEND_URL이 설정되지 않았습니다!");
      }
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

  // 3. 웹소켓 연결 (배포 주소 대응)
  useEffect(() => {
    const connectWS = () => {
      const wsHost = backendUrl ? backendUrl.replace('http', 'ws') : `ws://${window.location.host}`;
      const WS_URL = `${wsHost}/ws`;
      
      console.log("WebSocket 연결 시도:", WS_URL);
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
        setTimeout(connectWS, 5000); // 서버가 잠든 경우 대비해 재연결 간격 늘림
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
    } catch (e) { alert("연결 실패. 백엔드 주소를 확인하세요."); }
  };

  const runBacktest = async (word) => {
    setIsAnalyzing(true); setBacktestData(null);
    try {
      const res = await fetch(`${API_BASE}/backtest/${encodeURIComponent(word)}`);
      if (res.ok) setBacktestData({ ...await res.json(), word });
      else alert("데이터 부족");
    } catch (e) { alert("서버 응답 없음"); }
    finally { setIsAnalyzing(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500"></div>
        <p className="animate-pulse">서버를 깨우는 중입니다... (최대 1분 소요)</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Coinness Pro</h1>
            <div className="hidden lg:flex items-center gap-6 border-l pl-6 border-slate-100">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Net Worth</span>
                <span className="text-sm font-black">₩{pnl.totalEval.toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Profit/Loss</span>
                <span className={`text-sm font-black ${pnl.profit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  {pnl.profit >= 0 ? '+' : ''}{pnl.profit.toLocaleString()} ({pnl.rate.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {prices.slice(0, 3).map(p => (
                <div key={p.market} className="flex flex-col items-end">
                  <span className="text-[9px] font-black text-slate-400">{p.market}</span>
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
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-blue-600"><Wallet size={20}/> Assets</h2>
            <form onSubmit={addPortfolio} className="grid grid-cols-3 gap-2 mb-6">
              <input type="text" placeholder="BTC" value={pfSymbol} onChange={e=>setPfSymbol(e.target.value)} className="col-span-1 p-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"/>
              <input type="number" placeholder="평단" value={pfPrice} onChange={e=>setPfPrice(e.target.value)} className="col-span-1 p-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"/>
              <input type="text" placeholder="수량" value={pfQty} onChange={e=>setPfQty(e.target.value)} className="col-span-1 p-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"/>
              <button type="submit" className="col-span-3 bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-blue-600 transition-colors">UPDATE PORTFOLIO</button>
            </form>
            <div className="space-y-2">
              {portfolio.map(p => {
                const cur = prices.find(pr => pr.market === p.symbol)?.price || 0;
                const prf = p.avg_price > 0 ? ((cur - p.avg_price) / p.avg_price) * 100 : 0;
                return (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <div className="text-xs font-bold">{p.symbol} <span className="text-slate-400 font-normal">({p.quantity})</span></div>
                    <div className={`text-xs font-black ${prf >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{prf.toFixed(2)}%</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 데이터 생성 버튼 (Seed) */}
          <button 
            onClick={async () => {
              try {
                const res = await fetch(`${API_BASE}/seed`, { method: 'POST' });
                if (res.ok) { alert("서버 데이터 생성 완료!"); window.location.reload(); }
                else alert("서버 연결 실패. URL 설정을 확인하세요.");
              } catch (e) { alert("서버에 도달할 수 없습니다."); }
            }}
            className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 font-black py-4 rounded-3xl text-xs tracking-widest transition-all"
          >
            🔄 SYNC & SEED SERVER DATA
          </button>
        </aside>

        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white rounded-[2rem] border shadow-xl overflow-hidden h-[400px] lg:h-[500px] relative">
            <div id="tradingview_widget" className="w-full h-full" />
          </section>

          <div className="space-y-6">
            {news.map((item, idx) => (
              <article key={item.id || idx} className="bg-white p-8 rounded-[2rem] border shadow-sm transition-all hover:shadow-xl">
                <div className="flex gap-2 mb-4">
                  <span className={`text-[9px] font-black px-3 py-1 rounded-lg ${item.ai_sentiment === '호재' ? 'bg-green-500 text-white' : 'bg-slate-200'}`}>{item.ai_sentiment}</span>
                </div>
                <h3 className="font-black text-xl mb-4">{item.title}</h3>
                <div className="bg-slate-50 p-5 rounded-2xl border-l-4 border-blue-500 mb-4 text-sm leading-relaxed text-slate-600">{item.ai_summary}</div>
                {item.ai_strategy && (
                  <div className="bg-amber-50 p-5 rounded-2xl border-l-4 border-amber-400 text-sm font-bold text-amber-900 shadow-sm flex gap-3">
                    <Lightbulb size={20} className="shrink-0 text-amber-600" />
                    {item.ai_strategy}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
