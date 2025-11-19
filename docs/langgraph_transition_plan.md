# LangChain/LangGraph Recommendation Agent Transition Plan

## Objectives
- Strip personally identifiable participant data (names, phones, raw locations) from the recommendation inputs.
- Base destination generation solely on group travel window (start, end, duration) and the aggregated preference tags participants choose.
- Rebuild the recommendation workflow around LangChain/LangGraph so we can evolve into multi-step agents in the future.

## Implementation Steps
1. **Context Builders**
   - Add helpers that derive a `TripWindow` (ISO-formatted dates + computed duration) from each trip.
   - Add a `PreferenceSummary` aggregator that inspects `SurveyResponse.answers["preferences"]`, counts tag frequency, and never surfaces participant IDs or other answers.

2. **LangGraph Agent**
   - Model agent state (`trip_window`, `preference_summary`, `candidate_count`, `prompt_variant`, `prompt`, `recommendations`).
   - Entry node composes a strict JSON-oriented prompt (LangChain `PromptTemplate`) referencing only the allowed context.
   - Generation node calls the existing `ModelGateway`. If structured JSON is returned, forward it; otherwise synthesize deterministic recommendations directly from the preference summary (still in the same node, so no fallback node is required).

3. **Service Integration**
   - `RecommendationService` instantiates the agent and passes the sanitized context instead of building prompts itself.
   - Persist `DestinationRecommendation` records exactly as before, but remove the old prompt builder/fallback payload code.

4. **Validation & Tests**
   - Unit tests for the context builders to assert that names/phones/locations never appear in summaries or prompts.
   - Update the workflow test suite to run through the new agent-powered endpoint to guard against regressions.

5. **Operational Considerations**
   - Emit lightweight metadata from the agent (e.g., preference counts) to assist with observability later.
   - Future enhancements (tool use, external data calls) can be slotted into the LangGraph without redesign.
