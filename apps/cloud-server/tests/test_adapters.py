from collections.abc import Callable
from unittest.mock import patch

import httpx
import pytest
from pydantic import SecretStr

from arcmind_cloud.adapters import (
    DeepSeekModelProvider,
    DeterministicModelProvider,
    ModelProviderError,
    SmtpMailAdapter,
)
from arcmind_cloud.config import Settings


def settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "database_url": "postgresql+psycopg://arcmind:test@localhost/arcmind",
        "public_origin": "https://127.0.0.1",
        "allowed_email": "owner@example.invalid",
        "proof_secret": SecretStr("a" * 32),
        "smtp_host": "mailpit",
        "smtp_port": 1025,
        "smtp_timeout_seconds": 10,
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


@pytest.mark.asyncio
async def test_smtp_adapter_supports_plain_test_relay() -> None:
    with patch("arcmind_cloud.adapters.smtplib.SMTP") as smtp:
        client = smtp.return_value.__enter__.return_value

        await SmtpMailAdapter(settings()).send_login_code("owner@example.invalid", "123456")

        smtp.assert_called_once_with("mailpit", 1025, timeout=10)
        client.starttls.assert_not_called()
        client.login.assert_not_called()
        message = client.send_message.call_args.args[0]
        assert message["To"] == "owner@example.invalid"
        assert "123456" in message.get_content()


@pytest.mark.asyncio
async def test_smtp_adapter_supports_starttls_and_authentication() -> None:
    config = settings(
        smtp_host="smtp.example.com",
        smtp_port=587,
        smtp_username="owner",
        smtp_password=SecretStr("smtp-secret"),
        smtp_starttls=True,
    )
    with patch("arcmind_cloud.adapters.smtplib.SMTP") as smtp:
        client = smtp.return_value.__enter__.return_value

        await SmtpMailAdapter(config).send_login_code("owner@example.invalid", "123456")

        client.starttls.assert_called_once()
        client.login.assert_called_once_with("owner", "smtp-secret")
        client.send_message.assert_called_once()


@pytest.mark.asyncio
async def test_smtp_adapter_supports_implicit_tls() -> None:
    config = settings(smtp_host="smtp.example.com", smtp_port=465, smtp_ssl=True)
    with (
        patch("arcmind_cloud.adapters.smtplib.SMTP") as smtp,
        patch("arcmind_cloud.adapters.smtplib.SMTP_SSL") as smtp_ssl,
    ):
        client = smtp_ssl.return_value.__enter__.return_value

        await SmtpMailAdapter(config).send_login_code("owner@example.invalid", "123456")

        smtp.assert_not_called()
        smtp_ssl.assert_called_once()
        client.starttls.assert_not_called()
        client.send_message.assert_called_once()


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
