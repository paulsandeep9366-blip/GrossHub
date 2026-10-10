#!/usr/bin/env bash
# GrossHub 1-Click Startup Script for macOS / Linux
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if command -v python3 &>/dev/null; then
    exec python3 "$DIR/start.py"
else
    echo "Error: python3 is required to run GrossHub locally."
    echo "Please install Python 3 or use any static web server."
    exit 1
fi
