import asyncio
import smtplib
from email.message import EmailMessage

from .config import Settings


class TestMailAdapter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def send_login_code(self, recipient: str, code: str) -> None:
        message = EmailMessage()
        message["From"] = self.settings.smtp_from
        message["To"] = recipient
        message["Subject"] = "ArcMind 登录验证码"
        message.set_content(f"你的 ArcMind 登录验证码是：{code}\n\n验证码 10 分钟内有效。")

        def send() -> None:
            with smtplib.SMTP(
                self.settings.smtp_host,
                self.settings.smtp_port,
                timeout=10,
            ) as client:
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
