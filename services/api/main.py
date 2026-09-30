"""Entrypoint for hosts that look for a top-level app (Vercel). The app itself lives in app/main.py."""
from app.main import app

__all__ = ["app"]
