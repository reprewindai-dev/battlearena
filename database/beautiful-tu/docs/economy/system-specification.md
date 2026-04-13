# Economy System Specification

## Overview

Arena's economy is designed to be fair, transparent, and sustainable while avoiding the pitfalls of traditional social media monetization. The dual-currency model separates reputation from commercial value.

## Currency Architecture

### Crowns (Reputation Currency)
- **Purpose**: Non-transferable reputation points
- **Acquisition**: Battles, mentorship, community contributions
- **Usage**: Cosmetics, status features, utilities
- **Properties**: No cash value, cannot be transferred, earned through participation

### Tokens (Consumable Support Credits)
- **Purpose**: Virtual goods for supporting creators
- **Acquisition**: Purchased with real currency
- **Usage**: Tipping, purchases, premium access
- **Properties**: No investment value, consumable, transparent pricing

### Points (Creator Earnings)
- **Purpose**: Internal ledger for creator payouts
- **Acquisition**: 90% of tokens spent by users
- **Usage**: Convert to fiat or spend on platform
- **Properties**: Real monetary value, requires KYC for payout

### Community Rewards Fund (CRF)
- **Purpose**: Platform-controlled community fund
- **Funding**: 5-15% of platform revenue
- **Usage**: Prizes, grants, emergency support
- **Properties**: Not user deposits, no expected returns

## Economic Flow Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Purchase │    │   Token Spending │    │   Creator Payout │
│                 │    │                 │    │                 │
│ Real Money →    │    │ Tokens →         │    │ Points →        │
│ Tokens          │    │ Points (90%) +   │    │ Real Money      │
│                 │    │ Platform (10%)   │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │              ┌───────┴───────┐              │
          │              │               │              │
          │              ▼               ▼              │
          │      ┌─────────────┐ ┌─────────────┐      │
          │      │   Points    │ │   Platform  │      │
          │      │ (Creator    │ │   Revenue   │      │
          │      │  Wallet)    │ │             │      │
          │      └─────────────┘ └─────────────┘      │
          │              │               │              │
          │              │               │              │
          │              ▼               ▼              │
          │      ┌─────────────────────────────┐      │
          │      │    Community Rewards Fund    │      │
          │      │      (5-15% of Revenue)     │      │
          │      └─────────────────────────────┘      │
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │   Community Distribution  │
                    │                           │
                    │ - Tournament Prizes       │
                    │ - Education Grants        │
                    │ - Emergency Assistance    │
                    │ - Infrastructure          │
                    └───────────────────────────┘
```

## Token Pricing Structure

### Token Packages
| Package | Tokens | Price (USD) | Bonus Tokens | Effective Rate |
|---------|--------|-------------|--------------|----------------|
| Starter | 100    | $1.00       | 0            | $0.010/token   |
| Basic   | 500    | $4.50       | 50           | $0.008/token   |
| Plus    | 1,000  | $8.00       | 200          | $0.0067/token  |
| Premium | 5,000  | $35.00      | 1,000        | $0.0058/token  |
| Elite   | 10,000 | $60.00      | 2,500        | $0.0048/token  |

### Spending Controls
- **Daily Limits**: $50 default, user-adjustable
- **Weekly Limits**: $200 default, user-adjustable  
- **Age Restrictions**: Under 18 limited to $10/week
- **Self-Exclusion**: Users can temporarily disable purchases
- **Cooling Period**: 24-hour waiting period for large purchases

## Revenue Distribution

### Token Spending Split
```
User spends 100 Tokens ($1.00 value):
├── Creator Points: 90 Tokens ($0.90)
├── Platform Revenue: 10 Tokens ($0.10)
│   ├── Operations: 60% ($0.06)
│   ├── CRF Contribution: 30% ($0.03)
│   └── Growth & Marketing: 10% ($0.01)
```

### Platform Revenue Allocation
- **Operations (60%)**: Server costs, salaries, tools
- **CRF (30%)**: Community rewards and initiatives
- **Growth (10%)**: Marketing and user acquisition

## Creator Economy

### Earning Mechanisms
1. **Battle Tips**: Direct token gifts from viewers
2. **Tournament Prizes**: CRF-funded prize pools
3. **Content Sales**: Beat packs, tutorials, merchandise
4. **Subscription Revenue**: Share of subscriber fees
5. **Sponsorship**: Platform-facilitated brand deals

### Payout Structure
```python
class CreatorEarnings:
    def __init__(self):
        self.points_balance = 0  # Internal ledger
        self.pending_payouts = 0
        self.total_earned = 0
        self.payout_history = []
    
    def add_earnings(self, tokens_spent: int):
        # 90% conversion rate
        points_earned = int(tokens_spent * 0.9)
        self.points_balance += points_earned
        self.total_earned += points_earned
        
        # Track for analytics
        self.track_earnings(tokens_spent, points_earned)
    
    def request_payout(self, amount_cents: int, method: str):
        if self.points_balance >= amount_cents:
            if self.kyc_verified:
                self.pending_payouts += amount_cents
                self.points_balance -= amount_cents
                return PayoutRequest(amount_cents, method)
            else:
                raise KYCRequiredError()
        else:
            raise InsufficientFundsError()
```

### Payout Process
1. **Creator requests payout** via dashboard
2. **KYC verification** if not already completed
3. **Fraud review** for large or unusual requests
4. **Processing** within 5 business days
5. **Payment** via selected method (bank transfer, PayPal, etc.)
6. **Tax documentation** provided (1099, etc.)

### Tax & Compliance
- **US Creators**: 1099-NEC for earnings > $600
- **Canadian Creators**: T4A for self-employed income
- **International**: Tax treaties and withholding
- **GST/HST**: Automatic collection for Canadian creators above threshold
- **Annual Statements**: Comprehensive tax reports

## Community Rewards Fund Management

### CRF Allocation Formula
```
Monthly CRF = Platform Revenue × CRF Percentage (5-15%)

Distribution:
├── Tournament Prizes: 60%
├── Education Grants: 20%
├── Emergency Assistance: 10%
├── Infrastructure: 5%
└── Rollover: 5%
```

### Community Voting
- **Voting Rights**: Convert Tokens or Crowns to votes (capped)
- **Voting Period**: Monthly allocation decisions
- **Proposal Types**: Prize structures, grant priorities, special events
- **Transparency**: All votes and decisions publicly logged

### Grant Programs
- **Creator Development**: Equipment, software, training
- **Community Projects**: Local events, workshops
- **Emergency Support**: Medical, financial hardship
- **Educational Initiatives**: School programs, scholarships

## Monetization Channels

### Primary Revenue: Token Sales
- **Expected Volume**: Based on user engagement patterns
- **Conversion Rate**: 5-10% of active users purchase tokens
- **Average Spend**: $15-25 per month per paying user
- **Growth Drivers**: Battle quality, creator engagement, events

### Secondary Revenue: Subscriptions
#### Basic Tier ($4.99/month)
- Ad-light experience
- Limited replay access
- Monthly token stipend (50 tokens)
- Basic profile customization

#### Plus Tier ($9.99/month)
- No advertisements
- Full replay library
- Monthly token stipend (150 tokens)
- Advanced analytics
- Priority tournament entry

#### Creator Tier ($19.99/month)
- All Plus features
- Advanced creator tools
- Higher token stipend (300 tokens)
- Promotion opportunities
- Direct support access

### Tertiary Revenue: PPV Events
- **Celebrity Battles**: $4.99-9.99 per event
- **Championship Finals**: $9.99-19.99 per event
- **Special Tournaments**: Variable pricing
- **Revenue Share**: 70% to creators/participants

### Quaternary Revenue: Partnerships
- **Sponsored Tournaments**: Brand-sponsored events
- **Beat Licensing**: Producer partnerships
- **Educational Content**: Course revenue sharing
- **Merchandise**: Platform-branded products

## Economic Modeling

### User Lifetime Value (LTV)
```python
def calculate_ltv(user_data):
    # Base assumptions
    avg_monthly_spend = user_data.spend_tier.monthly_amount
    retention_rate = 0.85  # 85% monthly retention
    months_active = 24  # 2-year average lifespan
    
    # Calculate LTV
    ltv = 0
    for month in range(months_active):
        monthly_value = avg_monthly_spend * (retention_rate ** month)
        ltv += monthly_value
    
    return ltv

# Example calculations
# Casual User: $15/month → LTV ≈ $127
# Regular User: $50/month → LTV ≈ $425  
# Super User: $200/month → LTV ≈ $1,700
```

### Platform Revenue Projections
```
Year 1 (10K MAU, 1K paying users):
- Token Revenue: $180,000
- Subscription Revenue: $60,000
- PPV Revenue: $30,000
- Partnership Revenue: $20,000
- Total Revenue: $290,000

Year 2 (50K MAU, 7.5K paying users):
- Token Revenue: $1,350,000
- Subscription Revenue: $450,000
- PPV Revenue: $225,000
- Partnership Revenue: $150,000
- Total Revenue: $2,175,000

Year 3 (200K MAU, 40K paying users):
- Token Revenue: $7,200,000
- Subscription Revenue: $2,400,000
- PPV Revenue: $1,200,000
- Partnership Revenue: $800,000
- Total Revenue: $11,600,000
```

## Fraud Prevention & Risk Management

### Detection Systems
- **Behavioral Analysis**: Unusual spending patterns
- **Device Fingerprinting**: Multiple account detection
- **Transaction Monitoring**: Suspicious payment activity
- **Social Graph Analysis**: Collusion detection

### Prevention Measures
- **Purchase Limits**: Daily/weekly spending caps
- **Verification Requirements**: KYC for high-value activities
- **Cooling Periods**: Delay for large transactions
- **Review Processes**: Manual review of suspicious activity

### Response Protocols
1. **Immediate Action**: Freeze suspicious accounts
2. **Investigation**: Detailed analysis of patterns
3. **Communication**: Notify affected users
4. **Resolution**: Refunds, account actions, policy updates
5. **Prevention**: System improvements based on findings

## Economic Governance

### Policy Oversight
- **Economic Council**: Elected user representatives
- **Trust & Safety Board**: Independent oversight
- **Financial Compliance**: Legal and regulatory review
- **Community Voting**: Direct input on economic decisions

### Transparency Requirements
- **Monthly Reports**: Revenue breakdown, CRF allocation
- **Annual Audits**: Financial statement verification
- **Policy Changes**: Advance notice and rationale
- **Decision Logs**: Public record of economic decisions

### Adjustment Mechanisms
- **Dynamic Pricing**: Token package optimization
- **Revenue Split Reviews**: Regular assessment of fairness
- **CRF Percentage**: Community-voted adjustments
- **Policy Updates**: Responsive to market conditions

## Technical Implementation

### Database Schema
```sql
-- Token purchases
CREATE TABLE token_purchases (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    tokens_purchased INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    payment_provider VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Token transactions
CREATE TABLE token_transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    recipient_id UUID,
    tokens_spent INTEGER NOT NULL,
    points_earned INTEGER NOT NULL,
    platform_share INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    reference_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Creator wallets
CREATE TABLE creator_wallets (
    user_id UUID PRIMARY KEY,
    points_balance BIGINT DEFAULT 0,
    total_earned BIGINT DEFAULT 0,
    total_paid_out BIGINT DEFAULT 0,
    kyc_status VARCHAR(20) DEFAULT 'none',
    payout_method JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
- `POST /economy/tokens/purchase` - Buy tokens
- `POST /economy/tokens/spend` - Spend tokens
- `GET /economy/wallet` - Get wallet balance
- `POST /economy/payouts/request` - Request payout
- `GET /economy/transactions` - Transaction history

### Integration Points
- **Payment Processors**: Stripe, PayPal, App Store
- **Fraud Detection**: Stripe Radar, custom rules
- **Analytics**: Revenue tracking, user behavior
- **Compliance**: Tax reporting, KYC services

This economy system creates a sustainable, fair, and transparent financial ecosystem that rewards creators while protecting users from exploitative practices.
yes
