"""Generate a VAPID key pair for web push: uv run python scripts/gen_vapid.py

Put the two lines it prints in services/api/.env. Web push needs no account and no paid service;
these keys identify this server to the browser's push service. Keep the private key secret.
"""
from base64 import urlsafe_b64encode

from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from py_vapid import Vapid

b64 = lambda raw: urlsafe_b64encode(raw).decode().rstrip("=")  # noqa: E731

vapid = Vapid()
vapid.generate_keys()
private = vapid.private_key.private_numbers().private_value.to_bytes(32, "big")
public = vapid.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)

print(f"VAPID_PUBLIC_KEY={b64(public)}")
print(f"VAPID_PRIVATE_KEY={b64(private)}")
