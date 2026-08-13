import base64
import hashlib
import hmac
import secrets

from .config import Settings


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def proof_digest(settings: Settings, purpose: str, value: str) -> str:
    key = settings.proof_secret.get_secret_value().encode()
    message = f"{purpose}:{value}".encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def session_digest(settings: Settings, token: str) -> str:
    return proof_digest(settings, "session", token)


def constant_time_equal(left: str, right: str) -> bool:
    return hmac.compare_digest(left, right)


def hash_password(password: str, *, salt: bytes | None = None) -> str:
    active_salt = salt or secrets.token_bytes(16)
    derived = hashlib.scrypt(
        password.encode(),
        salt=active_salt,
        n=2**14,
        r=8,
        p=1,
        dklen=32,
        maxmem=32 * 1024 * 1024,
    )
    encoded_salt = base64.urlsafe_b64encode(active_salt).decode().rstrip("=")
    encoded_derived = base64.urlsafe_b64encode(derived).decode().rstrip("=")
    return f"scrypt$16384$8$1${encoded_salt}${encoded_derived}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, n_value, r_value, p_value, salt_value, expected_value = encoded.split("$")
        parameters = (int(n_value), int(r_value), int(p_value))
        if algorithm != "scrypt" or parameters != (2**14, 8, 1):
            return False
        salt = base64.urlsafe_b64decode(salt_value + "=" * (-len(salt_value) % 4))
        expected = base64.urlsafe_b64decode(
            expected_value + "=" * (-len(expected_value) % 4)
        )
        if len(salt) < 16 or len(expected) != 32:
            return False
        actual = hashlib.scrypt(
            password.encode(),
            salt=salt,
            n=parameters[0],
            r=parameters[1],
            p=parameters[2],
            dklen=len(expected),
            maxmem=32 * 1024 * 1024,
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)
