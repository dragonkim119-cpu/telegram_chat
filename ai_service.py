import os
import json
import logging
from google import genai
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Gemini API 설정 (최신 google-genai SDK 사용)
api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    client = genai.Client(api_key=api_key)
else:
    logger.warning("⚠️ GOOGLE_API_KEY가 설정되지 않았습니다. AI 기능을 사용할 수 없습니다.")
    client = None

class AIService:
    @staticmethod
    def analyze_news(title: str, portfolio_info: str = "보유 자산 없음"):
        if not client:
            return None
        
        prompt = f"""
        당신은 10년 경력의 가상자산 전문 투자 분석가입니다. 
        사용자의 포트폴리오 현황을 바탕으로 다음 뉴스가 자산에 미칠 영향과 대응 전략을 분석하세요.
        
        [사용자 포트폴리오 현황]
        {portfolio_info}
        
        [뉴스 제목]
        {title}
        
        결과는 반드시 아래의 JSON 형식으로만 응답하세요.
        {{
            "summary": "뉴스 내용을 1문장으로 핵심만 요약",
            "sentiment": "호재, 악재, 중립 중 하나 선택",
            "impact": "해당 뉴스가 코인 가격에 미칠 영향",
            "strategy": "사용자의 포트폴리오에 맞춘 구체적 대응 조언 (예: 보유 유지, 분할 매도 등)"
        }}
        """
        
        try:
            # 최신 SDK 방식: 최신 모델인 gemini-2.0-flash로 변경
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config={
                    'response_mime_type': 'application/json',
                }
            )
            
            # JSON 텍스트 파싱
            result = json.loads(response.text)
            logger.info(f"✅ AI 분석 완료 (신규 SDK): {result.get('sentiment')}")
            return result
        except Exception as e:
            logger.error(f"❌ AI 분석 에러 (신규 SDK): {e}")
            return {
                "summary": "분석 중 오류가 발생했습니다.",
                "sentiment": "중립",
                "impact": "분석 불가"
            }
