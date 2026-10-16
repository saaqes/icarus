#!/bin/sh
cd "$(dirname "$0")/.." && npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -${1:-40}
