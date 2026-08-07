import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, ValidationError

from .config import Settings


class SmtpMailAdapter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def send_login_code(self, recipient: str, code: str) -> None:
        message = EmailMessage()
        message["From"] = self.settings.smtp_from
        message["To"] = recipient
        message["Subject"] = "ArcMind 登录验证码"
        message.set_content(f"你的 ArcMind 登录验证码是：{code}\n\n验证码 10 分钟内有效。")

        def send() -> None:
            context = ssl.create_default_context()
            if self.settings.smtp_ssl:
                client_context = smtplib.SMTP_SSL(
                    self.settings.smtp_host,
                    self.settings.smtp_port,
                    timeout=self.settings.smtp_timeout_seconds,
                    context=context,
                )
            else:
                client_context = smtplib.SMTP(
                    self.settings.smtp_host,
                    self.settings.smtp_port,
                    timeout=self.settings.smtp_timeout_seconds,
                )

            with client_context as client:
                if self.settings.smtp_starttls:
                    client.starttls(context=context)
                if self.settings.smtp_username and self.settings.smtp_password:
                    client.login(
                        self.settings.smtp_username,
                        self.settings.smtp_password.get_secret_value(),
                    )
                client.send_message(message)

        await asyncio.to_thread(send)


class DeterministicModelProvider:
    async def generate(self, content: str) -> str:
        normalized = " ".join(content.split())
        return (
            "[测试模型] 我已收到你的消息：\n\n"
            f"{normalized}\n\n"
            "当前回复用于验证 ArcMind 的身份、持久化和文字事件链路。"
        )


ModelErrorCategory = Literal[
    "authentication",
    "rate_limited",
    "timeout",
    "unavailable",
    "invalid_response",
]


class ModelProviderError(Exception):
    def __init__(self, category: ModelErrorCategory, *, retryable: bool) -> None:
        super().__init__(category)
        self.category = category
        self.retryable = retryable


class _DeepSeekMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    content: str


class _DeepSeekChoice(BaseModel):
    model_config = ConfigDict(extra="ignore")

    message: _DeepSeekMessage


class _DeepSeekCompletion(BaseModel):
    model_config = ConfigDict(extra="ignore")

    choices: list[_DeepSeekChoice]


class DeepSeekModelProvider:
    def __init__(
        self,
        settings: Settings,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        api_key = settings.deepseek_api_key
        if api_key is None:
            raise ValueError("deepseek_api_key is required")
        self.settings = settings
        self.api_key = api_key
        self.client = client

    async def generate(self, content: str) -> str:
        request = {
            "model": self.settings.deepseek_model,
            "messages": [{"role": "user", "content": content}],
            "stream": False,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key.get_secret_value()}",
            "Content-Type": "application/json",
        }

        try:
            if self.client is None:
                async with httpx.AsyncClient(
                    base_url=self.settings.deepseek_base_url,
                    headers=headers,
                    timeout=self.settings.deepseek_timeout_seconds,
                ) as client:
                    response = await client.post("/chat/completions", json=request)
            else:
                response = await self.client.post(
                    f"{self.settings.deepseek_base_url}/chat/completions",
                    headers=headers,
                    json=request,
                    timeout=self.settings.deepseek_timeout_seconds,
                )
        except httpx.TimeoutException as error:
            raise ModelProviderError("timeout", retryable=True) from error
        except httpx.RequestError as error:
            raise ModelProviderError("unavailable", retryable=True) from error

        if response.status_code in {401, 403}:
            raise ModelProviderError("authentication", retryable=False)
        if response.status_code == 429:
            raise ModelProviderError("rate_limited", retryable=True)
        if response.status_code >= 500:
            raise ModelProviderError("unavailable", retryable=True)
        if response.is_error:
            raise ModelProviderError("invalid_response", retryable=False)

        try:
            completion = _DeepSeekCompletion.model_validate(response.json())
        except (ValueError, ValidationError) as error:
            raise ModelProviderError("invalid_response", retryable=False) from error
        if not completion.choices or not completion.choices[0].message.content:
            raise ModelProviderError("invalid_response", retryable=False)
        return completion.choices[0].message.content
