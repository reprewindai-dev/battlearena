# Arena v2 - Community Battle Network

A comprehensive platform for live creative battles, combining real-time competition, fair economy, and community governance.

## Monorepo Runbook (Local)

Prereqs:

- Node.js 20+

From the repo root:

```powershell
npm install
npm run dev
```

Open:

- `http://127.0.0.1:3000`

Run Playwright smoke tests:

```powershell
npm test
```

Environment:

- Copy `.env.example` to `.env` (repo root) or create `apps/web/.env.local`.
- If `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not set, the web app uses cookie-based mock auth.

## Vision

Arena replaces passive social media feeds with authentic participatory experiences where skills and engagement matter. We own the freestyle/battle niche first, then expand to other creative forms while setting standards for fairness, safety, and community ownership.

## Core Pillars

- **Live Battle Engine**: Real-time and asynchronous battles with fair scoring
- **Progression & Reputation**: Tier-based ranking and community reputation
- **Community Structures**: Crews, mentorship, and education
- **Responsible Economy**: Dual-currency model with transparent rewards
- **Governance & Participation**: Community voting and transparent decision-making
- **Safety & Trust**: Proactive moderation and clear guidelines

## Quick Start

1. Review the [Architecture Overview](docs/architecture/overview.md)
2. Set up development environment following [Development Guide](docs/development/setup.md)
3. Explore [API Documentation](docs/api/README.md)
4. Check [Implementation Timeline](docs/implementation/timeline.md)

## Project Structure

```
arena-v2/
├── docs/                    # Documentation
│   ├── architecture/        # Technical architecture
│   ├── api/                # API specifications
│   ├── implementation/     # Implementation guides
│   ├── governance/         # Governance frameworks
│   ├── moderation/         # Safety and moderation
│   └── economy/           # Economy specifications
├── backend/                # Microservices backend
│   ├── auth-service/
│   ├── battle-service/
│   ├── economy-service/
│   ├── moderation-service/
│   └── tournament-service/
├── frontend/               # Web application
├── mobile/                # Mobile apps (React Native/Flutter)
├── infrastructure/         # DevOps and deployment
├── ai/                    # AI models and services
└── playbooks/            # Operational playbooks
```

## Key Features

- **Real-time Audio Battles**: WebRTC-based low-latency battles
- **Fair Rating System**: Glicko-2 algorithm with transparent calculations
- **Dual Currency Economy**: Crowns (reputation) + Tokens (consumable)
- **AI-Powered Moderation**: Automated content filtering with human oversight
- **Tournament System**: Weekly tournaments and PPV events
- **Community Governance**: User councils and transparent decision-making

## Getting Involved

This is a comprehensive blueprint ready for execution. Each module is designed to be developed independently while maintaining system coherence.

## License

Proprietary - See LICENSE file for details
