@echo off
echo 🚀 Starting Arena v2 Local Development Environment...

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker first.
    echo Visit: https://docs.docker.com/get-docker/
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    docker compose version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Docker Compose is not installed. Please install Docker Compose first.
        pause
        exit /b 1
    )
)

REM Start PostgreSQL and Redis
echo 📦 Starting PostgreSQL and Redis...
docker-compose up -d postgres redis

REM Wait for databases to be ready
echo ⏳ Waiting for databases to start...
timeout /t 10 /nobreak >nul

REM Check if databases are running
docker-compose ps postgres | findstr "Up" >nul
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL failed to start
    pause
    exit /b 1
)
echo ✅ PostgreSQL is running

docker-compose ps redis | findstr "Up" >nul
if %errorlevel% neq 0 (
    echo ❌ Redis failed to start
    pause
    exit /b 1
)
echo ✅ Redis is running

REM Install dependencies if needed
if not exist "node_modules" (
    echo 📦 Installing frontend dependencies...
    npm install
)

if not exist "backend\auth-service\node_modules" (
    echo 📦 Installing auth service dependencies...
    cd backend\auth-service
    npm install
    cd ..\..
)

if not exist "backend\content-service\node_modules" (
    echo 📦 Installing content service dependencies...
    cd backend\content-service
    npm install
    cd ..\..
)

if not exist "backend\battle-service\node_modules" (
    echo 📦 Installing battle service dependencies...
    cd backend\battle-service
    npm install
    cd ..\..
)

REM Start backend services
echo 🔧 Starting backend services...

REM Start Auth Service
echo 🔐 Starting Auth Service...
start "Auth Service" cmd /c "cd backend\auth-service && npm run dev"

REM Start Content Service  
echo 🎵 Starting Content Service...
start "Content Service" cmd /c "cd backend\content-service && npm run dev"

REM Start Battle Service
echo ⚔️ Starting Battle Service...
start "Battle Service" cmd /c "cd backend\battle-service && npm run dev"

REM Wait for services to start
echo ⏳ Waiting for backend services to start...
timeout /t 5 /nobreak >nul

REM Start frontend
echo 🎨 Starting frontend...
start "Frontend" cmd /c "npm run dev"

echo.
echo 🎉 Arena v2 is now running locally!
echo.
echo 📱 Frontend: http://localhost:3000
echo 🔐 Auth Service: http://localhost:3001
echo 🎵 Content Service: http://localhost:3003
echo ⚔️ Battle Service: http://localhost:3002
echo.
echo 📊 PostgreSQL: localhost:5432
echo 🔴 Redis: localhost:6379
echo.
echo Press any key to stop all services...
pause >nul

REM Stop services
echo.
echo 🛑 Stopping all services...
taskkill /f /im node.exe >nul 2>&1
docker-compose down
echo ✅ All services stopped
pause
