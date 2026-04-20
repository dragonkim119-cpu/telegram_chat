from database import SessionLocal
from models import News
from datetime import datetime, timedelta
import random

def seed_large_data():
    db = SessionLocal()
    
    # 다양한 뉴스 템플릿 및 키워드
    coins = ["비트코인", "BTC", "이더리움", "ETH", "리플", "XRP", "솔라나", "도지코인"]
    actions = ["급등", "폭등", "급락", "상장", "승인", "발표", "전망", "주의보"]
    topics = [
        "미국 FOMC 금리 결정 발표", "SEC 위원장 사임 소문", "고래들의 대규모 이동 포착",
        "현물 ETF 자금 유입 가속화", "기술적 반등 구간 진입", "주요 저항선 돌파 성공",
        "네트워크 업그레이드 일정 공개", "기관 투자자 매수 리포트 발행", "해킹 피해 사실 무근 판명",
        "중국 자본 유입 가능성 제기", "인플레이션 수치 예상치 하회", "채굴 난이도 역대 최고치"
    ]

    now = datetime.now()
    print(f"🚀 40개의 고도화된 테스트 데이터를 생성합니다...")

    try:
        for i in range(40):
            coin = random.choice(coins)
            topic = random.choice(topics)
            action = random.choice(actions)
            
            # 뉴스 제목 조합
            title = f"[{action}] {coin}, {topic} 속보"
            if i % 5 == 0:
                title = f"속보: {coin} {random.randint(5, 20)}% 변동성 확대… {topic}"

            # 최근 7일간의 랜덤 시점
            past_time = now - timedelta(days=random.randint(0, 7), hours=random.randint(0, 23))
            
            # 키워드 매칭
            keywords = [k for k in ["비트코인", "BTC", "리플", "XRP", "이더리움", "ETH", "급등", "속보", "승인"] if k in title]
            
            new_news = News(
                title=title,
                matched_keywords=", ".join(keywords) if keywords else None,
                ai_summary=f"AI 분석 결과: {coin} 관련 {topic} 소식으로 시장의 변동성이 예상됩니다.",
                ai_sentiment=random.choice(["호재", "악재", "중립"]),
                ai_impact=random.choice(["단기 급등", "단기 하락", "중기 관망"]),
                created_at=past_time
            )
            db.add(new_news)
        
        db.commit()
        print(f"✅ 총 40개의 데이터가 추가되었습니다. 전체 DB를 확인해 보세요.")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 에러 발생: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_large_data()
