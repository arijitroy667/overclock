"""Motivator (Task Alchemy) + Time-Translator padding — PRD §7 Pillars 1-2, §11.

MVP per §15: one Gemini call per task, static lever rotation, no personalization memory.
ponytail: plain SDK call, not LangGraph — move into services/agents as a graph when Planner/Reflection land (Phase 2).
"""
import logging
import re
from statistics import median
from typing import Literal

from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

MODEL = "gemini-3.6-flash"
LEVERS = ["challenge", "play", "novelty", "urgency", "interest"]  # PINCH
Category = Literal["deep_work", "admin", "creative", "social", "chore", "study"]

SYSTEM = """You are the Task Alchemy engine in Overclock, a productivity app for people with ADHD.
ADHD motivation is interest-based: a task has to feel interesting, novel, challenging, playful or urgent to get started.
Rewrite the user's captured task so it is easier to start, using the PINCH lever you are given.

Rules:
- first_step must be a concrete physical action doable in under 2 minutes.
- Break larger tasks into 2-6 short subtasks; for tiny tasks, subtasks may be empty.
- Apply the lever to framing and pacing only. Never invent, move or imply a real deadline or due date. "Urgency" means a self-paced countdown ("10-minute sprint"), never "this is due today".
- Warm, plain, non-judgmental language. No shame, guilt, "should", "just", or "finally".
- No medical advice: never mention medication, dosages or diagnoses.
- estimated_minutes is an honest typical duration for the whole task."""


class Reframe(BaseModel):
    category: Category
    reframed_title: str = Field(description="Short, lever-flavoured title, max ~60 characters")
    first_step: str
    subtasks: list[str]
    estimated_minutes: int


_client: genai.Client | None = None


def _gemini() -> genai.Client:
    global _client
    if _client is None:  # lazy: reads GEMINI_API_KEY; the API still boots (and captures) without it
        _client = genai.Client(http_options=types.HttpOptions(
            timeout=10_000,
            retry_options=types.HttpRetryOptions(attempts=2, initial_delay=0.5, http_status_codes=[429, 500, 503]),
        ))
    return _client


_PII = [
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "[email]"),
    (re.compile(r"\+?\d[\d\s().-]{7,}\d"), "[number]"),
]


def strip_pii(text: str) -> str:
    for pattern, repl in _PII:
        text = pattern.sub(repl, text)
    return text


def pick_lever(task_count: int) -> str:
    """Static rotation — keeps novelty up and gives the Phase 2 learner even data per lever."""
    return LEVERS[task_count % len(LEVERS)]


async def reframe(text: str, lever: str) -> Reframe | None:
    """None on any failure: a capture must never be lost because the model was slow or down."""
    try:
        resp = await _gemini().aio.models.generate_content(
            model=MODEL,
            contents=f"Lever: {lever}\nTask: {strip_pii(text)}",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM,
                response_mime_type="application/json",
                response_schema=Reframe,
                thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW),  # P95 < 2s (§17)
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),  # no tools here
            ),
        )
    except (errors.APIError, ValueError) as e:  # ValueError: no API key configured
        log.warning("reframe failed: %s", e)
        return None
    if not isinstance(resp.parsed, Reframe):
        log.warning("reframe unusable: %s", resp.candidates[0].finish_reason if resp.candidates else "no candidates")
        return None
    return resp.parsed


DEFAULT_PAD = 1.5  # planning-fallacy default until we have history


def pad(raw_minutes: int, history: list[tuple[int, int]]) -> int:
    """history = (estimated_raw, actual) pairs for this user+category. Median ratio, clamped to [1, 3]."""
    ratios = [actual / est for est, actual in history if est and actual]
    factor = min(max(median(ratios), 1.0), 3.0) if len(ratios) >= 3 else DEFAULT_PAD
    return round(raw_minutes * factor)
