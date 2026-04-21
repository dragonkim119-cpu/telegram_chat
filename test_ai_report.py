import os
import asyncio
from database import SessionLocal
from models import News, Keyword, Portfolio
from ai_service import AIService
from crawler_service import CoinnessCrawler
from dotenv import load_dotenv

load_dotenv()

async def test_high_end_report():
    print("🎯 [고도화 리포트 테스트]를 시작합니다...")
    db = SessionLocal()
    
    # 1. 가상의 속보 제목 설정
    test_title = "속보: 비트코인 현물 ETF 역대급 자금 유입… 전고점 돌파 임박"
    print(f"📢 테스트 뉴스 제목: {test_title}")

    # 2. 포트폴리오 정보 가져오기 (전략 생성을 위함)
    portfolio = db.query(Portfolio).all()
    p_info = ", ".join([f"{p.symbol}(평단:{p.avg_price}, 수량:{p.quantity})" for p in portfolio]) if portfolio else "보유 자산 없음"
    print(f"💼 현재 내 포트폴리오 상황: {p_info}")

    # 3. AI 분석 수행 (요약, 감성, 맞춤 전략 생성)
    print("🤖 AI 분석 중 (Gemini)...")
    ai_result = AIService.analyze_news(test_title, portfolio_info=p_info)
    
    if ai_result:
        # 4. 메시지 구성 (crawler_service.py의 로직과 동일)
        s_emoji = "📈" if ai_result["sentiment"] == "호재" else "📉" if ai_result["sentiment"] == "악재" else "⚖️"
        
        msg = (
            f"🔔 *[테스트] 관련 속보 발견*\n\n"
            f"📢 *제목:* {test_title}\n\n"
            f"🤖 *AI 요약*\n_{ai_result['summary']}_\n\n"
            f"{s_emoji} *시장 분석:* {ai_result['sentiment']} ({ai_result['impact']})\n"
        )
        
        if ai_result.get("strategy"):
            msg += f"\n💡 *맞춤 투자 전략*\n`{ai_result['strategy']}`\n"
        
        msg += f"\n🔗 [코인니스에서 보기](https://coinness.com/)"

        # 5. 텔레그램 전송
        print("📤 텔레그램으로 리포트 발송 중...")
        success = CoinnessCrawler.send_telegram_static(msg)
        
        if success:
            print("✅ 테스트 성공! 텔레그램 앱을 확인해 보세요.")
        else:
            print("❌ 전송 실패. .env 설정을 확인하세요.")
    else:
        print("❌ AI 분석 실패.")
    
    db.close()

if __name__ == "__main__":
    asyncio.run(test_high_end_report())
