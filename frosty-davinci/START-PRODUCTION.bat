@echo off
echo ========================================
echo BATTLEARENA PRODUCTION AUTHENTICATION
echo ========================================
echo.
echo Starting production-grade Supabase services...
echo.

cd /d "c:\Users\antho\.windsurf\battlearena"

echo 1. Starting PostgreSQL database...
docker-compose -f docker-compose.supabase.prod.yml up -d postgres

echo.
echo 2. Waiting for database to be ready...
timeout /t 10

echo.
echo 3. Starting all services...
docker-compose -f docker-compose.supabase.prod.yml up -d

echo.
echo 4. Checking service status...
docker-compose -f docker-compose.supabase.prod.yml ps

echo.
echo ========================================
echo SERVICES READY!
echo ========================================
echo BattleArena: http://localhost:3001
echo Supabase API: http://localhost:8080
echo.
echo Test signup/login now - NO MORE MOCKS!
echo ========================================
pause
