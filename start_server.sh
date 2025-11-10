#!/bin/bash

# Kill any processes using port 8050
echo "Checking for processes on port 8050..."
lsof -ti:8050 | xargs kill -9 2>/dev/null || echo "No existing processes found on port 8050"

# Activate virtual environment and start server
echo "Starting server on port 8050..."
source .venv/bin/activate
uv run uvicorn packvote.app:create_app --factory --host 0.0.0.0 --port 8050 --reload
