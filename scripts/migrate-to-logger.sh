#!/bin/bash

# Script to help migrate console.log/console.error to proper logging
# This script identifies files with console statements for manual review

echo "=== Console Statement Migration Tool ==="
echo ""

# Count total console statements
TOTAL=$(grep -r "console\." src --include="*.ts" --include="*.tsx" | wc -l | tr -d ' ')
echo "Total console statements found: $TOTAL"
echo ""

# Count by directory
echo "Breakdown by directory:"
echo "API routes: $(grep -r "console\." src/app/api --include="*.ts" | wc -l | tr -d ' ')"
echo "Components: $(grep -r "console\." src/components --include="*.tsx" --include="*.ts" | wc -l | tr -d ' ')"
echo "Library: $(grep -r "console\." src/lib --include="*.ts" | wc -l | tr -d ' ')"
echo "Pages: $(grep -r "console\." src/app --include="*.tsx" --exclude-dir="api" | wc -l | tr -d ' ')"
echo ""

# List files with console statements
echo "Files with console statements (API routes):"
grep -r "console\." src/app/api --include="*.ts" -l | sort
echo ""

echo "Migration instructions:"
echo "1. For API routes (server-side):"
echo "   - Import: import { createLogger } from '@/lib/logger'"
echo "   - Create logger: const logger = createLogger('context-name')"
echo "   - Replace console.error() with logger.error()"
echo "   - Replace console.log() with logger.info() or logger.debug()"
echo ""
echo "2. For client components:"
echo "   - Consider if logging is necessary in production"
echo "   - Use conditional logging: process.env.NODE_ENV !== 'production'"
echo "   - Or remove entirely if only used for debugging"
echo ""
echo "3. For library code:"
echo "   - Use logger for server-side utilities"
echo "   - Remove or conditionally log for client-side utilities"
