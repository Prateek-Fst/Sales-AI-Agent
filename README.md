<img src="/public/images/logo.png" alt="logo" width="300" height="150">

# Sales-AI

## Introduction

An AI-powered chatbot designed to enhance customer engagement by providing customizable interactions. Sales-AI leverages Groq's LLaMA model for natural language processing to understand user queries and respond intelligently. It allows business owners to personalize the chatbot's functionality, including custom greetings, email collection, real-time live chat handoff, appointment booking, and product payments — all backed by MongoDB.

## Tech Stack

- **Framework** — Next.js 14 (App Router)
- **Database** — MongoDB (via native MongoDB driver)
- **Auth** — Custom JWT-based authentication (bcryptjs + jsonwebtoken)
- **AI** — Groq SDK (LLaMA 3.3 70B)
- **Real-time** — Polling (replaces Pusher)
- **Payments** — Stripe
- **File Uploads** — UploadCare
- **Email** — Nodemailer (Gmail)
- **UI** — Tailwind CSS + Radix UI + shadcn/ui

## Getting Started

### Clone the Repository

```bash
git clone git@github.com:Maheshwarreddy970/Sales-ai.git
cd Sales-ai
```

### Environment Variables

Create a `.env` file in the root of the project and fill in your credentials:

```bash
cp .env.example .env
```

### .env.example

```bash
# App URL (change to your production URL when deploying)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/sales-ai
MONGODB_DB_NAME=sales-ai

# NodeMailer (Gmail)
NODE_MAILER_EMAIL=your_email@gmail.com
NODE_MAILER_GMAIL_APP_PASSWORD=your_gmail_app_password

# Stripe
STRIPE_SECRET=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISH_KEY=your_stripe_publishable_key

# UploadCare
NEXT_PUBLIC_UPLOAD_CARE_PUBLIC_KEY=your_uploadcare_public_key

# Groq AI
GROQ_API_KEY=your_groq_api_key

# JWT
JWT_SECRET=your_jwt_secret_key
```

### Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

### Development

```bash
npm run dev
# or
bun dev
```

Navigate to [http://localhost:3000](http://localhost:3000) to view the application.

### Production Build

```bash
npm run build
npm run start
```

## Project Structure

```plaintext
Sales-ai/
│
├── public/                         # Public assets (images, fonts, etc.)
├── src/
│   ├── actions/                    # Server actions
│   │   ├── appointment/            # Booking logic
│   │   ├── auth/                   # Auth helpers
│   │   ├── bot/                    # AI chatbot logic (Groq)
│   │   ├── conversation/           # Chat room & polling messages
│   │   ├── dashboard/              # Dashboard stats
│   │   ├── landing/                # Blog post fetching
│   │   ├── mail/                   # Email marketing campaigns
│   │   ├── mailer/                 # Nodemailer transporter
│   │   ├── payments/               # Stripe payment intents
│   │   ├── settings/               # Domain & chatbot settings
│   │   └── stripe/                 # Stripe subscription management
│   ├── app/                        # Next.js App Router pages & API routes
│   │   ├── (dashboard)/            # Protected dashboard pages
│   │   ├── api/                    # API routes (auth, stripe)
│   │   ├── auth/                   # Sign-in / Sign-up pages
│   │   ├── blogs/                  # Blog post pages
│   │   ├── chatbot/                # Embeddable chatbot iframe page
│   │   └── portal/                 # Customer appointment & payment portal
│   ├── components/                 # Reusable UI components
│   ├── constants/                  # App-wide constants
│   ├── context/                    # React context providers
│   ├── hooks/                      # Custom React hooks
│   ├── icons/                      # SVG icon components
│   ├── lib/
│   │   ├── auth.ts                 # getCurrentUser via JWT cookie
│   │   ├── db.ts                   # MongoDB client wrapper
│   │   ├── jwt.ts                  # JWT sign/verify
│   │   ├── models.ts               # MongoDB collection names & types
│   │   ├── mongodb.ts              # MongoDB connection
│   │   └── utils.ts                # Utility functions
│   ├── schemas/                    # Zod validation schemas
│   └── middleware.ts               # Route middleware
├── .env                            # Environment variables (do not commit)
├── .env.example                    # Environment variable template
├── .eslintrc.json
├── next.config.mjs
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Key Features

- **AI Chatbot** — Embedded via iframe, powered by Groq LLaMA. Collects customer emails, answers filter questions, and escalates to live mode.
- **Live Chat Handoff** — Owner can take over any conversation in real-time. Uses 3-second polling instead of WebSockets (no external service needed).
- **Appointment Booking** — Customers can book time slots through a portal link sent by the AI.
- **Product Payments** — Stripe-powered checkout via portal link.
- **Email Marketing** — Create campaigns, add customers, send bulk emails with credit tracking.
- **Multi-domain Support** — Each user can manage multiple domains with separate chatbots.
- **Subscription Plans** — STANDARD / PRO / ULTIMATE tiers with domain and credit limits.
