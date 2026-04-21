import time
import threading
import logging
import requests
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MarketService:
    def __init__(self, broadcast_callback=None, telegram_callback=None):
        self.broadcast_callback = broadcast_callback
        self.telegram_callback = telegram_callback
        self.stop_event = threading.Event()
        self.thread = None
        
        self.markets = ["KRW-BTC", "KRW-ETH", "KRW-XRP"]
        self.binance_symbols = ["BTCUSDT", "ETHUSDT", "XRPUSDT"]
        
        self.price_history = {m: [] for m in self.markets}
        self.last_prices = {m: 0 for m in self.markets}
        self.last_alert_time = {m: datetime.min for m in self.markets}
        self.last_kp_alert_time = datetime.min # 김프 알림 중복 방지

    def fetch_prices(self):
        url = f"https://api.upbit.com/v1/ticker?markets={','.join(self.markets)}"
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            logger.error(f"❌ Market: 시세 조회 에러: {e}")
        return None

    def fetch_exchange_rate(self):
        """실시간 USD/KRW 환율 가져오기"""
        try:
            # 간단하고 무료인 환율 API 사용
            res = requests.get("https://api.exchangerate-api.com/v4/latest/USD", timeout=5)
            if res.status_code == 200:
                return res.json()['rates']['KRW']
        except:
            return 1450 # 실패 시 기본 환율 (최근 추세 반영)
        return 1450

    def check_volatility(self, market, current_price):
        """시세 급등락 감지 로직"""
        now = datetime.now()
        five_mins_ago = now - timedelta(minutes=5)
        
        # 이력 관리
        self.price_history[market] = [p for p in self.price_history[market] if p[0] > five_mins_ago]
        
        if self.price_history[market]:
            oldest_price = self.price_history[market][0][1]
            change_rate = ((current_price - oldest_price) / oldest_price) * 100
            
            # 3% 이상 변동 시 알림
            if abs(change_rate) >= 3.0 and (now - self.last_alert_time[market]).total_seconds() > 300:
                direction = "🚀 급등" if change_rate > 0 else "📉 급락"
                msg = f"⚠️ [시세 주의보] {market.split('-')[1]} {direction} 중! ({change_rate:+.2f}% / 5분 대비)"
                
                if self.telegram_callback:
                    self.telegram_callback(msg)
                
                if self.broadcast_callback:
                    self.broadcast_callback({
                        "type": "alert",
                        "market": market,
                        "change_rate": round(change_rate, 2),
                        "price": current_price
                    })
                
                self.last_alert_time[market] = now
                logger.info(f"🔔 Market Alert: {msg}")

        self.price_history[market].append((now, current_price))

    def fetch_binance_prices(self):
        """바이낸스 실시간 시세 가져오기"""
        prices = {}
        try:
            res = requests.get("https://api.binance.com/api/v3/ticker/price", timeout=5)
            if res.status_code == 200:
                data = res.json()
                for item in data:
                    if item['symbol'] in self.binance_symbols:
                        prices[item['symbol']] = float(item['price'])
        except Exception as e:
            logger.error(f"❌ Market: 바이낸스 조회 에러: {e}")
        return prices

    def check_kp_alert(self, kp_avg):
        """김프 수치에 따른 위험 알림"""
        now = datetime.now()
        if (now - self.last_kp_alert_time).total_seconds() < 1800: # 30분에 한 번만 알림
            return

        msg = None
        if kp_avg >= 0.3:
            msg = f"🔥 [김프 과열 주의] 현재 평균 김치 프리미엄이 {kp_avg:.2f}%로 매우 높습니다. 시장 과열에 주의하세요!"
        elif kp_avg <= 0.0:
            msg = f"❄️ [역프 발생 알림] 현재 평균 김치 프리미엄이 {kp_avg:.2f}%(역프)입니다. 해외 대비 국내 시세가 저렴합니다."

        if msg:
            if self.telegram_callback:
                self.telegram_callback(msg)
            self.last_kp_alert_time = now
            logger.info(f"🔔 KP Alert: {msg}")

    def run(self):
        logger.info("📈 Market: 시세 및 김프 모니터링 루프 시작")
        while not self.stop_event.is_set():
            upbit_data = self.fetch_prices()
            binance_data = self.fetch_binance_prices()
            exch_rate = self.fetch_exchange_rate()
            
            if upbit_data and binance_data:
                prices_to_broadcast = []
                kp_list = []

                for item in upbit_data:
                    m = item['market']
                    symbol = m.split('-')[1]
                    u_price = item['trade_price']
                    
                    # 김프 계산
                    b_symbol = f"{symbol}USDT"
                    kp = 0
                    if b_symbol in binance_data:
                        b_price_krw = binance_data[b_symbol] * exch_rate
                        kp = ((u_price - b_price_krw) / b_price_krw) * 100
                        kp_list.append(kp)

                    self.check_volatility(m, u_price)
                    
                    prices_to_broadcast.append({
                        "market": symbol,
                        "price": u_price,
                        "change": round(item['signed_change_rate'] * 100, 2),
                        "kp": round(kp, 2)
                    })
                
                # 평균 김프 알림 체크
                if kp_list:
                    self.check_kp_alert(sum(kp_list) / len(kp_list))

                if self.broadcast_callback:
                    self.broadcast_callback({
                        "type": "market",
                        "data": prices_to_broadcast,
                        "exch_rate": exch_rate
                    })
            
            time.sleep(2)

    def start(self):
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join()
