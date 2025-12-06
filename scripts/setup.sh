#!/bin/bash

set -e

echo "🚀 Pulsar Setup"
echo ""

# Check if .env already exists
if [ -f .env ]; then
  echo "⚠️  .env already exists."
  read -p "Do you want to regenerate it? This will overwrite existing secrets. (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Keeping existing .env"
    echo ""
  else
    rm .env
  fi
fi

# Generate .env if it doesn't exist
if [ ! -f .env ]; then
  SESSION_SECRET=$(openssl rand -base64 32)
  APP_KEY=$(openssl rand -base64 32)

  cat > .env << EOF
# =============================================================================
# Pulsar Configuration (Generated)
# =============================================================================

# Application Secrets
SESSION_SECRET=${SESSION_SECRET}
APP_KEY=${APP_KEY}

# Database
DATABASE_URL="file:./prisma/data/pulsar.db"
EOF

  echo "✅ Created .env with generated secrets"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 For Railway deployment, add these variables in your dashboard:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "SESSION_SECRET=${SESSION_SECRET}"
  echo "APP_KEY=${APP_KEY}"
  echo "DATABASE_URL=file:./prisma/data/pulsar.db"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

# Create data directory
mkdir -p prisma/data

# Generate Prisma client
echo "📦 Generating Prisma client..."
bunx prisma generate

# Run migrations
echo "🗄️  Running database migrations..."
bunx prisma migrate dev --name init 2>/dev/null || bunx prisma migrate dev

echo ""
echo "✅ Setup complete! Run 'bun run dev' to start the app."
