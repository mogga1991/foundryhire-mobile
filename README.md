# VerticalHire

A modern construction workforce management platform built with Next.js, custom authentication, and Neon PostgreSQL.

## Features

- **Secure Authentication** - Custom database-backed authentication with email/password
- **Candidate Management** - Comprehensive candidate tracking and management
- **Dashboard Analytics** - Real-time insights into your workforce
- **Job Pipeline** - Visual pipeline management for job postings and candidates
- **Email Integration** - Automated email notifications via Resend
- **Modern UI** - Built with Tailwind CSS and shadcn/ui components
- **Dark Mode** - Full dark mode support with next-themes

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Neon PostgreSQL with Drizzle ORM
- **Authentication**: Custom (database-backed sessions)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Email**: Resend
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- A Neon PostgreSQL database
- A Resend account

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd verticalhire
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual values:
- Neon database URL (from https://neon.tech)
- Resend API key (from https://resend.com)

4. Run database migrations:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
verticalhire/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── (auth)/       # Authentication pages
│   │   ├── (dashboard)/  # Dashboard pages
│   │   └── api/          # API routes
│   ├── components/       # React components
│   │   ├── ui/           # shadcn/ui components
│   │   ├── auth/         # Auth-related components
│   │   ├── dashboard/    # Dashboard components
│   │   └── ...
│   ├── lib/              # Utilities and configurations
│   │   ├── db/           # Database schema and utilities
│   │   └── utils/        # Helper functions
│   └── styles/           # Global styles
├── public/               # Static assets
├── drizzle/              # Database migrations
└── e2e/                  # End-to-end tests

```

## Environment Variables

See `.env.example` for all required environment variables.

Required variables:
- `DATABASE_URL` - Neon PostgreSQL connection string
- `RESEND_API_KEY` - Resend API key
- `NEXT_PUBLIC_APP_URL` - Your application URL

## Deployment

This application is designed to be deployed on Vercel:

1. Push your code to GitHub
2. Import the project in Vercel
3. Add all environment variables from `.env.example`
4. Deploy

For detailed Vercel setup, see `VERCEL_ENV_SETUP.md`.

## Database Schema

The application uses Drizzle ORM for type-safe database queries. Schema definitions are in `src/lib/db/schema.ts`.

## License

Private - All Rights Reserved

## Support

For issues or questions, please contact the development team.
