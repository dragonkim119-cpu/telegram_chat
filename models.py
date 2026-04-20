from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from database import Base

class News(Base):
    __tablename__ = "news"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(String, nullable=True) 
    matched_keywords = Column(String, nullable=True) 
    ai_summary = Column(String, nullable=True) # AI 요약문
    ai_sentiment = Column(String, nullable=True) # 호재, 악재, 중립
    ai_impact = Column(String, nullable=True) # 시장 영향도 점수 또는 코멘트
    ai_strategy = Column(String, nullable=True) # 맞춤 대응 전략
    is_telegram_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)

class Keyword(Base):
    __tablename__ = "keywords"

    id = Column(Integer, primary_key=True, index=True)
    word = Column(String, unique=True, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)

class Portfolio(Base):
    __tablename__ = "portfolio"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True) # BTC, ETH 등
    avg_price = Column(Integer) # 평단가
    quantity = Column(String) # 보유 수량 (소수점 고려하여 문자열 저장)
    created_at = Column(DateTime, default=datetime.now)
