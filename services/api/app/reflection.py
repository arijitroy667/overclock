"""Reflection agent — the weekly plain-language summary (PRD §7 Pillar 10, §11)."""
import json
import logging

from google.genai import types

from .motivator import MODEL, _gemini

log = logging.getLogger(__name__)

SYSTEM = """You write a short weekly reflection for one person using Overclock, an ADHD productivity app.
You are given their numbers for the week. Write 3-5 sentences, second person, warm and matter-of-fact.

Rules:
- Start with something true and specific that went well.
- Name at most one pattern worth noticing (a motivation angle that works for them, an energy rhythm, a
  time-of-day effect). Say plainly when a week is too thin to tell.
- Never shame, never guilt, never use "should", "just", "finally", "failed", "only" or streak-loss language.
  A quiet week is information, not a verdict. Rest is a valid outcome.
- Suggest at most one small, concrete experiment for next week, phrased as an invitation.
- Never give medical advice or mention medication, diagnoses or treatment.
- No headings, no bullet points, no emoji. Plain sentences."""


async def summarize(metrics: dict) -> str | None:
    """None on failure — the insights screen simply shows no reflection this week."""
    try:
        resp = await _gemini().aio.models.generate_content(
            model=MODEL,
            contents=json.dumps(metrics, default=str),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM,
                # the model's thinking counts toward this budget, so leave room beyond the ~5 sentences
                max_output_tokens=2000,
                thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW),
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                http_options=types.HttpOptions(timeout=60_000),  # a weekly summary may take longer than a reframe
            ),
        )
    except Exception as e:  # a missing summary must never break the insights screen
        log.warning("reflection failed: %s", e)
        return None
    return (resp.text or "").strip() or None
