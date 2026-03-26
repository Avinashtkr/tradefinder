# TradeFinder — Production-Grade Stock Market Scanner

Real-time NSE/BSE intraday scanner with momentum signals, ORB breakouts, OI analysis, sector heatmaps, and a full backtesting engine.

---

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env
# Add KITE_API_KEY / KITE_ACCESS_TOKEN (or leave blank for Yahoo Finance dev mode)

# 2. Launch full stack
cd infra/docker
docker compose up -d

# 3. Visit
http://localhost        ← App (via Nginx)
http://localhost:8000   ← FastAPI docs
```

---

## Folder Structure

```
tradefinder/
├── backend/
│   ├── app/
│   │   ├── main.py                   ← FastAPI entry, lifespan startup
│   │   ├── api/v1/
│   │   │   ├── auth.py               ← Register, login, refresh, /me
│   │   │   ├── stocks.py             ← Quotes, sectors, gainers/losers
│   │   │   ├── screener.py           ← Screener run + presets
│   │   │   ├── signals.py            ← Signal history + alert CRUD
│   │   │   └── backtest.py           ← Backtest run + history
│   │   ├── core/
│   │   │   ├── config.py             ← All settings (pydantic-settings)
│   │   │   ├── security.py           ← JWT, bcrypt
│   │   │   ├── deps.py               ← FastAPI DI (auth, market svc)
│   │   │   └── redis_client.py       ← Async Redis wrapper
│   │   ├── db/session.py             ← SQLAlchemy async engine
│   │   ├── models/models.py          ← All ORM models
│   │   ├── services/
│   │   │   ├── market_data.py        ← Kite/Yahoo feed + Redis publish
│   │   │   ├── backtest_engine.py    ← Event-driven backtester
│   │   │   └── signal_broadcaster.py← Redis sub → WebSocket fan-out
│   │   ├── strategies/engine.py      ← All algo logic
│   │   └── websockets/
│   │       ├── manager.py            ← WS connection manager
│   │       └── routes.py             ← /ws endpoint
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   ← Routes + auth guard
│   │   ├── main.jsx                  ← React entry
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx         ← Main view (table/heatmap/chart)
│   │   │   ├── Screener.jsx          ← Filter UI + results table
│   │   │   ├── Signals.jsx           ← Signal history + stats
│   │   │   ├── Backtest.jsx          ← Strategy tester UI
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Layout.jsx        ← Sidebar + main layout
│   │   │   │   └── MarketClock.jsx   ← Live IST clock + market status
│   │   │   ├── dashboard/
│   │   │   │   ├── LiveStockTable.jsx← Core live table with flash cells
│   │   │   │   ├── SignalFeed.jsx    ← Real-time signal panel
│   │   │   │   └── SectorHeatmap.jsx← Color-coded sector grid
│   │   │   └── charts/
│   │   │       └── TradingViewWidget.jsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js       ← Auto-reconnect WS hook
│   │   │   └── useAuth.js            ← Auth + feature gating
│   │   ├── store/
│   │   │   ├── index.js              ← Redux store
│   │   │   ├── marketSlice.js        ← Quotes, signals, sectors
│   │   │   ├── authSlice.js          ← User auth state
│   │   │   └── screenerSlice.js      ← Screener filters + results
│   │   └── services/api.js           ← Axios + JWT refresh interceptor
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
│
└── infra/
    ├── docker/docker-compose.yml
    └── nginx/nginx.conf
```

---

## Strategy Engine — Algorithms

### 1. Opening Range Breakout (ORB) — 9:15 to 9:25 AM
- Collects first 10 minutes of bars as the "opening range"
- Detects breakout above ORB high (bullish) or below ORB low (bearish)
- **Requires** volume ≥ 2× expected volume (surge confirmation)
- Confidence formula: `0.5 + 0.2 × vol_ratio_factor + 0.15 × risk_reward`

### 2. Volume Breakout Detector
- Computes 20-day average volume
- Fires when current volume ≥ 2.5× average
- Z-score used to weight confidence

### 3. Sector Strength Ranker
- Aggregates change_pct by sector from live quotes
- Ranks sectors: Very Strong / Strong / Neutral / Weak / Very Weak
- Used by screener for sector-relative filters

### 4. Relative Strength (RS) Scoring
- RS = (1 + stock_return_63d) / (1 + nifty_return_63d)
- RS > 1.0 = outperforming, < 1.0 = underperforming

### 5. Option Chain Analysis
- **PCR** (Put-Call Ratio): > 1.2 = bullish, < 0.8 = bearish
- **Long Buildup**: OI ↑ + Price ↑ → bulls adding positions
- **Short Buildup**: OI ↑ + Price ↓ → bears adding positions
- **Max Pain**: strike price where option writers lose least

### 6. Technical Indicators (pure Python, no pandas required)
- EMA, SMA, RSI (14), ATR, VWAP (session), Bollinger Bands, Supertrend

---

## Market Data Integration

### Production: Zerodha Kite WebSocket
```env
KITE_API_KEY=your_key
KITE_ACCESS_TOKEN=your_daily_token  # Refresh daily via Kite login flow
```

### Development Fallback: Yahoo Finance
Set no Kite credentials → system auto-falls back to Yahoo Finance polling (5s interval).
Covers full NSE universe.

### Adding Upstox:
Implement `UpstoxFeed` class in `market_data.py` inheriting the same `on_tick` interface.

---

## WebSocket Protocol

Client connects to `ws://host/ws?token=<jwt>`

**Server → Client messages:**
```json
{ "type": "tick",    "data": { "symbol": "RELIANCE", "ltp": 2845.5, "change_pct": 1.2, ... } }
{ "type": "signal",  "data": { "symbol": "TCS", "signal_type": "bullish_breakout", "confidence": 0.87, ... } }
{ "type": "connected","data": { "authenticated": true } }
{ "type": "pong" }
```

**Client → Server messages:**
```json
{ "action": "subscribe", "channel": "broadcast" }
{ "action": "subscribe", "channel": "watchlist:my-list" }
{ "action": "filter",    "filters": { "sectors": ["IT", "Banking"] } }
{ "action": "ping" }
```

---

## Database Schema Summary

| Table | Purpose |
|---|---|
| `users` | Auth, subscription tier |
| `refresh_tokens` | JWT refresh rotation |
| `stocks` | NSE/BSE master list |
| `quotes` | Persisted tick snapshots |
| `ohlcv` | OHLCV bars (TimescaleDB hypertable) |
| `signals` | Generated strategy signals |
| `watchlists` | User watchlists (JSON symbol array) |
| `alerts` | Price/signal alert rules |
| `backtest_runs` | Backtest results + S3 key |

---

## Subscription Tiers

| Feature | Free | Basic (₹499/mo) | Premium (₹1499/mo) |
|---|---|---|---|
| Live market feed | ✓ | ✓ | ✓ |
| Basic signals (ORB, Vol) | ✓ | ✓ | ✓ |
| Screener (5 filters) | ✓ | ✓ | ✓ |
| Advanced screener presets | — | ✓ | ✓ |
| Backtest (all strategies) | — | ✓ | ✓ |
| Option chain analysis | — | — | ✓ |
| Premium signals (RS, OI) | — | — | ✓ |
| API access | — | — | ✓ |
| Watchlists | 1 | 5 | Unlimited |
| Alerts | 3 | 20 | Unlimited |

---

## Scaling to 100,000 Users

### Phase 1 — 0–1K users (current architecture)
- Single backend + Nginx + Redis on a DigitalOcean Droplet or EC2 t3.medium
- TimescaleDB on same server or managed RDS
- Cost: ~$50–100/month

### Phase 2 — 1K–10K users
- **Horizontal scale**: 3 FastAPI workers behind ALB
- **Redis Cluster**: ElastiCache r6g.large (pub/sub + caching)
- **Read replicas**: RDS Aurora PostgreSQL + TimescaleDB read replica
- **CDN**: CloudFront for static frontend (Vercel or S3 + CF)
- **Celery**: Separate EC2 workers for backtest jobs
- Cost: ~$400–800/month

### Phase 3 — 10K–100K users
- **Microservices split**: Separate services for tick ingest, signal engine, user API
- **Kafka** replaces Redis pub/sub for durable tick stream (MSK)
- **WebSocket gateway**: AWS API Gateway WebSocket or dedicated WS cluster (socket.io with Redis adapter)
- **TimescaleDB** → migrate to InfluxDB or Amazon Timestream for pure tick data
- **Auto-scaling**: ECS Fargate with target tracking (CPU > 60% → scale out)
- **Global CDN**: Multi-region deployment (Mumbai + Singapore)
- **Rate limiting**: AWS WAF + custom Lua script in Nginx
- Cost: ~$2,000–5,000/month

### Key bottlenecks and solutions:
1. **WebSocket fan-out**: Use Redis pub/sub → dedicated broadcaster process. At 10K concurrent connections, use 4 broadcaster pods behind an NLB
2. **Tick ingestion**: Single Kite WS → normalize → Kafka topic → multiple consumer groups (signal engine, DB writer, broadcaster)
3. **DB writes**: Batch OHLCV inserts with TimescaleDB hypertable chunking (1-day chunks)
4. **Backtest**: Move to async Celery tasks → results stored in S3 → pre-signed URL returned to client

---

## Environment Variables (.env)

```env
# Required
SECRET_KEY=your-super-secret-32-char-key-here
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/tradefinder
REDIS_URL=redis://localhost:6379/0

# Market data (leave blank for Yahoo Finance dev mode)
KITE_API_KEY=
KITE_ACCESS_TOKEN=

# AWS (for backtest result storage)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=tradefinder-backtest-results
AWS_REGION=ap-south-1

# Optional
ENVIRONMENT=development
```

---

## API Endpoints Reference

```
POST /api/v1/auth/register     Create account
POST /api/v1/auth/login        JWT login
POST /api/v1/auth/refresh      Refresh token rotation
GET  /api/v1/auth/me           Current user

GET  /api/v1/stocks/quotes     All live quotes
GET  /api/v1/stocks/quote/:sym Single live quote
GET  /api/v1/stocks/sectors    Sector performance
GET  /api/v1/stocks/top-gainers
GET  /api/v1/stocks/top-losers

POST /api/v1/screener/run      Run screener with filters
GET  /api/v1/screener/presets  Pre-built screener presets

GET  /api/v1/signals/recent    Signal history
GET  /api/v1/signals/stats     Session signal counts
POST /api/v1/signals/alerts    Create price alert
GET  /api/v1/signals/alerts    List user alerts
DEL  /api/v1/signals/alerts/:id Delete alert

POST /api/v1/backtest/run      Run backtest
GET  /api/v1/backtest/history  Past backtest runs

WS   /ws?token=<jwt>           Live feed WebSocket
GET  /health                   Health check
```

---

## Monetization Strategy

1. **SaaS Subscriptions**: Free / Basic / Premium tiers (see table above)
2. **API Access** (Premium): Developers pay to build their own tools on your feed
3. **White-label** to brokers: Sell the scanner as an embedded widget to brokers
4. **Education**: Paid courses on "reading signals" bundled with Premium
5. **Alert notifications**: Telegram bot, WhatsApp integration as premium add-ons
6. **Payment integration**: Razorpay (India-first) for INR subscriptions

---

## Deployment to AWS / Vercel

### Frontend → Vercel
```bash
cd frontend
npm run build
# Push to GitHub → connect to Vercel → auto-deploy on push
# Set VITE_API_URL=https://api.tradefinder.in
# Set VITE_WS_URL=wss://api.tradefinder.in/ws
```

### Backend → AWS ECS
```bash
# Build and push Docker image
docker build -t tradefinder-backend ./backend
docker tag tradefinder-backend:latest <ecr-uri>/tradefinder-backend:latest
docker push <ecr-uri>/tradefinder-backend:latest
# Deploy via ECS task definition or Copilot CLI
```

### Quick EC2 deploy
```bash
ssh ubuntu@your-ec2-ip
git clone https://github.com/you/tradefinder
cd tradefinder/infra/docker
docker compose up -d
# Set up SSL: certbot --nginx -d tradefinder.in
```
