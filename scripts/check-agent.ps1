[CmdletBinding()]
param(
    [string]$ProjectRoot = "",
    [switch]$AllowPlaceholders
)

$ErrorActionPreference = "Stop"
$Issues = New-Object System.Collections.Generic.List[string]
$MemoryIds = New-Object System.Collections.Generic.HashSet[string]
$SensitivePatterns = @(
    "(?i)\b(api[_-]?key|token|access[_-]?token|refresh[_-]?token|secret|password|passwd|pwd|credential|private[_-]?key|cookie|session[_-]?id)\b",
    "\u8d26\u53f7",
    "\u5bc6\u7801",
    "\u5bc6\u94a5",
    "\u51ed\u636e",
    "\u79c1\u94a5",
    "\u8bbf\u95ee\u4ee4\u724c",
    "\u5237\u65b0\u4ee4\u724c",
    "\u771f\u5b9e\u9690\u79c1"
)

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

function Add-Issue {
    param([string]$Message)
    $Issues.Add($Message) | Out-Null
}

function Test-RequiredFile {
    param([string]$RelativePath)
    $Path = Join-Path $Root $RelativePath
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Add-Issue "Missing file: $RelativePath"
    }
}

function Test-RequiredDirectory {
    param([string]$RelativePath)
    $Path = Join-Path $Root $RelativePath
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        Add-Issue "Missing directory: $RelativePath"
    }
}

function Test-ContainsText {
    param([string]$RelativePath, [string]$ExpectedText)
    $Path = Join-Path $Root $RelativePath
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return
    }

    $Content = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if (-not $Content.Contains($ExpectedText)) {
        Add-Issue "File '$RelativePath' does not reference '$ExpectedText'"
    }
}

function Test-NonPlaceholder {
    param([string]$Value, [string]$Field)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        Add-Issue "$Field must not be empty"
        return
    }

    if (-not $AllowPlaceholders -and ($Value -match "<[^>]+>" -or $Value -match "YYYY")) {
        Add-Issue "$Field still contains a placeholder"
    }
}

function Test-NoSensitiveObject {
    param([object]$Value, [string]$Field)
    if ($null -eq $Value) {
        return
    }

    if ($Value -is [string]) {
        foreach ($Pattern in $SensitivePatterns) {
            if ($Value -match $Pattern) {
                Add-Issue "$Field contains sensitive marker '$($Matches[0])'"
                return
            }
        }
        return
    }

    if ($Value -is [System.Array]) {
        for ($Index = 0; $Index -lt $Value.Count; $Index++) {
            Test-NoSensitiveObject $Value[$Index] "$Field[$Index]"
        }
        return
    }

    if ($Value -is [System.Management.Automation.PSCustomObject]) {
        foreach ($Property in $Value.PSObject.Properties) {
            Test-NoSensitiveObject $Property.Value "$Field.$($Property.Name)"
        }
    }
}

function Test-DateString {
    param([string]$Value, [string]$Field)
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -notmatch "^\d{4}-\d{2}-\d{2}$") {
        Add-Issue "$Field must use YYYY-MM-DD"
    }
}

function Test-EvidencePath {
    param([string]$Value, [string]$Field)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        Add-Issue "$Field must not be empty"
        return
    }

    if ($Value -match "^(https?://|user-confirmed:)") {
        return
    }

    $Candidate = Join-Path $Root $Value
    if (-not (Test-Path -LiteralPath $Candidate)) {
        Add-Issue "$Field references missing path '$Value'"
    }
}

function Test-MemoryLine {
    param([string]$RelativePath, [string]$Line, [int]$LineNumber)
    try {
        $Record = $Line | ConvertFrom-Json
    }
    catch {
        Add-Issue "$RelativePath line $LineNumber is not valid JSON: $($_.Exception.Message)"
        return
    }

    foreach ($Field in @("id", "status", "type", "scope", "summary", "source", "evidence", "confidence", "last_verified", "tags")) {
        if (-not ($Record.PSObject.Properties.Name -contains $Field)) {
            Add-Issue "$RelativePath line $LineNumber missing field '$Field'"
        }
    }

    if ($Record.id) {
        Test-NonPlaceholder ([string]$Record.id) "$RelativePath line $LineNumber id"
        if (-not $MemoryIds.Add([string]$Record.id)) {
            Add-Issue "$RelativePath line $LineNumber duplicates memory id '$($Record.id)'"
        }
    }

    if ($Record.status -and @("current", "draft", "assumption", "stale", "deprecated") -notcontains $Record.status) {
        Add-Issue "$RelativePath line $LineNumber has invalid status '$($Record.status)'"
    }

    if ($Record.confidence -and @("high", "medium", "low") -notcontains $Record.confidence) {
        Add-Issue "$RelativePath line $LineNumber has invalid confidence '$($Record.confidence)'"
    }

    if ($Record.scope -isnot [System.Array] -or $Record.scope.Count -eq 0) {
        Add-Issue "$RelativePath line $LineNumber scope must be a non-empty array"
    }

    if ($Record.tags -isnot [System.Array]) {
        Add-Issue "$RelativePath line $LineNumber tags must be an array"
    }

    if ($Record.source) {
        foreach ($Field in @("kind", "ref", "date")) {
            if (-not ($Record.source.PSObject.Properties.Name -contains $Field)) {
                Add-Issue "$RelativePath line $LineNumber source missing field '$Field'"
            }
        }
        Test-DateString ([string]$Record.source.date) "$RelativePath line $LineNumber source.date"
    }

    Test-DateString ([string]$Record.last_verified) "$RelativePath line $LineNumber last_verified"
    Test-NoSensitiveObject $Record "$RelativePath line $LineNumber"

    foreach ($Evidence in @($Record.evidence)) {
        Test-EvidencePath ([string]$Evidence) "$RelativePath line $LineNumber evidence"
    }
}

function Test-MarkdownLinks {
    $MarkdownPaths = @(& git -C $Root ls-files --cached --others --exclude-standard -- "*.md" 2>$null)
    if ($LASTEXITCODE -ne 0) {
        Add-Issue "Unable to list project Markdown files with Git"
        return
    }

    foreach ($RelativePath in $MarkdownPaths) {
        $FilePath = Join-Path $Root $RelativePath
        if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
            continue
        }
        $File = Get-Item -LiteralPath $FilePath
        $Content = Get-Content -LiteralPath $File.FullName -Raw -Encoding UTF8
        $Matches = [regex]::Matches($Content, "\[[^\]]+\]\(([^)]+)\)")
        foreach ($Match in $Matches) {
            $Target = $Match.Groups[1].Value.Trim()
            if ($Target -match "^(https?://|#|mailto:)") {
                continue
            }
            $TargetPath = ($Target -split "#", 2)[0]
            if ([string]::IsNullOrWhiteSpace($TargetPath)) {
                continue
            }
            $Resolved = Join-Path $File.DirectoryName $TargetPath
            if (-not (Test-Path -LiteralPath $Resolved)) {
                Add-Issue "Broken Markdown link in '$($File.FullName.Substring($Root.Length + 1))': $Target"
            }
        }
    }
}

try {
    $Root = (Resolve-Path -LiteralPath $ProjectRoot).Path
}
catch {
    Write-Host "Agent project check failed: project root not found: $ProjectRoot" -ForegroundColor Red
    exit 1
}

$RequiredDirectories = @(
    ".agent-context/memory-sources",
    "docs/product",
    "docs/architecture",
    "docs/domain",
    "docs/modules",
    "docs/business",
    "docs/contracts",
    "docs/decisions",
    "docs/plans",
    "docs/quality"
)
$RequiredFiles = @(
    "AGENTS.md",
    "README.md",
    ".agent-context/config.json",
    ".agent-context/memory-sources/README.md",
    ".gitignore",
    ".gitattributes",
    "docs/00-index.md",
    "docs/domain/00-glossary.md",
    "docs/domain/01-core-domain-model.md",
    "docs/product/05-build-sequence.md",
    "docs/architecture/09-repository-and-deployable-apps.md",
    "docs/architecture/10-three-end-risk-review.md",
    "docs/modules/mobile-web.md",
    "docs/modules/identity-access.md",
    "docs/modules/conversation-runtime.md",
    "docs/modules/agent-orchestration.md",
    "docs/modules/task-orchestration.md",
    "docs/modules/memory-service.md",
    "docs/modules/workstation-gateway.md",
    "docs/modules/reminder-notification.md",
    "docs/business/04-identity-and-device-flow.md",
    "docs/contracts/02-cloud-public-api.md",
    "docs/contracts/03-workstation-channel.md",
    "docs/decisions/0004-three-app-monorepo.md",
    "docs/plans/0002-v2-design-readiness.md",
    "docs/plans/0003-three-app-architecture-review.md",
    "docs/quality/02-phase-1-design-acceptance.md"
)

foreach ($Directory in $RequiredDirectories) { Test-RequiredDirectory $Directory }
foreach ($File in $RequiredFiles) { Test-RequiredFile $File }

Test-ContainsText "AGENTS.md" ".agent-context/config.json"
Test-ContainsText "AGENTS.md" "Agent Context OS"
Test-ContainsText "AGENTS.md" "local-index"
Test-ContainsText ".gitignore" ".agent-context/local-index/"
Test-ContainsText ".gitignore" ".agent-context/cache/"
Test-ContainsText ".gitattributes" "*.ps1 text eol=crlf"
Test-ContainsText "docs/00-index.md" "docs/architecture"

if (Test-Path -LiteralPath (Join-Path $Root "docs/agent")) {
    Add-Issue "Legacy docs/agent must not exist in the V2 thin-launcher project"
}

$ConfigPath = Join-Path $Root ".agent-context/config.json"
$Config = $null
if (Test-Path -LiteralPath $ConfigPath -PathType Leaf) {
    try {
        $Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        Add-Issue ".agent-context/config.json is not valid JSON: $($_.Exception.Message)"
    }
}

if ($Config) {
    foreach ($Field in @("schema_version", "project_id", "project_name", "engine", "memory", "quality")) {
        if (-not ($Config.PSObject.Properties.Name -contains $Field)) {
            Add-Issue ".agent-context/config.json missing field '$Field'"
        }
    }
    Test-NonPlaceholder ([string]$Config.project_id) "project_id"
    Test-NonPlaceholder ([string]$Config.project_name) "project_name"

    if ($Config.engine.mode -ne "thin-launcher") {
        Add-Issue "engine.mode must be 'thin-launcher'"
    }
    foreach ($Field in @("name", "mode", "version", "source")) {
        Test-NonPlaceholder ([string]$Config.engine.$Field) "engine.$Field"
    }

    if ($Config.memory.local_index.git_tracked -ne $false) {
        Add-Issue "memory.local_index.git_tracked must be false"
    }
    foreach ($Field in @("provider", "path")) {
        Test-NonPlaceholder ([string]$Config.memory.local_index.$Field) "memory.local_index.$Field"
    }
    if ($Config.quality.validation_commands.Count -eq 0) {
        Add-Issue "quality.validation_commands must not be empty"
    }

    $MemoryFiles = New-Object System.Collections.Generic.List[object]
    foreach ($SourcePath in @($Config.memory.source_paths)) {
        Test-NonPlaceholder ([string]$SourcePath) "memory.source_paths"
        if ([string]$SourcePath -notlike "*.jsonl" -or [string]$SourcePath -like "*_example*") {
            Add-Issue "memory.source_paths must target formal JSONL files only: $SourcePath"
            continue
        }
        $Matches = @(Get-ChildItem -Path (Join-Path $Root ([string]$SourcePath)) -File -ErrorAction SilentlyContinue)
        foreach ($Match in $Matches) { $MemoryFiles.Add($Match) | Out-Null }
    }

    if ($MemoryFiles.Count -eq 0 -and -not $AllowPlaceholders) {
        Add-Issue "memory.source_paths did not match any JSONL memory source"
    }

    foreach ($File in $MemoryFiles) {
        $RelativePath = $File.FullName.Substring($Root.Length + 1)
        $Lines = @(Get-Content -LiteralPath $File.FullName -Encoding UTF8)
        $NonEmpty = 0
        for ($Index = 0; $Index -lt $Lines.Count; $Index++) {
            $Line = $Lines[$Index].Trim()
            if ([string]::IsNullOrWhiteSpace($Line)) { continue }
            $NonEmpty++
            Test-MemoryLine $RelativePath $Line ($Index + 1)
        }
        if ($NonEmpty -eq 0 -and -not $AllowPlaceholders) {
            Add-Issue "$RelativePath must contain at least one memory record"
        }
    }
}

Test-MarkdownLinks

if ($Issues.Count -gt 0) {
    Write-Host "Agent project check failed:" -ForegroundColor Red
    foreach ($Issue in $Issues) {
        Write-Host (" - " + $Issue) -ForegroundColor Red
    }
    exit 1
}

Write-Host "Agent project check passed." -ForegroundColor Green
exit 0
