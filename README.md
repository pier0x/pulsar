# Pulsar

**Your Wealth, One Dashboard** — The all-in-one personal finance platform for the future.

Pulsar is a modern, open-source personal finance platform designed to help you track and manage all your assets in one beautiful interface. From crypto wallets to stock portfolios, staking rewards to secure vaults — Pulsar brings everything together.

## Vision

The financial landscape is evolving. Traditional banks, DeFi protocols, stock brokerages, and crypto exchanges — your wealth is scattered everywhere. Pulsar aims to be the unified dashboard that connects it all, giving you a complete picture of your financial life.

## Features

### Available Now
- 🔐 **Multi-chain Crypto Tracking** — Monitor wallets across Ethereum, Bitcoin, Solana, Arbitrum, Base, and Polygon
- 📊 **Real-time Portfolio Analytics** — Beautiful charts and breakdowns of your holdings
- 🔑 **Bring Your Own Keys** — Use your own API keys (Alchemy, Helius) for maximum control
- 👤 **Per-user Settings** — Each user has their own API keys, preferences, and wallets
- 🔄 **Automated Refresh** — Scheduled balance updates throughout the day
- 🎨 **Modern UI** — Clean, responsive design that works on any device

### Coming Soon
- 📈 **Stock Portfolio Tracking** — Connect your brokerage accounts
- 💰 **Staking & Yield Tracking** — Monitor DeFi positions and staking rewards
- 🏦 **Vault Management** — Track savings, CDs, and secure holdings
- 📱 **Mobile App** — Native iOS and Android apps
- 🔗 **Account Aggregation** — Connect banks, brokerages, and exchanges
- 📉 **Tax Reporting** — Generate reports for tax season

## Tech Stack

- **Framework:** [Remix](https://remix.run/) with React
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) v4
- **Database:** PostgreSQL with [Prisma](https://prisma.io/) ORM
- **UI Components:** Custom components with [Headless UI](https://headlessui.com/)
- **Animations:** [Framer Motion](https://framer.com/motion/)
- **Blockchain APIs:** Alchemy, Helius, CoinGecko

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Alchemy API key (for EVM chains)
- Helius API key (for Solana)

### Installation

1. Clone the repository
```bash
git clone https://github.com/pier0x/pulsar.git
cd pulsar
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your database URL and other settings
```

4. Run database migrations
```bash
npx prisma migrate deploy
```

5. Start the development server
```bash
npm run dev
```

### Deployment

Pulsar can be deployed to any platform that supports Node.js:

- **Railway** — One-click deploy with PostgreSQL
- **Vercel** — Serverless deployment
- **Docker** — Container-based deployment
- **Self-hosted** — Run on your own server

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License — see [LICENSE](LICENSE) for details.

---

**Pulsar** — The future of personal finance 🚀
