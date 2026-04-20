import requests
import time
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BacktestService:
    @staticmethod
    def get_historical_price(market: str, target_time: datetime):
        """특정 시점의 분봉 데이터를 가져와 당시 가격 반환"""
        # 업비트 API는 ISO8601 형식을 사용 (KST 기준)
        to_time = target_time.strftime("%Y-%m-%dT%H:%M:%S")
        url = f"https://api.upbit.com/v1/candles/minutes/1?market={market}&to={to_time}&count=1"
        
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data:
                    return data[0]['trade_price']
        except Exception as e:
            logger.error(f"❌ Backtest: 시세 조회 에러 ({market}): {e}")
        return None

    @classmethod
    def analyze_keyword_impact(cls, news_list, market="KRW-BTC"):
        """뉴스 리스트를 바탕으로 특정 마켓의 수익률 분석"""
        results = []
        
        for news in news_list:
            entry_time = news.created_at
            exit_time = entry_time + timedelta(hours=1) # 1시간 뒤 수익률 기준
            
            entry_price = cls.get_historical_price(market, entry_time)
            # API 호출 제한 방지
            time.sleep(0.1) 
            exit_price = cls.get_historical_price(market, exit_time)
            
            if entry_price and exit_price:
                profit = ((exit_price - entry_price) / entry_price) * 100
                results.append({
                    "title": news.title,
                    "time": entry_time.isoformat(),
                    "profit": round(profit, 2)
                })
        
        if not results:
            return None
            
        # 통계 계산
        profits = [r['profit'] for r in results]
        avg_profit = sum(profits) / len(profits)
        win_rate = len([p for p in profits if p > 0]) / len(profits) * 100
        
        return {
            "keyword_count": len(results),
            "avg_profit": round(avg_profit, 2),
            "max_profit": round(max(profits), 2),
            "win_rate": round(win_rate, 1),
            "details": results[:5] # 최근 5개 사례만 전달
        }
