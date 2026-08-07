$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot\..
try {
    pnpm check
    if ($LASTEXITCODE -ne 0) { throw "pnpm check failed" }

    Push-Location apps\cloud-server
    try {
        uv sync --frozen
        if ($LASTEXITCODE -ne 0) { throw "uv sync failed" }
        uv run ruff check .
        if ($LASTEXITCODE -ne 0) { throw "ruff failed" }
        uv run pyright
        if ($LASTEXITCODE -ne 0) { throw "pyright failed" }
        uv run pytest
        if ($LASTEXITCODE -ne 0) { throw "pytest failed" }
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}
