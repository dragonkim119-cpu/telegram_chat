#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Undetected ChromeDriver 테스트 스크립트
Selenium 감지 우회 성공 여부 확인
"""
import time
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

print("🧪 Undetected ChromeDriver 테스트 시작...")

try:
    # Undetected ChromeDriver 초기화
    print("⏳ ChromeDriver 초기화 중...")
    driver = uc.Chrome(version_main=None, suppress_welcome=True)
    print("✅ ChromeDriver 초기화 성공\n")
    
    # Coinness 접속
    print("📡 coinness.com 접속 중...")
    driver.get("https://coinness.com/")
    
    # 페이지 로딩 대기
    print("⏳ 페이지 로딩 대기 중... (5초)")
    time.sleep(5)
    
    # 뉴스 요소 찾기
    print("🔍 뉴스 요소 찾는 중...")
    try:
        news_element = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "h3[class*='NewsList_title']"))
        )
        print(f"✅ 뉴스 요소 발견!")
        print(f"📰 최신 뉴스: {news_element.text.strip()}\n")
    except Exception as e:
        print(f"⚠️ 뉴스 요소 찾기 실패: {e}\n")
        
        # 현재 페이지 제목 확인
        print(f"📄 페이지 제목: {driver.title}\n")
        
        # CSS 선택자 확인
        print("🔎 페이지 HTML 구조 확인 중...")
        h3_elements = driver.find_elements(By.TAG_NAME, "h3")
        print(f"H3 요소 개수: {len(h3_elements)}")
        if h3_elements:
            for i, h3 in enumerate(h3_elements[:3]):
                print(f"  - H3 {i}: {h3.text[:50] if h3.text else '(비어있음)'}")
    
    print("\n✅ 테스트 완료")
    
except Exception as e:
    print(f"\n❌ 테스트 실패: {e}")
    import traceback
    traceback.print_exc()
    
finally:
    try:
        driver.quit()
        print("\n🛑 드라이버 종료 완료")
    except:
        pass
