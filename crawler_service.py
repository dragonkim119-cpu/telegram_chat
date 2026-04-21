import time
import threading
import logging
import os
from datetime import datetime
from dotenv import load_dotenv
import requests

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import undetected_chromedriver as uc

from database import SessionLocal
from models import News, Keyword, Portfolio
from ai_service import AIService

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CoinnessCrawler:
    def __init__(self, broadcast_callback=None):
        self.broadcast_callback = broadcast_callback
        self.stop_event = threading.Event()
        self.thread = None
        
        self.TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
        self.CHAT_ID = os.getenv("CHAT_ID")
        self.COINNESS_URL = os.getenv("COINNESS_URL", "https://coinness.com/")
        
        self.options = self._setup_options()
        self.driver = None

    def _setup_options(self):
        options = Options()
        # 서버 환경 필수 설정 (Linux/Docker 대응)
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        # .env 파일에서 HEADLESS=true 설정 시에만 창 없이 실행
        if os.getenv("HEADLESS", "false").lower() == "true":
            options.add_argument("--headless=new")
            logger.info("🕵️ Crawler: Headless 모드로 실행됩니다.")
        else:
            logger.info("🖥️ Crawler: 일반 모드(창 있음)로 실행됩니다.")
            
        return options

    def _init_driver(self):
        try:
            # undetected_chromedriver는 서버에서 가끔 수동 관리가 필요하므로 설정 강화
            is_headless = os.getenv("HEADLESS", "false").lower() == "true"
            self.driver = uc.Chrome(
                options=self.options, 
                version_main=None, 
                suppress_welcome=True,
                headless=is_headless # UC 자체 헤드리스 파라미터도 적용
            )
            logger.info("✅ Crawler: Undetected ChromeDriver 초기화 성공")
        except Exception as e:
            logger.error(f"❌ Crawler: 드라이버 초기화 실패: {e}")
            raise

    @classmethod
    def send_telegram_static(cls, message):
        token = os.getenv("TELEGRAM_TOKEN")
        chat_id = os.getenv("CHAT_ID")
        if not token or not chat_id:
            logger.warning("⚠️ Telegram: 설정(TOKEN/CHAT_ID)이 누락되었습니다.")
            return False
            
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {"chat_id": chat_id, "text": message, "parse_mode": "Markdown"}
        try:
            response = requests.post(url, json=payload, timeout=10)
            if response.status_code == 200:
                logger.info("✅ Telegram: 메시지 전송 성공")
                return True
            else:
                logger.error(f"❌ Telegram: 전송 실패 ({response.status_code}): {response.text}")
                return False
        except Exception as e:
            logger.error(f"❌ Telegram: 에러 발생: {e}")
            return False

    def send_telegram(self, message):
        return self.send_telegram_static(message)

    def get_latest_news_title(self):
        try:
            WebDriverWait(self.driver, 15).until(EC.presence_of_element_located((By.TAG_NAME, "h3")))
            candidates = self.driver.find_elements(By.XPATH, "//h3[contains(@class, 'font-semibold') and contains(@class, 'text-text-txt-05')]")
            if not candidates:
                candidates = [el for el in self.driver.find_elements(By.TAG_NAME, "h3") if len(el.text.strip()) > 20]
            
            if candidates:
                return candidates[0].text.strip()
            return None
        except Exception as e:
            logger.warning(f"⚠️ Crawler: 뉴스 추출 중 오류: {e}")
            return None

    def run(self):
        self._init_driver()
        logger.info("🚀 Crawler: 모니터링 루프 시작")

        # 초기 실행 시 기존 키워드가 없으면 기본값 추가
        with SessionLocal() as db:
            if db.query(Keyword).count() == 0:
                default_keywords = ["비트코인", "BTC", "리플", "XRP", "이더리움", "ETH", "급등", "속보", "승인"]
                for kw in default_keywords:
                    db.add(Keyword(word=kw))
                db.commit()

        try:
            while not self.stop_event.is_set():
                try:
                    self.driver.get(self.COINNESS_URL)
                    time.sleep(5)

                    title = self.get_latest_news_title()
                    if not title:
                        time.sleep(60)
                        continue

                    # 1. DB 세션 밖에서 중복 확인 및 AI 분석 준비
                    with SessionLocal() as db:
                        existing = db.query(News).filter(News.title == title).first()
                    
                    if not existing:
                        # 2. 포트폴리오 정보 가져오기 (AI 분석용)
                        with SessionLocal() as db:
                            portfolio = db.query(Portfolio).all()
                            p_info = ", ".join([f"{p.symbol}(평단:{p.avg_price}, 수량:{p.quantity})" for p in portfolio]) if portfolio else "보유 자산 없음"

                        # 3. DB 세션 밖에서 AI 분석 수행 (포트폴리오 정보 포함)
                        ai_result = AIService.analyze_news(title, portfolio_info=p_info)
                        
                        with SessionLocal() as db:
                            # 4. 키워드 매칭
                            active_keywords = [k.word for k in db.query(Keyword).filter(Keyword.is_active == True).all()]
                            found_keywords = [word for word in active_keywords if word.lower() in title.lower()]
                            
                            # 5. DB 저장
                            new_news = News(
                                title=title,
                                matched_keywords=", ".join(found_keywords) if found_keywords else None,
                                ai_summary=ai_result["summary"] if ai_result else None,
                                ai_sentiment=ai_result["sentiment"] if ai_result else None,
                                ai_impact=ai_result["impact"] if ai_result else None,
                                ai_strategy=ai_result.get("strategy") if ai_result else None,
                                is_telegram_sent=bool(found_keywords)
                            )
                            db.add(new_news)
                            db.commit()
                            db.refresh(new_news)

                            # 6. WebSocket 브로드캐스트
                            if self.broadcast_callback:
                                self.broadcast_callback({
                                    "id": new_news.id,
                                    "title": new_news.title,
                                    "matched_keywords": new_news.matched_keywords,
                                    "ai_summary": new_news.ai_summary,
                                    "ai_sentiment": new_news.ai_sentiment,
                                    "ai_impact": new_news.ai_impact,
                                    "ai_strategy": new_news.ai_strategy,
                                    "created_at": new_news.created_at.isoformat()
                                })

                            # 6. 텔레그램 전송 (AI 분석 및 맞춤 전략 포함)
                            if found_keywords:
                                k_str = ", ".join(found_keywords)
                                s_emoji = "📈" if new_news.ai_sentiment == "호재" else "📉" if new_news.ai_sentiment == "악재" else "⚖️"
                                
                                # 더욱 풍부해진 텔레그램 메시지 구성
                                msg = (
                                    f"🔔 *[{k_str}] 관련 속보 발견*\n\n"
                                    f"📢 *제목:* {title}\n\n"
                                    f"🤖 *AI 요약*\n_{new_news.ai_summary}_\n\n"
                                    f"{s_emoji} *시장 분석:* {new_news.ai_sentiment} ({new_news.ai_impact})\n"
                                )
                                
                                # 맞춤 전략이 있는 경우 추가
                                if new_news.ai_strategy:
                                    msg += f"\n💡 *맞춤 투자 전략*\n`{new_news.ai_strategy}`\n"
                                
                                msg += f"\n🔗 [코인니스에서 보기]({self.COINNESS_URL})"
                                
                                self.send_telegram(msg)
                                logger.info(f"🔍 키워드 적중 & AI 리포트 전송 완료: {title[:50]}...")
                            else:
                                logger.info(f"🆕 새 뉴스 (일반): {title[:50]}...")

                except Exception as e:
                    logger.error(f"⚠️ Crawler: 루프 내 에러: {e}")
                    time.sleep(10)

                time.sleep(60)
        finally:
            if self.driver:
                self.driver.quit()
            logger.info("👋 Crawler: 종료됨")
    def start(self):
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join()
