#!/bin/bash

# Script to set up Vercel environment variables
# This script will guide you through adding all necessary environment variables to Vercel

set -e

echo "=============================================="
echo "Vercel Environment Variables Setup"
echo "=============================================="
echo ""
echo "This script will add environment variables to your Vercel project."
echo "You'll be prompted to paste the value for each variable."
echo ""
echo "⚠️  Make sure you're logged in to Vercel CLI first!"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

# Function to add an environment variable
add_env_var() {
  local var_name=$1
  local var_value=$2
  local environments=${3:-"production,preview,development"}

  echo "Adding $var_name..."
  echo "$var_value" | vercel env add "$var_name" "$environments" --force
  if [ $? -eq 0 ]; then
    echo "✅ $var_name added successfully"
  else
    echo "❌ Failed to add $var_name"
  fi
  echo ""
}

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

# Link to project if not already linked
if [ ! -f ".vercel/project.json" ]; then
  echo "This directory is not linked to a Vercel project."
  echo "Linking to project..."
  vercel link
  echo ""
fi

echo "=============================================="
echo "Adding Environment Variables"
echo "=============================================="
echo ""

# Load environment variables from .env.local
if [ ! -f ".env.local" ]; then
  echo "❌ .env.local file not found!"
  echo "Please make sure you're running this script from the project root."
  exit 1
fi

# Source the .env.local file
set -a
source .env.local
set +a

# Add critical environment variables
echo "📦 Adding Database..."
add_env_var "DATABASE_URL" "$DATABASE_URL"

echo "📧 Adding Email (Resend)..."
add_env_var "RESEND_API_KEY" "$RESEND_API_KEY"
add_env_var "RESEND_FROM_EMAIL" "$RESEND_FROM_EMAIL"
add_env_var "EMAIL_FROM_NAME" "$EMAIL_FROM_NAME"

echo "🔐 Adding Encryption & Security..."
add_env_var "ENCRYPTION_KEY" "$ENCRYPTION_KEY"
add_env_var "CRON_SECRET" "$CRON_SECRET"

echo "🤖 Adding AI Services..."
add_env_var "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY"
add_env_var "MISTRAL_API_KEY" "$MISTRAL_API_KEY"

echo "📹 Adding Zoom SDK & API..."
add_env_var "ZOOM_SDK_KEY" "$ZOOM_SDK_KEY"
add_env_var "ZOOM_SDK_SECRET" "$ZOOM_SDK_SECRET"
add_env_var "NEXT_PUBLIC_ZOOM_SDK_KEY" "$NEXT_PUBLIC_ZOOM_SDK_KEY"
add_env_var "ZOOM_ACCOUNT_ID" "$ZOOM_ACCOUNT_ID"
add_env_var "ZOOM_CLIENT_ID" "$ZOOM_CLIENT_ID"
add_env_var "ZOOM_CLIENT_SECRET" "$ZOOM_CLIENT_SECRET"

echo "🔍 Adding Lead Generation APIs..."
add_env_var "APOLLO_API_KEY" "$APOLLO_API_KEY"
add_env_var "LUSHA_API_KEY" "$LUSHA_API_KEY"
add_env_var "CORESIGNAL_API_KEY" "$CORESIGNAL_API_KEY"
add_env_var "APIFY_API_TOKEN" "$APIFY_API_TOKEN"

echo "🌍 Adding Application URL (production only)..."
echo "https://your-production-domain.com" | vercel env add "NEXT_PUBLIC_APP_URL" "production" --force
echo "⚠️  Note: Update NEXT_PUBLIC_APP_URL with your actual production domain!"
echo ""

echo "=============================================="
echo "✅ Environment Variables Setup Complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo "1. Update NEXT_PUBLIC_APP_URL with your actual production domain:"
echo "   vercel env rm NEXT_PUBLIC_APP_URL production"
echo "   vercel env add NEXT_PUBLIC_APP_URL production"
echo "   (then enter your actual domain like https://talentforge.com)"
echo ""
echo "2. Deploy your application:"
echo "   vercel --prod"
echo ""
echo "3. View all environment variables:"
echo "   vercel env ls"
echo ""
echo "⚠️  SECURITY REMINDER:"
echo "Before going live, rotate your Zoom credentials (SDK Secret and Client Secret)"
echo "since they were shared publicly."
echo ""
