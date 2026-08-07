FROM ghcr.io/astral-sh/uv:0.10.9 AS uv

FROM python:3.12.11-slim-bookworm

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN groupadd --system --gid 10001 arcmind \
    && useradd --system --uid 10001 --gid arcmind --home-dir /app arcmind

WORKDIR /app
COPY --from=uv /uv /uvx /bin/
COPY apps/cloud-server/pyproject.toml apps/cloud-server/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY apps/cloud-server/alembic.ini ./alembic.ini
COPY apps/cloud-server/migrations ./migrations
COPY apps/cloud-server/src ./src
RUN uv sync --frozen --no-dev \
    && chown -R arcmind:arcmind /app

USER arcmind
EXPOSE 8000
CMD ["uvicorn", "arcmind_cloud.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
