# API Specifications

## Overview

Arena v2 uses a RESTful API design with GraphQL for complex queries. All APIs are versioned and require authentication.

## Base URLs

- **Production**: `https://api.arena.battle/v1`
- **Staging**: `https://staging-api.arena.battle/v1`
- **Development**: `http://localhost:8080/v1`

## Authentication

All API requests require authentication via JWT tokens:

```
Authorization: Bearer <jwt_token>
```

## Core Endpoints

### Authentication Service

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "battlemaster",
  "email": "user@example.com",
  "password": "securepassword123",
  "date_of_birth": "1995-06-15",
  "country_code": "US",
  "accept_terms": true,
  "accept_privacy": true
}
```

**Response:**
```json
{
  "user_id": "uuid",
  "access_token": "jwt_token",
  "refresh_token": "jwt_token",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "username": "battlemaster",
    "email": "user@example.com",
    "is_verified": false,
    "tier": "novice"
  }
}
```

#### POST /auth/login
Authenticate user and return tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

#### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "jwt_token"
}
```

#### POST /auth/logout
Invalidate current session.

**Headers:**
```
Authorization: Bearer <access_token>
```

### User Service

#### GET /users/profile
Get current user's profile.

**Response:**
```json
{
  "id": "uuid",
  "username": "battlemaster",
  "display_name": "Battle Master",
  "bio": "Freestyle artist and battle enthusiast",
  "avatar_url": "https://cdn.arena.battle/avatars/uuid.jpg",
  "tier": "silver",
  "reputation_score": 1250.50,
  "stats": {
    "wins": 45,
    "losses": 23,
    "win_rate": 0.66,
    "current_streak": 5
  },
  "wallet": {
    "crowns_balance": 5000,
    "points_balance": 25000
  }
}
```

#### PUT /users/profile
Update user profile.

**Request Body:**
```json
{
  "display_name": "New Display Name",
  "bio": "Updated bio",
  "social_links": {
    "instagram": "@battlemaster",
    "youtube": "channel_id"
  }
}
```

#### GET /users/{user_id}
Get public profile of another user.

#### GET /users/leaderboard
Get leaderboard by tier.

**Query Parameters:**
- `tier`: Filter by tier (optional)
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

### Battle Service

#### POST /battles
Create a new battle request.

**Request Body:**
```json
{
  "battle_type": "ranked",
  "format": "30s",
  "beat_preferences": {
    "genre": "hip-hop",
    "tempo_range": [85, 95]
  }
}
```

#### GET /battles/{battle_id}
Get battle details.

**Response:**
```json
{
  "id": "uuid",
  "status": "active",
  "battle_type": "ranked",
  "format": "30s",
  "players": [
    {
      "user_id": "uuid",
      "username": "player1",
      "rating": 1650.00
    },
    {
      "user_id": "uuid",
      "username": "player2",
      "rating": 1580.00
    }
  ],
  "beat": {
    "id": "uuid",
    "title": "Boom Bap Classic",
    "tempo": 90,
    "preview_url": "https://cdn.arena.battle/beats/preview.mp3"
  },
  "room_code": "ABC123",
  "current_round": 1,
  "total_rounds": 2
}
```

#### POST /battles/{battle_id}/join
Join an existing battle.

#### POST /battles/{battle_id}/rounds
Submit a battle round recording.

**Request Body (multipart/form-data):**
- `audio_file`: Audio file (MP3, WAV)
- `round_number`: Round number
- `duration_seconds`: Recording duration

#### GET /battles/queue
Get current matchmaking queue status.

#### GET /battles/history
Get user's battle history.

**Query Parameters:**
- `limit`: Number of results (default: 20)
- `offset`: Pagination offset
- `status`: Filter by status (completed, active)

### Tournament Service

#### GET /tournaments
List available tournaments.

**Response:**
```json
{
  "tournaments": [
    {
      "id": "uuid",
      "name": "Weekly Freestyle Championship",
      "type": "weekly",
      "format": "single_elimination",
      "status": "registration",
      "max_participants": 64,
      "current_participants": 45,
      "entry_fee_tokens": 100,
      "prize_pool_tokens": 10000,
      "registration_closes": "2026-02-15T23:59:59Z",
      "starts_at": "2026-02-16T19:00:00Z"
    }
  ]
}
```

#### POST /tournaments/{tournament_id}/register
Register for a tournament.

#### GET /tournaments/{tournament_id}/bracket
Get tournament bracket.

#### GET /tournaments/{tournament_id}/participants
Get tournament participants list.

### Economy Service

#### GET /economy/wallet
Get user's wallet information.

#### POST /economy/tokens/purchase
Purchase tokens.

**Request Body:**
```json
{
  "token_package": 1000,
  "payment_method": "card",
  "currency": "USD"
}
```

#### POST /economy/tokens/spend
Spend tokens (tip, purchase, etc.).

**Request Body:**
```json
{
  "recipient_id": "uuid",
  "tokens": 100,
  "transaction_type": "tip",
  "reference_id": "battle_uuid",
  "message": "Great battle!"
}
```

#### GET /economy/transactions
Get transaction history.
#### POST /economy/tokens/confirm
Finalize token credit after Stripe PaymentIntent confirmation.

**Request Body:**
```json
{
  "payment_intent_id": "pi_..."
}
```

#### POST /subscriptions/create
Create Stripe subscription in `default_incomplete` mode and return PaymentIntent client secret.

**Request Body:**
```json
{
  "plan_id": "pro",
  "payment_method": "card"
}
```

#### POST /stripe/webhook
Stripe webhook endpoint for payment/subscription settlement (signature required).

#### POST /economy/payouts/request
Request payout of earned points.

**Request Body:**
```json
{
  "amount_cents": 5000,
  "payment_method": "bank_transfer",
  "payout_details": {
    "account_holder": "John Doe",
    "account_number": "****1234",
    "routing_number": "****5678"
  }
}
```

### Content Service

#### GET /beats
Browse beat library.

**Query Parameters:**
- `genre`: Filter by genre
- `tempo_min`: Minimum tempo
- `tempo_max`: Maximum tempo
- `limit`: Results per page (default: 20)
- `offset`: Pagination offset

#### POST /beats
Upload a new beat (requires verification).

**Request Body (multipart/form-data):**
- `beat_file`: Audio file
- `title`: Beat title
- `artist`: Artist name
- `tempo`: BPM
- `key_signature`: Key (e.g., "C# minor")
- `genre`: Genre
- `license_type`: License type

#### GET /beats/{beat_id}
Get beat details.

#### POST /beats/{beat_id}/review
Rate and review a beat.

### Moderation Service

#### POST /moderation/reports
File a moderation report.

**Request Body:**
```json
{
  "reported_user_id": "uuid",
  "content_type": "battle",
  "content_id": "uuid",
  "reason": "hate_speech",
  "description": "User used discriminatory language",
  "severity": "high"
}
```

#### GET /moderation/reports
Get moderation reports (moderator only).

#### POST /moderation/reports/{report_id}/resolve
Resolve a moderation report.

**Request Body:**
```json
{
  "action": "temporary_ban",
  "duration_days": 7,
  "notes": "Clear violation of community guidelines"
}
```

## WebSocket Events

### Battle Room Events

#### Join Battle Room
```javascript
const ws = new WebSocket('wss://api.arena.battle/v1/ws/battles/{battle_id}?token={jwt_token}');

ws.onopen = () => {
  // Join room
  ws.send(JSON.stringify({
    type: 'join_room',
    data: { room_code: 'ABC123' }
  }));
};
```

#### Battle Events
```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'battle_starting':
      console.log('Battle starting in 5 seconds');
      break;
      
    case 'round_start':
      console.log('Round started for player:', message.data.player_id);
      break;
      
    case 'round_complete':
      console.log('Round completed:', message.data.round_data);
      break;
      
    case 'battle_complete':
      console.log('Battle finished:', message.data.results);
      break;
      
    case 'spectator_join':
      console.log('New spectator:', message.data.user);
      break;
  }
};
```

### Real-time Notifications

#### Notification Events
```javascript
const notificationWs = new WebSocket('wss://api.arena.battle/v1/ws/notifications?token={jwt_token}');

notificationWs.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  
  switch (notification.type) {
    case 'battle_invite':
      // Handle battle invitation
      break;
      
    case 'tournament_starting':
      // Tournament reminder
      break;
      
    case 'tip_received':
      // Someone tipped you
      break;
      
    case 'moderation_warning':
      // Moderation action
      break;
  }
};
```

## GraphQL API

For complex data fetching, Arena provides a GraphQL endpoint:

**Endpoint**: `https://api.arena.battle/v1/graphql`

### Sample Queries

#### Get User Profile with Stats
```graphql
query GetUserProfile($userId: UUID!) {
  user(id: $userId) {
    id
    username
    displayName
    bio
    avatarUrl
    tier
    reputationScore
    stats {
      wins
      losses
      winRate
      currentStreak
    }
    wallet {
      crownsBalance
      pointsBalance
    }
    recentBattles(first: 10) {
      edges {
        node {
          id
          status
          opponent {
            username
            tier
          }
          result
        }
      }
    }
  }
}
```

#### Get Tournament with Bracket
```graphql
query GetTournament($tournamentId: UUID!) {
  tournament(id: $tournamentId) {
    id
    name
    status
    prizePool
    participants {
      edges {
        node {
          user {
            username
            tier
          }
          seedNumber
          status
        }
      }
    }
    bracket {
      rounds {
        roundNumber
        matches {
          player1 {
            username
          }
          player2 {
            username
          }
          winner {
            username
          }
          status
        }
      }
    }
  }
}
```

## Error Handling

All API errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "username",
      "issue": "Username must be between 3-50 characters"
    },
    "request_id": "uuid"
  }
}
```

### Common Error Codes

- `AUTHENTICATION_REQUIRED`: Missing or invalid token
- `AUTHORIZATION_FAILED`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid input data
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SERVICE_UNAVAILABLE`: Temporary service issue

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Authentication**: 5 requests per minute
- **General API**: 100 requests per minute per user
- **Upload endpoints**: 10 requests per minute
- **WebSocket connections**: 5 concurrent connections per user

## SDKs and Libraries

Official SDKs will be provided for:
- JavaScript/TypeScript (web and Node.js)
- Python
- Swift (iOS)
- Kotlin (Android)

## API Versioning

The API is versioned using URL paths:
- `/v1/` - Current stable version
- `/v2/` - Next version (when available)

Backward compatibility is maintained for at least 6 months after deprecation.

