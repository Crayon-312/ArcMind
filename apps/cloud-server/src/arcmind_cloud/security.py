import hashlib
import hmac
import secrets
import uuid

from .config import Settings


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def proof_digest(settings: Settings, purpose: str, value: str) -> str:
    key = settings.proof_secret.get_secret_value().encode()
    message = f"{purpose}:{value}".encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def challenge_digest(settings: Settings, challenge_id: uuid.UUID, code: str) -> str:
    return proof_digest(settings, "challenge", f"{challenge_id}:{code}")


def session_digest(settings: Settings, token: str) -> str:
    return proof_digest(settings, "session", token)


def constant_time_equal(left: str, right: str) -> bool:
    return hmac.compare_digest(left, right)
