from database import SessionLocal
from models import News, Portfolio
from datetime import datetime, timedelta
import random

def seed_ultimate_data():
    db = SessionLocal()
    
    # 데이터 소스 소스
    coins = ["비트코인", "이더리움", "리플", "솔라나", "도지코인", "에이다", "아발란체", "폴카닷", "체인링크", "매틱"]
    symbols = ["BTC", "ETH", "XRP", "SOL", "DOGE", "ADA", "AVAX", "DOT", "LINK", "MATIC"]
    
    actions = ["폭등", "급락", "상장 소식", "업그레이드", "파트너십", "ETF 승인", "해킹 루머", "금리 인상", "기관 매집", "도미넌스 하락"]
    
    contexts = [
        "미국 SEC와의 소송에서 결정적 증거 확보",
        "바이낸스 신규 현물 마켓 추가 발표",
        "구글 클라우드와의 대규모 기술 협력 체결",
        "연준(Fed) 의장의 매파적 발언에 시장 위축",
        "활성 지갑 주소 수가 역대 최고치 경신",
        "주요 저항선인 $000 돌파 시도 중",
        "고래 계좌에서 거래소로 5,000억원 상당 이동",
        "현물 ETF 자금 유입이 10일 연속 순유입 기록",
        "신규 레이어2 솔루션 메인넷 런칭 일정 공개",
        "인플레이션 우려 완화로 위험자산 선호 심리 회복"
    ]

    # 현재 포트폴리오 정보 가져오기 (전략 생성을 위함)
    portfolio = db.query(Portfolio).all()
    p_symbols = [p.symbol for p in portfolio]

    print(f"🚀 100개의 고퀄리티 가짜 뉴스를 생성 중입니다...")

    try:
        for i in range(100):
            coin = random.choice(coins)
            symbol = symbols[coins.index(coin)]
            action = random.choice(actions)
            context = random.choice(contexts)
            
            # 제목 조합
            title = f"[{action}] {coin}({symbol}), {context}"
            if i % 7 == 0:
                title = f"속보: {coin} 관련 {random.randint(10, 50)}% 변동성 주의보… {context}"

            # 최근 30일간의 랜덤 시점 (백테스팅을 위해 골고루 분산)
            past_time = datetime.now() - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23), minutes=random.randint(0, 59))
            
            # 키워드 추출
            keywords = [k for k in ["비트코인", "BTC", "리플", "XRP", "이더리움", "ETH", "급등", "속보", "승인"] if k in title]
            
            # AI 분석 결과 시뮬레이션
            sentiment = random.choice(["호재", "악재", "중립"])
            
            # 내 포트폴리오에 있는 코인이라면 맞춤 전략 생성
            strategy = None
            if symbol in p_symbols or coin in [mapping.get(s, "") for s in p_symbols]:
                strategy = f"보유 중인 {symbol} 자산에 직접적인 영향이 예상됩니다. {sentiment} 성격이 강하므로 비중 조절을 검토하세요."
            elif sentiment == "호재":
                strategy = f"현재 포트폴리오에 없는 {symbol}의 강세가 예상됩니다. 단기 진입을 고려해볼 만한 지점입니다."

            new_news = News(
                title=title,
                matched_keywords=", ".join(keywords) if keywords else None,
                ai_summary=f"해당 뉴스는 {coin}의 {action}와 관련된 소식으로, {context} 상황을 반영하고 있습니다.",
                ai_sentiment=sentiment,
                ai_impact=random.choice(["단기 급등 예상", "장기 하락 우려", "추세 전환 기로", "영향 제한적"]),
                ai_strategy=strategy,
                created_at=past_time
            )
            db.add(new_news)
        
        db.commit()
        print(f"✅ 생성 완료! 총 100개의 카드가 대시보드에 추가되었습니다.")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 에러 발생: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # 약어 맵핑용 딕셔너리
    mapping = {"BTC": "비트코인", "ETH": "이더리움", "XRP": "리플"}
    seed_ultimate_data()
