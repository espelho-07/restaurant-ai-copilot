# AI Restaurant Copilot

AI-powered revenue optimization platform for restaurants. Analyzes menu data, sales patterns, and pricing to maximize profit.

## Features

- **9 AI Intelligence Modules** — Contribution Margin, Item Profitability, Sales Velocity, Hidden Stars, Low-Margin Risk, Combo Engine, Smart Upsell, Price Optimization, Inventory Signals
- **POS Integration** — Connect Petpooja, POSist, UrbanPiper, or any POS via API
- **CSV Import** — Fallback upload for menu and order data
- **Real-time Dashboard** — Live POS feed, revenue charts, AI insights
- **Voice Copilot** — Natural language queries for menu analytics

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS + Framer Motion
- Recharts for data visualization
- Sonner for toast notifications

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

## Project Structure

```
src/
├── components/    # Reusable UI components
├── lib/           # Data layer, AI engine, POS service
├── pages/         # Route pages (Dashboard, Setup, Modules, etc.)
└── hooks/         # Custom React hooks
```
