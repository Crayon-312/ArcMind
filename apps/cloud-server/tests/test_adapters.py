from collections.abc import Callable

import httpx
import pytest
from pydantic import SecretStr

from arcmind_cloud.adapters import (
    DeepSeekModelProvider,
    DeterministicModelProvider,
    ModelProviderError,
)
from arcmind_cloud.config import Settings


def settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "database_url": "postgresql+psycopg://arcmind:test@localhost/arcmind",
        "public_origin": "https://127.0.0.1",
        "login_username": "owner",
        "proof_secret": SecretStr("a" * 32),
    }
    values.update(overrides)
    return Settings(**values)  # pyright: ignore[reportArgumentType]


@pytest.mark.asyncio
async def test_deterministic_model_is_explicit_and_repeatable() -> None:
    provider = DeterministicModelProvider()

    first = await provider.generate("  你好， ArcMind  ")
    second = await provider.generate("你好， ArcMind")

    assert first == second
    assert first.startswith("[测试模型]")


def deepseek_transport(
    status_code: int,
    payload: object,
    inspect_request: Callable[[httpx.Request], None] | None = None,
) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if inspect_request:
            inspect_request(request)
        return httpx.Response(status_code, json=payload, request=request)

    return httpx.MockTransport(handler)


@pytest.mark.asyncio
async def test_deepseek_provider_returns_validated_text_without_leaking_key() -> None:
    def inspect_request(request: httpx.Request) -> None:
        assert request.url == "https://api.deepseek.com/chat/completions"
        assert request.headers["Authorization"] == "Bearer provider-secret"

    transport = deepseek_transport(
        200,
        {"choices": [{"message": {"content": "真实模型回复"}}]},
        inspect_request,
    )
    async with httpx.AsyncClient(transport=transport) as client:
        provider = DeepSeekModelProvider(
            settings(deepseek_api_key=SecretStr("provider-secret")),
            client=client,
        )

        result = await provider.generate("你好")

    assert result == "真实模型回复"
    assert "provider-secret" not in repr(provider.settings.deepseek_api_key)


@pytest.mark.parametrize(
    ("status_code", "category", "retryable"),
    [
        (401, "authentication", False),
        (403, "authentication", False),
        (429, "rate_limited", True),
        (500, "unavailable", True),
        (400, "invalid_response", False),
    ],
)
@pytest.mark.asyncio
async def test_deepseek_provider_normalizes_http_errors(
    status_code: int,
    category: str,
    retryable: bool,
) -> None:
    transport = deepseek_transport(status_code, {"error": {"message": "provider detail"}})
    async with httpx.AsyncClient(transport=transport) as client:
        provider = DeepSeekModelProvider(
            settings(deepseek_api_key=SecretStr("provider-secret")),
            client=client,
        )

        with pytest.raises(ModelProviderError) as captured:
            await provider.generate("你好")

    assert captured.value.category == category
    assert captured.value.retryable is retryable
    assert "provider detail" not in str(captured.value)


@pytest.mark.asyncio
async def test_deepseek_provider_normalizes_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("provider timeout detail", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        provider = DeepSeekModelProvider(
            settings(deepseek_api_key=SecretStr("provider-secret")),
            client=client,
        )

        with pytest.raises(ModelProviderError) as captured:
            await provider.generate("你好")

    assert captured.value.category == "timeout"
    assert captured.value.retryable is True
    assert "provider timeout detail" not in str(captured.value)


@pytest.mark.asyncio
async def test_deepseek_provider_rejects_malformed_success() -> None:
    transport = deepseek_transport(200, {"choices": []})
    async with httpx.AsyncClient(transport=transport) as client:
        provider = DeepSeekModelProvider(
            settings(deepseek_api_key=SecretStr("provider-secret")),
            client=client,
        )

        with pytest.raises(ModelProviderError) as captured:
            await provider.generate("你好")

    assert captured.value.category == "invalid_response"
    assert captured.value.retryable is False
