## Pack Vote

Pack Vote is an AI-powered group travel planning platform. It collects participant preferences through SMS surveys, generates tailored destination recommendations via a model gateway that can route to OpenAI, Anthropic, or DeepSeek, and converges on a consensus using ranked-choice voting. The backend is built with FastAPI, SQLModel, and a production-focused toolkit including rate limiting, Prometheus metrics, and automated testing.

### Highlights
- Full REST API for trips, participants, surveys, recommendations, and voting.
- Twilio SMS integration with development fallbacks and signature validation.
- Model gateway abstraction with prompt variant support, provider weighting, and metric instrumentation.
- Ranked-choice (instant-runoff) vote tallying with audit logging.
- Structured domain models stored in a SQL database (SQLite by default).
- Prometheus metrics endpoint, SlowAPI rate limiting, and configurable CORS.
- End-to-end integration test that exercises the primary planning flow.

### Project Structure
- `packvote/app.py` – FastAPI app factory, middleware, and lifecycle hooks.
- `packvote/models.py` – SQLModel tables for trips, surveys, recommendations, votes, and audit logs.
- `packvote/schemas.py` – Pydantic schemas for request/response payloads.
- `packvote/services/` – Domain services for AI routing, recommendations, voting, messaging, metrics, and rate limiting.
- `packvote/api/routes/` – Modular FastAPI routers for each domain area and webhooks.
- `tests/` – Pytest suite with async end-to-end workflow coverage.
- `pyproject.toml` – Poetry-compatible project metadata and dependency management.

### Getting Started
1. **Clone and install dependencies**
   ```bash
   pip install -e .
   ```

2. **Create an environment file** (optional but recommended)
   ```bash
   cp packvote/env.example .env
   ```
   Populate credentials for Twilio and your preferred model providers when available. Without keys, the app falls back to deterministic stub responses and console-logged SMS.

3. **Run the API + UI locally**
   ```bash
   uvicorn main:app --reload --port 8090
   ```
   The service exposes the control center UI at `http://localhost:8090/ui`, interactive docs at `/docs`, and Prometheus metrics at `/metrics`.

### Configuration
Key environment variables (prefixed with `PACKVOTE_`):
- `DATABASE_URL` – SQLAlchemy URL (`sqlite+aiosqlite:///./packvote.db` by default).
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_MESSAGING_SERVICE_SID` – required for live SMS delivery.
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY` – enable live model calls.
- `ALLOWED_ORIGINS` – comma-separated list for CORS control.

Prompt assets can be stored in the `prompts/` directory (configurable via `prompt_store_path`). Version metadata is recorded on each trip and recommendation.

### Testing
Run the automated tests with:
```bash
pytest
```
The suite spins up an isolated SQLite database, exercises the primary workflow (trip → survey → recommendations → voting), verifies the metrics endpoint, and tears down cleanly.

### Observability & Operations
- **Metrics**: Prometheus-compatible counters and histograms exposed at `/metrics` (e.g., SMS send counts, AI latency, recommendation totals).
- **Rate limiting**: SlowAPI enforces a global `120/minute` limit per client IP. Adjust in `services/rate_limit.py` as needed.
- **Audit logging**: Key lifecycle events (trip creation, survey activity, voting) are captured in `audit_logs` for compliance and analysis.

### Extensibility Roadmap
- Add pricing agent integration for live flight/hotel data.
- Expand prompt evaluation telemetry and automated AB promotion logic.
- Extend analytics dashboards and trip-level insights.
- Introduce background workers (Celery/Arq) for high-volume survey dispatching.

Pack Vote demonstrates production-grade patterns for multi-model AI orchestration, preference capture, and group decision making. Contributions and adaptations are welcome.

