from pathlib import Path
from typing import Any, cast

import yaml
from pytest import MonkeyPatch

CONTRACT_PATH = (
    Path(__file__).resolve().parents[3]
    / "knowledge/04-接口与事件/openapi/phase-1.yaml"
)

EXPECTED_PUBLIC_AUTH_PATHS = {
    "/auth/session",
    "/auth/sessions/current",
    "/auth/sessions",
}


def test_reviewed_operations_match_fastapi(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv(
        "ARCMIND_DATABASE_URL",
        "postgresql+psycopg://arcmind:test@localhost/arcmind",
    )
    monkeypatch.setenv("ARCMIND_PUBLIC_ORIGIN", "https://127.0.0.1")
    monkeypatch.setenv("ARCMIND_LOGIN_USERNAME", "owner")
    monkeypatch.setenv("ARCMIND_PROOF_SECRET", "a" * 32)

    from arcmind_cloud.main import app

    reviewed = cast(
        dict[str, Any],
        yaml.safe_load(
            open(  # noqa: PTH123, SIM115
                CONTRACT_PATH,
                encoding="utf-8",
            )
        ),
    )
    generated = app.openapi()
    for path, path_item in reviewed["paths"].items():
        generated_path = generated["paths"][f"/api/v1{path}"]
        for method, operation in path_item.items():
            if method == "parameters":
                continue
            generated_operation = generated_path[method]
            assert generated_operation["operationId"] == operation["operationId"]

            request_schema = (
                operation.get("requestBody", {})
                .get("content", {})
                .get("application/json", {})
                .get("schema")
            )
            if request_schema is not None:
                assert (
                    generated_operation["requestBody"]["content"]["application/json"]["schema"]
                    == request_schema
                )

            reviewed_success = next(
                (
                    response
                    for code, response in operation["responses"].items()
                    if str(code).startswith("2")
                    and "application/json" in response.get("content", {})
                ),
                None,
            )
            if reviewed_success is not None:
                status = next(
                    str(code)
                    for code, response in operation["responses"].items()
                    if response is reviewed_success
                )
                assert (
                    generated_operation["responses"][status]["content"]["application/json"][
                        "schema"
                    ]
                    == reviewed_success["content"]["application/json"]["schema"]
                )


def test_public_auth_surface_excludes_registration_and_otp(
    monkeypatch: MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "ARCMIND_DATABASE_URL",
        "postgresql+psycopg://arcmind:test@localhost/arcmind",
    )
    monkeypatch.setenv("ARCMIND_PUBLIC_ORIGIN", "https://127.0.0.1")
    monkeypatch.setenv("ARCMIND_LOGIN_USERNAME", "owner")
    monkeypatch.setenv("ARCMIND_PROOF_SECRET", "a" * 32)

    from arcmind_cloud.main import app

    reviewed = cast(
        dict[str, Any],
        yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8")),
    )
    reviewed_auth_paths = {
        path for path in reviewed["paths"] if path.startswith("/auth/")
    }
    generated_auth_paths = {
        path.removeprefix("/api/v1")
        for path in app.openapi()["paths"]
        if path.startswith("/api/v1/auth/")
    }

    assert reviewed_auth_paths == EXPECTED_PUBLIC_AUTH_PATHS
    assert generated_auth_paths == EXPECTED_PUBLIC_AUTH_PATHS
