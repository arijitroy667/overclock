"""Delivering nudges when the app is closed (PRD §7 Pillar 2, §10 notification service).

Web push needs only a VAPID key pair (no service, no account). Expo's push service is free too,
but its tokens require a development build — in Expo Go the app falls back to local notifications.
"""
import asyncio
import json
import logging
import os

import httpx
from pywebpush import WebPushException, webpush

from .db import PushSubscription

log = logging.getLogger(__name__)

VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:hello@overclock.app")
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

GONE = (404, 410)  # the subscription is dead: the browser unsubscribed or the app was removed


async def send(subscription: PushSubscription, title: str, body: str) -> bool:
    """True if delivered. False means the subscription is gone and should be dropped."""
    try:
        if subscription.platform == "expo":
            return await _send_expo(subscription.endpoint, title, body)
        return await asyncio.to_thread(_send_web, subscription, title, body)
    except Exception as e:  # a failed nudge must never take down the scheduler
        log.warning("push failed (%s): %s", subscription.platform, e)
        return True


def _send_web(subscription: PushSubscription, title: str, body: str) -> bool:
    if not VAPID_PRIVATE_KEY:
        log.warning("VAPID_PRIVATE_KEY unset — web push disabled")
        return True
    try:
        webpush(
            subscription_info={"endpoint": subscription.endpoint, "keys": subscription.keys},
            data=json.dumps({"title": title, "body": body}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
            timeout=10,
        )
        return True
    except WebPushException as e:
        if e.response is not None and e.response.status_code in GONE:
            return False
        log.warning("web push failed: %s", e)
        return True


async def _send_expo(token: str, title: str, body: str) -> bool:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(EXPO_PUSH_URL, json={"to": token, "title": title, "body": body, "sound": "default"})
    if response.status_code in GONE:
        return False
    data = response.json().get("data", {})
    if isinstance(data, dict) and data.get("details", {}).get("error") == "DeviceNotRegistered":
        return False
    return True
