import asyncio
import json
import logging
from typing import List

from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
from database import engine, SessionLocal, get_db
from crawler_service import CoinnessCrawler
from market_service import MarketService
from backtest_service import BacktestService
from pydantic import BaseModel

# DB 테이블 생성
models.Base.metadata.create_all(bind=engine)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI(title="Coinness Live Dashboard API")

# 크롬 사설 네트워크 접근 제한 해결을 위한 미들웨어
class PrivateNetworkMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response

app.add_middleware(PrivateNetworkMiddleware)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- WebSocket 매니저 ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"🔌 WebSocket: 새 클라이언트 연결됨. (현재: {len(self.active_connections)}명)")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"🔌 WebSocket: 클라이언트 연결 해제. (현재: {len(self.active_connections)}명)")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"❌ WebSocket 브로드캐스트 에러: {e}")

manager = ConnectionManager()

# --- 서비스 연동 ---
main_loop = None

def crawler_callback(data):
    if main_loop:
        # 뉴스 데이터는 type: "news"로 감싸서 브로드캐스트
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({"type": "news", "data": data}), 
            main_loop
        )

def market_callback(data):
    if main_loop:
        # 시세 및 알림 데이터 브로드캐스트 (data 내부에 이미 type 포함됨)
        asyncio.run_coroutine_threadsafe(
            manager.broadcast(data), 
            main_loop
        )

crawler = CoinnessCrawler(broadcast_callback=crawler_callback)
market_service = MarketService(
    broadcast_callback=market_callback,
    telegram_callback=CoinnessCrawler.send_telegram_static
)

@app.on_event("startup")
async def startup_event():
    global main_loop
    main_loop = asyncio.get_running_loop()
    logger.info("✨ 서버 시작: 크롤러 및 시세 모니터링 구동")
    crawler.start()
    market_service.start()

@app.on_event("shutdown")
def shutdown_event():
    logger.info("🛑 서버 종료: 모든 서비스 중지")
    crawler.stop()
    market_service.stop()

# --- Pydantic 모델 ---
class KeywordCreate(BaseModel):
    word: str

class PortfolioCreate(BaseModel):
    symbol: str
    avg_price: int
    quantity: str

# --- API 엔드포인트 ---

@app.get("/api/portfolio")
def get_portfolio(db: Session = Depends(get_db)):
    """내 포트폴리오 목록 조회"""
    return db.query(models.Portfolio).all()

@app.post("/api/portfolio")
def create_portfolio(item: PortfolioCreate, db: Session = Depends(get_db)):
    """포트폴리오 코인 추가 또는 업데이트"""
    symbol = item.symbol.upper()
    db_item = db.query(models.Portfolio).filter(models.Portfolio.symbol == symbol).first()
    
    if db_item:
        db_item.avg_price = item.avg_price
        db_item.quantity = item.quantity
    else:
        db_item = models.Portfolio(
            symbol=symbol,
            avg_price=item.avg_price,
            quantity=item.quantity
        )
        db.add(db_item)
        
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/api/portfolio/{portfolio_id}")
def delete_portfolio(portfolio_id: int, db: Session = Depends(get_db)):
    """포트폴리오 코인 삭제"""
    db_item = db.query(models.Portfolio).filter(models.Portfolio.id == portfolio_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="코인을 찾을 수 없습니다.")
    db.delete(db_item)
    db.commit()
    return {"message": "삭제 완료"}

@app.get("/api/news")
def get_news(db: Session = Depends(get_db)):
    """최근 50개의 뉴스 목록 조회"""
    return db.query(models.News).order_by(models.News.created_at.desc()).limit(50).all()

@app.get("/api/keywords")
def get_keywords(db: Session = Depends(get_db)):
    """등록된 모든 키워드 조회"""
    return db.query(models.Keyword).all()

@app.post("/api/keywords")
def create_keyword(item: KeywordCreate, db: Session = Depends(get_db)):
    """새 키워드 추가"""
    db_item = models.Keyword(word=item.word)
    try:
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        return db_item
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="이미 존재하는 키워드이거나 오류가 발생했습니다.")

@app.delete("/api/keywords/{keyword_id}")
def delete_keyword(keyword_id: int, db: Session = Depends(get_db)):
    """키워드 삭제"""
    db_item = db.query(models.Keyword).filter(models.Keyword.id == keyword_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다.")
    db.delete(db_item)
    db.commit()
    return {"message": "삭제 완료"}

@app.post("/api/test-telegram")
def test_telegram():
    # ... (기존 코드 동일)

@app.post("/api/seed")
def seed_data(db: Session = Depends(get_db)):
    """서버에 테스트용 가짜 데이터 10개 생성"""
    import random
    from datetime import datetime, timedelta
    titles = ["비트코인 ETF 승인", "리플 승소 가능성", "이더리움 업그레이드", "바이낸스 신규 상장", "급등 주의보"]
    for i in range(10):
        t = random.choice(titles) + f" {random.randint(1,100)}"
        new_news = models.News(
            title=t, ai_summary="서버 테스트 데이터입니다.", 
            ai_sentiment="호재", created_at=datetime.now() - timedelta(hours=i)
        )
        db.add(new_news)
    db.commit()
    return {"message": "10개의 데이터가 생성되었습니다."}

@app.get("/api/backtest/{keyword}")
def get_backtest(keyword: str, db: Session = Depends(get_db)):
    """특정 키워드가 포함된 과거 뉴스의 수익률 분석 결과 반환"""
    search_keyword = keyword
    # 간단한 약어 맵핑 (확장 가능)
    mapping = {"BTC": "비트코인", "ETH": "이더리움", "XRP": "리플"}
    if keyword.upper() in mapping:
        search_term = f"%{mapping[keyword.upper()]}%"
    else:
        search_term = f"%{keyword}%"

    # 1. 해당 키워드 또는 맵핑된 한글 단어로 뉴스 검색
    news_list = db.query(models.News).filter(
        (models.News.title.ilike(f"%{keyword}%")) | (models.News.title.ilike(search_term))
    ).order_by(models.News.created_at.desc()).limit(20).all()
    
    # 데이터가 아예 없을 때만 404 에러
    if not news_list:
        raise HTTPException(status_code=404, detail=f"'{keyword}' 관련 뉴스가 DB에 없습니다.")
    
    # 2. 백테스팅 수행
    analysis = BacktestService.analyze_keyword_impact(news_list, market="KRW-BTC")
    
    if not analysis:
        # 시세 조회 API 실패 등의 경우
        raise HTTPException(status_code=400, detail="시세 데이터를 불러올 수 없습니다. 잠시 후 다시 시도하세요.")
        
    return analysis

# --- WebSocket 엔드포인트 ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # 클라이언트로부터 메시지를 받을 필요는 없지만 연결 유지를 위해 대기
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket 루프 에러: {e}")
        manager.disconnect(websocket)
