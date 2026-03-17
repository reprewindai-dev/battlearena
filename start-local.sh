#!/bin/bash

echo "🚀 Starting Arena v2 Local Development Environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Start PostgreSQL and Redis
echo "📦 Starting PostgreSQL and Redis..."
docker-compose up -d postgres redis

# Wait for databases to be ready
echo "⏳ Waiting for databases to start..."
sleep 10

# Check if databases are running
if docker-compose ps postgres | grep -q "Up"; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL failed to start"
    exit 1
fi

if docker-compose ps redis | grep -q "Up"; then
    echo "✅ Redis is running"
else
    echo "❌ Redis failed to start"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

for service in backend/auth-service backend/content-service backend/battle-service; do
    if [ ! -d "$service/node_modules" ]; then
        echo "📦 Installing $service dependencies..."
        cd "$service" && npm install && cd ../..
    fi
done

# Start backend services
echo "🔧 Starting backend services..."

# Start Auth Service
echo "🔐 Starting Auth Service..."
cd backend/auth-service
npm run dev &
AUTH_PID=$!
cd ../..

# Start Content Service  
echo "🎵 Starting Content Service..."
cd backend/content-service
npm run dev &
CONTENT_PID=$!
cd ../..

# Start Battle Service
echo "⚔️ Starting Battle Service..."
cd backend/battle-service
npm run dev &
BATTLE_PID=$!
cd ../..

# Wait for services to start
echo "⏳ Waiting for backend services to start..."
sleep 5

# Start frontend
echo "🎨 Starting frontend..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "🎉 Arena v2 is now running locally!"
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔐 Auth Service: http://localhost:3001"
echo "🎵 Content Service: http://localhost:3003"
echo "⚔️ Battle Service: http://localhost:3002"
echo ""
echo "📊 PostgreSQL: localhost:5432"
echo "🔴 Redis: localhost:6379"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $AUTH_PID $CONTENT_PID $BATTLE_PID $FRONTEND_PID 2>/dev/null
    docker-compose down
    echo "✅ All services stopped"
    exit 0
}

# Set up trap for cleanup
trap cleanup INT TERM

# Wait for services
wait
