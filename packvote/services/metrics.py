"""Prometheus metrics definitions."""

from prometheus_client import Counter, Histogram

sms_sent_counter = Counter(
    "packvote_sms_sent_total",
    "Number of SMS messages dispatched",
    labelnames=("trip_id", "status"),
)

ai_request_latency = Histogram(
    "packvote_ai_request_latency_seconds",
    "Latency of AI provider requests",
    labelnames=("provider", "prompt_variant"),
    buckets=(0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0),
)

ai_request_errors = Counter(
    "packvote_ai_request_errors_total",
    "Count of failed AI provider requests",
    labelnames=("provider",),
)

recommendation_generated_counter = Counter(
    "packvote_recommendations_total",
    "Number of destination recommendations generated",
    labelnames=("prompt_variant", "model_name"),
)
