"""Model gateway that abstracts multiple LLM providers."""

from __future__ import annotations

import json
import random
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

import httpx
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential

from ..config import get_settings
from .metrics import ai_request_errors, ai_request_latency


class ProviderError(RuntimeError):
    """Raised when a provider fails to return a valid response."""


@dataclass
class ModelRequest:
    prompt: str
    prompt_variant: str = "baseline"
    trip_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    max_tokens: int = 800
    temperature: float = 0.7


@dataclass
class ModelResponse:
    content: str
    model_name: str
    prompt_variant: str
    usage: Dict[str, Any] = field(default_factory=dict)
    cost_usd: float | None = None
    latency_ms: float | None = None


class ModelProvider:
    """Abstract base class for model providers."""

    name: str

    async def generate(self, request: ModelRequest) -> ModelResponse:  # pragma: no cover - interface
        raise NotImplementedError


class OpenAIProvider(ModelProvider):
    name = "openai-gpt-4o"

    def __init__(self, api_key: Optional[str]) -> None:
        self.api_key = api_key

    async def generate(self, request: ModelRequest) -> ModelResponse:
        if not self.api_key:
            # Deterministic fallback for local development
            content = self._fallback_content(request.prompt)
            return ModelResponse(
                content=content,
                model_name=self.name,
                prompt_variant=request.prompt_variant,
                usage={"input_tokens": len(request.prompt.split()), "output_tokens": len(content.split())},
                cost_usd=0.0,
            )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "gpt-4o-mini",
            "input": request.prompt,
            "temperature": request.temperature,
            "max_output_tokens": request.max_tokens,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post("https://api.openai.com/v1/responses", headers=headers, json=payload)
            if response.status_code >= 300:
                raise ProviderError(f"OpenAI error {response.status_code}: {response.text}")
            data = response.json()

        text = self._extract_text(data)
        usage = data.get("usage", {})
        return ModelResponse(
            content=text,
            model_name=data.get("model", self.name),
            prompt_variant=request.prompt_variant,
            usage=usage if isinstance(usage, dict) else {},
            cost_usd=usage.get("total_cost_usd") if isinstance(usage, dict) else None,
        )

    @staticmethod
    def _extract_text(payload: Dict[str, Any]) -> str:
        if isinstance(payload.get("output_text"), list):
            return "\n".join(str(item) for item in payload["output_text"] if item)

        output = payload.get("output")
        parts: list[str] = []
        if isinstance(output, list):
            for item in output:
                if not isinstance(item, dict):
                    continue
                content = item.get("content")
                if isinstance(content, list):
                    for segment in content:
                        if isinstance(segment, dict):
                            if isinstance(segment.get("text"), str):
                                parts.append(segment["text"])
                            elif isinstance(segment.get("content"), str):
                                parts.append(segment["content"])
                elif isinstance(content, str):
                    parts.append(content)
        elif isinstance(output, str):
            parts.append(output)

        if parts:
            return "\n".join(parts)

        if isinstance(payload.get("content"), str):
            return payload["content"]

        return ""

    @staticmethod
    def _fallback_content(prompt: str) -> str:
        return "\n".join([
            "Pack Vote Development Mode Recommendation:",
            "Prompt preview:",
            prompt[:400],
            "--",
            "Because the real model credentials are not configured, this deterministic",
            "message stands in for the AI-generated content.",
        ])


class ModelGateway:
    """Unified interface for routing AI requests to different providers."""

    def __init__(self) -> None:
        settings = get_settings()
        self.providers: Dict[str, ModelProvider] = {
            "openai": OpenAIProvider(settings.openai_api_key),
        }
        self.default_order = ["openai"]

    def choose_provider(self, request: ModelRequest) -> ModelProvider:
        # AB testing hook: allow overriding via metadata
        if provider_key := request.metadata.get("provider"):
            selected = self.providers.get(provider_key)
            if selected:
                return selected

        # Weighted random selection; default to first configured provider
        weights = request.metadata.get("provider_weights", {})
        if weights:
            keys, values = zip(*weights.items())
            selected_key = random.choices(keys, weights=values, k=1)[0]
            if selected_key in self.providers:
                return self.providers[selected_key]

        for key in self.default_order:
            provider = self.providers.get(key)
            if provider:
                return provider
        raise ProviderError("No model providers are configured")

    async def generate(self, request: ModelRequest) -> ModelResponse:
        provider = self.choose_provider(request)
        provider_name = getattr(provider, "name", provider.__class__.__name__)
        start = time.perf_counter()

        try:
            async for attempt in AsyncRetrying(
                reraise=True,
                stop=stop_after_attempt(3),
                wait=wait_exponential(multiplier=0.5, min=0.5, max=8.0),
                retry=retry_if_exception_type(ProviderError),
            ):
                with attempt:
                    response = await provider.generate(request)
        except ProviderError:
            ai_request_errors.labels(provider_name).inc()
            raise

        duration = time.perf_counter() - start
        ai_request_latency.labels(provider_name, request.prompt_variant).observe(duration)
        response.latency_ms = duration * 1000
        return response

    @staticmethod
    def format_recommendation_payload(
        responses: list[ModelResponse], *, max_items: int | None = None
    ) -> list[Dict[str, Any]]:
        formatted: list[Dict[str, Any]] = []
        for response in responses:
            parsed_items = ModelGateway._extract_recommendation_dicts(response.content)
            if parsed_items:
                for item in parsed_items:
                    if not isinstance(item, dict):
                        continue
                    title = str(
                        (item.get("title") or ModelGateway._summarize_text(response.content) or "Untitled").strip()
                    )
                    description = str(
                        (
                            item.get("description")
                            or ModelGateway._summarize_text(response.content, limit=600)
                            or title
                        ).strip()
                    )
                    metadata = {k: v for k, v in item.items() if k not in {"title", "description"}}
                    formatted.append(
                        {
                            "title": title,
                            "description": description,
                            "model_name": response.model_name,
                            "prompt_variant": response.prompt_variant,
                            "usage": response.usage,
                            "cost_usd": response.cost_usd,
                            "details": metadata,
                        }
                    )
                    if max_items and len(formatted) >= max_items:
                        return formatted
                continue

            summary = ModelGateway._summarize_text(response.content)
            formatted.append(
                {
                    "title": summary if summary else "Untitled",
                    "description": ModelGateway._summarize_text(response.content, limit=600) or response.content,
                    "model_name": response.model_name,
                    "prompt_variant": response.prompt_variant,
                    "usage": response.usage,
                    "cost_usd": response.cost_usd,
                    "details": {},
                }
            )
            if max_items and len(formatted) >= max_items:
                return formatted
        return formatted

    _CODE_BLOCK_RE = re.compile(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", re.IGNORECASE)

    @staticmethod
    def _extract_recommendation_dicts(text: str | None) -> list[Dict[str, Any]] | None:
        if not text:
            return None

        blocks = ModelGateway._CODE_BLOCK_RE.findall(text)
        for block in blocks:
            try:
                parsed = json.loads(block)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, list):
                return parsed

        first = text.find("[")
        last = text.rfind("]")
        if first != -1 and last != -1 and last > first:
            candidate = text[first : last + 1]
            try:
                parsed = json.loads(candidate)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, list):
                return parsed

        return None

    @staticmethod
    def _summarize_text(text: str | None, *, limit: int = 200) -> str:
        if not text:
            return ""
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            return text[:limit]
        summary = lines[0]
        if len(summary) > limit:
            summary = summary[: limit - 1].rstrip()
            if summary and summary[-1] not in {".", "!", "?"}:
                summary += "..."
        return summary
