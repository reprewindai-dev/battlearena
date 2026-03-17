@echo off
echo 🚀 Starting Arena v2 Local Development Environment (Without Docker)...

REM Create local database setup
echo 📊 Setting up local database simulation...

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

REM Create mock database files
echo 📝 Creating mock database setup...
if not exist "mock-data" mkdir mock-data
echo {"users": [], "beats": [], "battles": []} > mock-data\database.json

REM Start backend services
echo 🔧 Starting backend services...

REM Start Auth Service
echo 🔐 Starting Auth Service...
start "Auth Service" cmd /c "cd backend\auth-service && set DATABASE_URL=mock && set REDIS_URL=mock && npm run dev"

REM Start Content Service  
echo 🎵 Starting Content Service...
start "Content Service" cmd /c "cd backend\content-service && set DATABASE_URL=mock && set REDIS_URL=mock && set AWS_ACCESS_KEY_ID=mock && set AWS_SECRET_ACCESS_KEY=mock && set AWS_S3_BUCKET=mock && npm run dev"

REM Start Battle Service
echo ⚔️ Starting Battle Service...
start "Battle Service" cmd /c "cd backend\battle-service && set DATABASE_URL=mock && set REDIS_URL=mock && npm run dev"

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
echo ⚠️  Note: Running with mock database (no PostgreSQL/Redis)
echo 💡 To run with full database, install Docker and use start-local.bat
echo.
echo Press any key to stop all services...
pause >nul

REM Stop services
echo.
echo 🛑 Stopping all services...
taskkill /f /im node.exe >nul 2>&1
echo ✅ All services stopped
pause
