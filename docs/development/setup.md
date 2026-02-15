# Development Setup Guide

## Prerequisites

### System Requirements
- **Operating System**: Windows 10+, macOS 10.15+, Ubuntu 18.04+
- **RAM**: Minimum 8GB, recommended 16GB+
- **Storage**: 20GB free space
- **Network**: Stable internet connection for API calls

### Required Software
- **Docker Desktop**: Latest version
- **Node.js**: v18+ (for local development tools)
- **Git**: Latest version
- **VS Code**: Recommended IDE with extensions

## Local Development Environment

### 1. Repository Setup

```bash
# Clone the repository
git clone https://github.com/arena-battle/arena-v2.git
cd arena-v2

# Install development dependencies
npm install

# Copy environment configuration
cp .env.example .env.local
```

### 2. Environment Configuration

Edit `.env.local` with your local settings:

```bash
# Database Configuration
DATABASE_URL=postgresql://arena:password@localhost:5432/arena_dev
REDIS_URL=redis://localhost:6379

# API Keys (development keys)
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
OPENAI_API_KEY=sk-...

# Local Services
API_GATEWAY_URL=http://localhost:8080
FRONTEND_URL=http://localhost:3000

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_MOCK_PAYMENTS=true
```

### 3. Docker Development Stack

Start the local development environment:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The development stack includes:
- **PostgreSQL**: Primary database
- **Redis**: Caching and sessions
- **MinIO**: Local object storage (S3 compatible)
- **Elasticsearch**: Search and analytics
- **API Gateway**: Local API gateway
- **Mock Services**: Payment processors, external APIs

### 4. Database Setup

```bash
# Run database migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Reset database (if needed)
npm run db:reset
```

### 5. Frontend Development

```bash
# Install frontend dependencies
cd frontend
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### 6. Backend Services

```bash
# Start all microservices
npm run services:start

# Start individual service
npm run service:start auth

# Run tests
npm run test

# Run integration tests
npm run test:integration
```

## Development Tools

### VS Code Extensions

Install these extensions for optimal development:

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode-remote.remote-containers",
    "ms-vscode.vscode-docker",
    "humao.rest-client"
  ]
}
```

### Code Quality Tools

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check
```

### Testing

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

## Service Architecture

### Microservices Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Auth Service  │    │  Battle Service │    │ Economy Service │
│   Port: 3001    │    │   Port: 3002    │    │   Port: 3003    │
└─────────────────┘    └─────────────────┘    └─────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│Moderation Service│    │Tournament Service│    │Content Service  │
│   Port: 3004    │    │   Port: 3005    │    │   Port: 3006    │
└─────────────────┘    └─────────────────┘    └─────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  API Gateway    │    │   Frontend      │    │   Mobile Apps   │
│   Port: 8080    │    │   Port: 3000    │    │   Port: 19006   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Service Dependencies

```mermaid
graph TD
    A[API Gateway] --> B[Auth Service]
    A --> C[Battle Service]
    A --> D[Economy Service]
    A --> E[Moderation Service]
    A --> F[Tournament Service]
    A --> G[Content Service]
    
    B --> H[PostgreSQL]
    C --> H
    C --> I[Redis]
    C --> J[Object Storage]
    D --> H
    E --> H
    E --> K[Elasticsearch]
    F --> H
    G --> H
    G --> J
```

## Database Management

### Local Database Commands

```bash
# Connect to PostgreSQL
docker exec -it arena-postgres psql -U arena -d arena_dev

# View all tables
\dt

# Run custom query
SELECT * FROM users LIMIT 10;

# Backup database
docker exec arena-postgres pg_dump -U arena arena_dev > backup.sql

# Restore database
docker exec -i arena-postgres psql -U arena arena_dev < backup.sql
```

### Migration Management

```bash
# Create new migration
npm run migration:create -- --name add_new_table

# Run pending migrations
npm run migration:run

# Rollback migration
npm run migration:rollback

# View migration status
npm run migration:status
```

## API Development

### Local API Testing

Use the included REST client configuration:

```http
### User Registration
POST http://localhost:8080/v1/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "securepassword123"
}

### User Login
POST http://localhost:8080/v1/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "securepassword123"
}

### Get User Profile
GET http://localhost:8080/v1/users/profile
Authorization: Bearer {{access_token}}
```

### API Documentation

Local API documentation available at:
- **Swagger UI**: http://localhost:8080/docs
- **GraphQL Playground**: http://localhost:8080/graphql
- **Postman Collection**: `docs/api/postman-collection.json`

## Frontend Development

### Component Structure

```
src/
├── components/          # Reusable UI components
│   ├── common/         # Generic components
│   ├── battle/         # Battle-specific components
│   ├── tournament/     # Tournament components
│   └── profile/        # Profile components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── services/           # API service functions
├── store/              # State management
├── utils/              # Utility functions
└── types/              # TypeScript definitions
```

### State Management

Using Zustand for state management:

```typescript
// Example store
interface BattleStore {
  currentBattle: Battle | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  startBattle: (opponentId: string) => Promise<void>;
  submitRound: (audioFile: File) => Promise<void>;
  leaveBattle: () => void;
}

const useBattleStore = create<BattleStore>((set, get) => ({
  currentBattle: null,
  isLoading: false,
  error: null,
  
  startBattle: async (opponentId: string) => {
    set({ isLoading: true, error: null });
    try {
      const battle = await battleService.startBattle(opponentId);
      set({ currentBattle: battle, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  // ... other actions
}));
```

### Styling

Using Tailwind CSS with custom components:

```typescript
// Example component
interface BattleButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick: () => void;
}

const BattleButton: React.FC<BattleButtonProps> = ({
  variant,
  size,
  children,
  onClick
}) => {
  const baseClasses = 'font-semibold rounded-lg transition-colors';
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
    danger: 'bg-red-600 hover:bg-red-700 text-white'
  };
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

## Testing Strategy

### Unit Testing

Using Jest and React Testing Library:

```typescript
// Example test
import { render, screen, fireEvent } from '@testing-library/react';
import { BattleButton } from './BattleButton';

describe('BattleButton', () => {
  it('renders with correct text', () => {
    render(<BattleButton variant="primary" size="md" onClick={() => {}}>
      Start Battle
    </BattleButton>);
    
    expect(screen.getByText('Start Battle')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<BattleButton variant="primary" size="md" onClick={handleClick}>
      Click Me
    </BattleButton>);
    
    fireEvent.click(screen.getByText('Click Me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Testing

Testing service interactions:

```typescript
// Example integration test
describe('Battle Integration', () => {
  it('should create and complete a battle', async () => {
    // Setup test users
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    
    // Start battle
    const battle = await battleService.startBattle(user1.id, user2.id);
    expect(battle.status).toBe('active');
    
    // Submit rounds
    await battleService.submitRound(battle.id, user1.id, audioFile1);
    await battleService.submitRound(battle.id, user2.id, audioFile2);
    
    // Complete battle
    const result = await battleService.completeBattle(battle.id);
    expect(result.winner).toBeDefined();
  });
});
```

### E2E Testing

Using Playwright for end-to-end tests:

```typescript
// Example E2E test
import { test, expect } from '@playwright/test';

test('user can register and start a battle', async ({ page }) => {
  // Navigate to app
  await page.goto('http://localhost:3000');
  
  // Register user
  await page.click('[data-testid="register-button"]');
  await page.fill('[data-testid="username-input"]', 'testuser');
  await page.fill('[data-testid="email-input"]', 'test@example.com');
  await page.fill('[data-testid="password-input"]', 'password123');
  await page.click('[data-testid="submit-button"]');
  
  // Verify registration
  await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
  
  // Start battle
  await page.click('[data-testid="quick-match-button"]');
  await expect(page.locator('[data-testid="battle-room"]')).toBeVisible();
});
```

## Debugging

### Local Debugging

```bash
# Debug Node.js services
node --inspect-brk dist/services/auth-service.js

# Debug with VS Code
# Use launch configuration in .vscode/launch.json
```

### Database Debugging

```bash
# View database queries
docker logs arena-postgres | grep "SELECT"

# Monitor Redis
docker exec -it arena-redis redis-cli monitor

# Check object storage
docker exec -it arena-minio mc ls local/arena-uploads
```

### API Debugging

```bash
# View API gateway logs
docker logs arena-api-gateway

# Test API endpoints
curl -X GET http://localhost:8080/v1/health

# Monitor WebSocket connections
wscat -c ws://localhost:8080/v1/ws/battles
```

## Performance Monitoring

### Local Monitoring Tools

```bash
# View resource usage
docker stats

# Monitor database performance
docker exec arena-postgres psql -U arena -d arena_dev -c "
  SELECT query, calls, total_time, mean_time 
  FROM pg_stat_statements 
  ORDER BY total_time DESC 
  LIMIT 10;
"

# Check Redis performance
docker exec arena-redis redis-cli info stats
```

### Frontend Performance

```bash
# Bundle analysis
npm run build:analyze

# Lighthouse audit
npm run lighthouse

# Performance budgets
npm run test:performance
```

## Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check PostgreSQL status
docker ps | grep postgres

# Reset database
docker-compose down
docker volume rm arena_postgres_data
docker-compose up -d postgres
npm run db:migrate
```

#### Service Startup Failures
```bash
# Check service logs
docker logs arena-auth-service

# Restart specific service
docker-compose restart auth-service

# Check port conflicts
netstat -tulpn | grep :3001
```

#### Frontend Build Issues
```bash
# Clear node modules
rm -rf node_modules package-lock.json
npm install

# Clear cache
npm run clean
```

### Getting Help

- **Documentation**: Check `docs/` directory
- **Issues**: GitHub Issues
- **Discord**: Development community
- **Slack**: Internal team communication

## Contributing Guidelines

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration
- **Prettier**: Standard formatting
- **Husky**: Pre-commit hooks

### Pull Request Process

1. Create feature branch from `develop`
2. Implement changes with tests
3. Update documentation
4. Submit pull request with description
5. Code review and approval
6. Merge to `develop`
7. Deploy to staging for testing

### Release Process

1. Update version numbers
2. Update changelog
3. Create release tag
4. Deploy to production
5. Monitor for issues

This setup provides a complete development environment for building and testing Arena v2 locally.
