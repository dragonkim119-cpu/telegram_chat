# 1. 베이스 이미지 설정 (파이썬 포함)
FROM python:3.11-slim

# 2. 필수 패키지 및 크롬 브라우저 설치 (Selenium 구동용)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    xvfb \
    libxi6 \
    libgconf-2-4 \
    default-jdk \
    google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# 3. 작업 디렉토리 설정
WORKDIR /app

# 4. 의존성 파일 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. 소스 코드 복사
COPY . .

# 6. 포트 설정 및 실행 (Render의 PORT 환경변수 사용)
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
