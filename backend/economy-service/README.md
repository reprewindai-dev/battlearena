# BattleArena Economy Service

A production-grade microservice handling all economic operations for the BattleArena platform, including token purchases, spending, payouts, and comprehensive audit logging.

## Features

- **Multi-Currency Wallet System**: Crowns (reputation), Tokens (support), Points (creator earnings)
- **Global Payment Processing**: Stripe, PayPal, Adyen integration with regional fallbacks
- **Token Economy**: Purchase, spend, tip creators, battle entry fees, item purchases
- **Creator Payouts**: Automated processing with escrow and admin approval workflows
- **Fraud Detection**: Velocity checks, risk scoring, and anomaly detection
- **Comprehensive Auditing**: Full audit trail for all economic events
- **Real-time Metrics**: Prometheus metrics for monitoring and alerting
- **Security**: Rate limiting, input validation, role-based access control

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Battle        │    │   Content       │
│   (Next.js)     │    │   Service       │    │   Service       │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │     Economy Service       │
                    │   (Node.js + Express)     │
                    └─────────────┬─────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
        ┌───────▼───────┐ ┌──────▼──────┐ ┌──────▼──────┐
        │   PostgreSQL  │ │    Redis    │ │   Stripe    │
        │   Database   │ │   Cache     │ │   API       │
        └──────────────┘ └─────────────┘ └─────────────┘
```

## API Endpoints

### Wallet Management
- `GET /v1/wallet` - Get user wallet information
- `GET /v1/wallet/snapshot` - Get balance snapshot with recent activity
- `GET /v1/wallet/transactions` - Get transaction history
- `POST /v1/wallet/validate` - Validate balance for operation

### Token Purchases
- `POST /v1/tokens/purchase` - Create payment intent for token purchase
- `POST /v1/tokens/purchase/confirm` - Confirm payment and process tokens
- `POST /v1/tokens/setup-intent` - Create setup intent for saved payment methods
- `GET /v1/tokens/history` - Get purchase history

### Token Spending
- `POST /v1/tokens/spend` - General token spending endpoint
- `POST /v1/tokens/tip` - Tip a creator
- `POST /v1/tokens/entry-fee` - Pay battle entry fee
- `POST /v1/tokens/purchase` - Purchase in-app items
- `GET /v1/tokens/history` - Get spending history
- `GET /v1/tokens/receipts` - Get tokens received history

### Payouts
- `POST /v1/payouts/request` - Create payout request
- `GET /v1/payouts/my-requests` - Get user's payout requests
- `POST /v1/payouts/validate` - Validate payout request
- `GET /v1/payouts/eligibility` - Check payout eligibility
- `GET /v1/payouts/methods` - Get available payout methods
- `GET /v1/payouts/limits` - Get payout limits and policies

### Admin Endpoints
- `GET /v1/admin/payouts/all` - Get all payout requests
- `POST /v1/admin/payouts/approve` - Approve payout request
- `POST /v1/admin/payouts/reject` - Reject payout request
- `GET /v1/admin/stats` - Get various statistics

### Webhooks
- `POST /v1/providers/stripe/webhook` - Stripe webhook handler
- `POST /v1/providers/paypal/webhook` - PayPal webhook handler
- `POST /v1/providers/adyen/webhook` - Adyen webhook handler

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Stripe, PayPal, and/or Adyen accounts

### Installation

1. **Clone and install dependencies**
```bash
cd backend/economy-service
npm install
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Set up database**
```bash
# Create database and run schema
psql -c "CREATE DATABASE arena;"
psql -d arena -f database/schema.sql
```

4. **Start Redis**
```bash
redis-server
```

5. **Start the service**
```bash
npm run dev
```

The service will be available at `http://localhost:3003`

### Docker Setup

```bash
# Build image
docker build -t battlearena/economy-service .

# Run with Docker Compose
docker-compose up -d economy-service
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Service port | `3003` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `arena` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | - |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | JWT signing secret | - |
| `STRIPE_SECRET_KEY` | Stripe secret key | - |
| `PAYPAL_CLIENT_ID` | PayPal client ID | - |
| `ADYEN_API_KEY` | Adyen API key | - |

### Payment Provider Setup

#### Stripe
1. Create a Stripe account
2. Get API keys from Dashboard
3. Set up webhook endpoints
4. Configure webhook secret

#### PayPal
1. Create a PayPal Developer account
2. Create REST API app
3. Get client ID and secret
4. Set up webhook endpoints

#### Adyen
1. Create an Adyen account
2. Get API key and client key
3. Set up webhook endpoints

## Security Features

### Fraud Detection
- **Velocity Checks**: Limits on transaction frequency and amounts
- **Risk Scoring**: Machine learning-based risk assessment
- **Anomaly Detection**: Unusual pattern identification
- **Blacklist Management**: Block suspicious users/IPs

### Rate Limiting
- Global rate limits (200 requests/minute)
- Endpoint-specific limits
- User-based throttling
- IP-based blocking

### Authentication & Authorization
- JWT-based authentication
- Role-based access control
- Admin-only endpoints
- API key management

## Monitoring & Observability

### Metrics
- Prometheus metrics endpoint at `/metrics`
- Custom business metrics
- Performance metrics
- Error tracking

### Logging
- Structured JSON logging
- Request/response logging
- Error tracking
- Audit trails

### Health Checks
- Service health endpoint at `/health`
- Database connectivity checks
- Redis connectivity checks
- External service health

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage

# Run API tests
npm run test:api
```

## Deployment

### Production Deployment

1. **Environment Setup**
   - Configure production environment variables
   - Set up SSL certificates
   - Configure load balancer

2. **Database Setup**
   - Set up PostgreSQL cluster
   - Configure connection pooling
   - Set up read replicas

3. **Redis Setup**
   - Configure Redis cluster
   - Set up persistence
   - Configure backup strategy

4. **Service Deployment**
   - Build Docker image
   - Deploy to container orchestration
   - Configure health checks
   - Set up monitoring

### Docker Compose

```yaml
version: '3.8'
services:
  economy-service:
    build: .
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:13
    environment:
      - POSTGRES_DB=arena
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## API Documentation

### Authentication
All API endpoints (except webhooks and health) require JWT authentication:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3003/v1/wallet
```

### Error Handling
The API returns consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient token balance",
    "details": {
      "required": 100,
      "available": 50
    }
  }
}
```

### Rate Limits
Rate limits are enforced per endpoint and user:
- Standard: 200 requests/minute
- Purchases: 5 requests/15 minutes
- Spending: 30 requests/minute
- Payouts: 3 requests/hour

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## Changelog

### v1.0.0
- Initial release
- Core wallet functionality
- Token purchases and spending
- Creator payouts
- Fraud detection
- Comprehensive audit logging
- Multi-provider payment processing
