# Pack Vote

Pack Vote is an AI-powered group travel planning platform that leverages agentic workflows to facilitate consensus. It combines SMS-based preference collection, multi-model AI recommendations, and ranked-choice voting to streamline trip planning.

## Tech Stack & Dependencies

### Backend
- **Runtime**: Python 3.12+
- **Framework**: FastAPI
- **Database**: SQLModel (SQLite + aiosqlite), SQLAlchemy
- **AI/LLM**: LangChain, LangGraph (OpenAI, Anthropic, DeepSeek)
- **Messaging**: Twilio API
- **Observability**: Prometheus, SlowAPI (Rate Limiting)

### Frontend
- **Framework**: React (Vite)
- **Styling**: TailwindCSS (inferred standard)

## Project Structure

```text
.
├── packvote/               # Backend source code
│   ├── api/                # FastAPI routes (REST endpoints)
│   ├── services/           # Domain logic (AI, Voting, SMS)
│   ├── models.py           # SQLModel database schemas
│   └── app.py              # App factory and configuration
├── frontend/               # React frontend application
├── tests/                  # Pytest suite (E2E and unit tests)
├── alembic/                # Database migrations
└── main.py                 # Application entry point
```

## Agentic AI Impact

Pack Vote uses an agentic architecture to drive decision-making:
- **Model Gateway**: Dynamically routes prompts to the best-suited LLM provider (OpenAI, Anthropic, DeepSeek) based on availability and task complexity.
- **Consensus Engine**: Automates the decision process using ranked-choice voting (Instant Runoff) to fairly select destinations based on group preferences.
- **Preference Agent**: Synthesizes unstructured SMS responses into structured participant profiles to tailor recommendations.

## Getting Started

1.  **Install Dependencies**
    ```bash
    pip install -e .
    ```

2.  **Configure Environment**
    Copy the example environment file and populate your API keys (Twilio, OpenAI, etc.).
    ```bash
    cp packvote/env.example .env
    ```

3.  **Run the Application**
    Start the backend server (default port 8090).
    ```bash
    uvicorn main:app --reload --port 8090
    ```
    - API Docs: `http://localhost:8090/docs`
    - Metrics: `http://localhost:8090/metrics`

## Testing

Run the full test suite using `pytest`. This includes end-to-end tests for the planning workflow.

```bash
pytest
```
