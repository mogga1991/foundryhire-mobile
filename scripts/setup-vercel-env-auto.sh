#!/bin/bash

# Automated Vercel Environment Variables Setup (Non-Interactive)
# This script will automatically add all environment variables to Vercel

set -e

echo "=============================================="
echo "Vercel Environment Variables Setup (Automated)"
echo "=============================================="
echo ""

# Check if user is logged in
echo "Checking Vercel authentication..."
if ! vercel whoami &> /dev/null; then
  echo "❌ You're not logged in to Vercel."
  echo "Please run: vercel login"
  exit 1
fi

VERCEL_USER=$(vercel whoami)
echo "✅ Logged in as: $VERCEL_USER"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
  echo "❌ .env.local file not found!"
  echo "Please make sure you're running this script from the project root."
  exit 1
fi

# Source the .env.local file
set -a
source .env.local
set +a

echo "=============================================="
echo "Adding Environment Variables"
echo "=============================================="
echo ""

# Function to add environment variable with error handling
add_env() {
  local name=$1
  local value=$2

  if [ -z "$value" ]; then
    echo "⏭️  Skipping $name (not set in .env.local)"
    return
  fi

  echo "📌 Adding $name..."
  if echo "$value" | vercel env add "$name" production preview development --force --yes 2>/dev/null; then
    echo "   ✅ Added successfully"
  else
    echo "   ⚠️  Failed or already exists"
  fi
}

# Core variables
echo "🗄️  Database..."
add_env "DATABASE_URL" "$DATABASE_URL"

echo ""
echo "📧 Email (Resend)..."
add_env "RESEND_API_KEY" "$RESEND_API_KEY"
add_env "RESEND_FROM_EMAIL" "$RESEND_FROM_EMAIL"
add_env "EMAIL_FROM_NAME" "$EMAIL_FROM_NAME"

echo ""
echo "🔐 Encryption & Security..."
add_env "ENCRYPTION_KEY" "$ENCRYPTION_KEY"
add_env "CRON_SECRET" "$CRON_SECRET"

echo ""
echo "🤖 AI Services..."
add_env "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY"
add_env "MISTRAL_API_KEY" "$MISTRAL_API_KEY"

echo ""
echo "📹 Zoom SDK & API..."
add_env "ZOOM_SDK_KEY" "$ZOOM_SDK_KEY"
add_env "ZOOM_SDK_SECRET" "$ZOOM_SDK_SECRET"
add_env "NEXT_PUBLIC_ZOOM_SDK_KEY" "$NEXT_PUBLIC_ZOOM_SDK_KEY"
add_env "ZOOM_ACCOUNT_ID" "$ZOOM_ACCOUNT_ID"
add_env "ZOOM_CLIENT_ID" "$ZOOM_CLIENT_ID"
add_env "ZOOM_CLIENT_SECRET" "$ZOOM_CLIENT_SECRET"

echo ""
echo "🔍 Lead Generation APIs..."
add_env "APOLLO_API_KEY" "$APOLLO_API_KEY"
add_env "LUSHA_API_KEY" "$LUSHA_API_KEY"
add_env "CORESIGNAL_API_KEY" "$CORESIGNAL_API_KEY"
add_env "APIFY_API_TOKEN" "$APIFY_API_TOKEN"

echo ""
echo "🌍 Application Settings..."
# Set a placeholder for production domain
if echo "https://your-domain.vercel.app" | vercel env add "NEXT_PUBLIC_APP_URL" production --force --yes 2>/dev/null; then
  echo "📌 Adding NEXT_PUBLIC_APP_URL..."
  echo "   ⚠️  Set to placeholder - update with your actual domain!"
fi

echo ""
echo "=============================================="
echo "✅ Environment Variables Setup Complete!"
echo "=============================================="
echo ""
echo "📋 Summary:"
vercel env ls 2>/dev/null | head -20 || echo "Run 'vercel env ls' to see all variables"
echo ""
echo "🚀 Next steps:"
echo "1. Update production domain:"
echo "   vercel env rm NEXT_PUBLIC_APP_URL production"
echo "   echo 'https://your-actual-domain.com' | vercel env add NEXT_PUBLIC_APP_URL production"
echo ""
echo "2. Deploy to production:"
echo "   vercel --prod"
echo ""
echo "⚠️  Security reminder: Rotate Zoom credentials before production use!"
echo ""
