from database import SessionLocal
from models import News
from datetime import datetime, timedelta
import random

def seed_test_data():
    db = SessionLocal()
    
    # 테스트용 뉴스 제목 (키워드 포함)
    titles = [
        "비트코인, 현물 ETF 승인 가능성에 5% 급등",
        "리플(XRP), SEC 소송 승소 소식에 시장 주목",
        "이더리움, 상하이 업그레이드 성공적으로 완료",
        "속보: 바이낸스, 새로운 김치코인 상장 발표",
        "비트코인 하락세 진정… 기관 매수세 유입 중",
        "이더리움 현물 ETF 승인 결정 오늘 밤 발표",
        "리플, 글로벌 결제 파트너십 확대 발표",
        "속보: 미국 금리 동결 발표에 비트코인 반등",
        "급등 소식: 특정 알트코인 고래 매집 정황 포착",
        "비트코인 도미넌스 상승… 알트코인 순환매 장세"
    ]
    
    now = datetime.now()
    
    print(f"🚀 {len(titles)}개의 테스트 데이터를 생성합니다...")
    
    try:
        for i, title in enumerate(titles):
            # 과거 시점 설정 (어제부터 오늘 오전까지 흩어지게 배치)
            # 업비트 API 조회를 위해 1시간 이상의 과거 시간으로 설정
            past_time = now - timedelta(hours=random.randint(2, 48))
            
            # 키워드 매칭 (간단하게 추출)
            keywords = []
            for k in ["비트코인", "리플", "이더리움", "급등", "속보", "승인"]:
                if k in title:
                    keywords.append(k)
            
            new_news = News(
                title=title,
                matched_keywords=", ".join(keywords) if keywords else None,
                ai_summary="테스트용 자동 생성 요약문입니다. 시장 변동성에 주의하세요.",
                ai_sentiment="호재" if i % 2 == 0 else "중립",
                ai_impact="단기 변동 가능성 높음",
                created_at=past_time
            )
            db.add(new_news)
        
        db.commit()
        print("✅ 데이터 생성 완료! 이제 대시보드에서 키워드를 클릭해 보세요.")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 에러 발생: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_test_data()
