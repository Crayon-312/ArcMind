from dataclasses import dataclass


@dataclass(slots=True)
class ApiError(Exception):
    status_code: int
    code: str
    message: str
    retryable: bool = False
    retry_after_seconds: int | None = None
