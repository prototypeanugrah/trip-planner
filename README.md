# Pack Vote

Pack Vote is an AI-powered group travel planning platform that leverages agentic workflows to facilitate consensus. It combines SMS-based preference collection, multi-model AI recommendations, and ranked-choice voting to streamline trip planning.

## Tech Stack & Dependencies

### Backend
- **Runtime/Framework**: Python 3.12+ with FastAPI app factory in `packvote.app:create_app` served by Uvicorn.
- **Data Layer**: SQLModel/SQLAlchemy with async SQLite (default) and Alembic migrations.
- **AI/LLM**: LangGraph + LangChain powered agents routed through a `ModelGateway` (OpenAI by default, deterministic local fallback; Tavily search optional).
- **Messaging**: Twilio SMS plus FastAPI-Mail for email invitations and survey delivery.
- **Platform**: Pydantic settings, Prometheus metrics endpoint, SlowAPI rate limiting, CORS configured via environment.

### Frontend
- **Framework**: React 19 + TypeScript built with Vite.
- **Routing & Data**: React Router 7, TanStack Query, Axios-based API client, Clerk authentication.
- **UX Tooling**: Tailwind CSS v4, Framer Motion, Lucide icons, React Hook Form + Zod validation.
- **Maps**: Leaflet/React-Leaflet for displaying destination context.

## Project Structure

```text
.
├── packvote/               # Backend source code
│   ├── api/                # Dependencies + route modules (`routes/`)
│   ├── services/           # Domain logic: AI gateway, LangGraph agents, messaging, voting, metrics
│   ├── ui/static/          # Built frontend bundle served at /ui
│   ├── app.py              # FastAPI factory, CORS, Prometheus /metrics, static mount
│   ├── models.py, schemas.py, db.py, config.py
│   └── ...
├── frontend/               # Vite + React + TS app (`src/pages`, `src/components`, `src/services/api.ts`)
├── alembic/                # Database migrations
├── tests/                  # Pytest suite (API + workflow)
├── docs/langgraph_transition_plan.md
├── start_server.sh         # Dev helper to boot API on port 8050 alongside frontend
└── main.py                 # Local Uvicorn entrypoint
```

## Agentic AI Impact

Pack Vote leans on LangGraph-powered agents plus a model gateway to automate planning:
- **Model Gateway**: Centralizes LLM calls with provider selection (OpenAI default, deterministic dev fallback) and Prometheus latency/error metrics.
- **Recommendation Agent**: LangGraph flow that builds prompts from trip windows + aggregated preferences, returning structured destination options with deterministic synthesis when the model omits JSON.
- **Travel Planner Orchestrator**: Multi-agent budget coordinator loops flight and hotel agents until costs fit the allocated travel budget, then emits logistics metadata.
- **Itinerary Agent**: Generates day-by-day plans conditioned on preferences; optionally grounds results with Tavily search context.
- **Consensus Engine**: Instant-runoff (ranked-choice) voting tallies recommendations to surface fair group winners and audit rounds.

## Getting Started

1.  **Install Backend Dependencies**
    ```bash
    pip install -e .
    ```

2.  **Install Frontend Dependencies**
    ```bash
    cd frontend
    npm install
    cd ..
    ```

3.  **Configure Environment**
    Copy the example environment file and populate your API keys (Twilio, OpenAI, etc.).
    ```bash
    cp packvote/env.example .env
    ```

4.  **Run the Application (one command)**
    From `frontend/`, start Vite dev server and the FastAPI backend together:
    ```bash
    cd frontend
    npm run dev
    ```
    - Backend runs on port 8050 (via `start_server.sh`); frontend on port 5173.
    - API Docs: `http://localhost:8050/docs`
    - Metrics: `http://localhost:8050/metrics`

    _Optional: start backend manually without the frontend_
    ```bash
    uv run uvicorn packvote.app:create_app --factory --host 0.0.0.0 --port 8050 --reload
    ```

## Testing

Run the full test suite using `pytest`. This includes end-to-end tests for the planning workflow.

```bash
pytest
```
