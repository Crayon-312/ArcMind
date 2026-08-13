[CmdletBinding()]
param(
    [string]$ProjectRoot = "",
    [switch]$AllowPlaceholders
)

$ErrorActionPreference = "Stop"
$Issues = New-Object System.Collections.Generic.List[string]
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

function Get-InternalMarkdownTargets {
    param([string]$FilePath)

    $Targets = New-Object System.Collections.Generic.List[string]
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
        $Resolved = [System.IO.Path]::GetFullPath((Join-Path $File.DirectoryName $TargetPath))
        if ([System.IO.Path]::GetExtension($Resolved) -eq ".md") {
            $Targets.Add($Resolved) | Out-Null
        }
    }
    return $Targets.ToArray()
}

function Test-KnowledgeGraph {
    $DocsRoot = Join-Path $Root "docs"
    if (-not (Test-Path -LiteralPath $DocsRoot -PathType Container)) {
        return
    }

    $MarkdownFiles = @(Get-ChildItem -LiteralPath $DocsRoot -Recurse -File -Filter "*.md")
    $KnownPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $Degrees = @{}
    foreach ($File in $MarkdownFiles) {
        $KnownPaths.Add($File.FullName) | Out-Null
        $Degrees[$File.FullName] = 0
    }

    foreach ($File in $MarkdownFiles) {
        foreach ($Target in @(Get-InternalMarkdownTargets $File.FullName)) {
            if ($KnownPaths.Contains($Target)) {
                $Degrees[$File.FullName]++
                $Degrees[$Target]++
            }
        }
    }

    foreach ($File in $MarkdownFiles) {
        $Content = Get-Content -LiteralPath $File.FullName -Raw -Encoding UTF8
        $IsPublishedKnowledge = [regex]::IsMatch($Content, '(?m)^status:\s*"?current"?\s*$') -or [regex]::IsMatch($Content, '(?m)^\u72b6\u6001\uff1a(current|accepted)\s*$')
        $LinkDegree = [int]$Degrees[$File.FullName]
        if ($IsPublishedKnowledge -and $LinkDegree -eq 0) {
            Add-Issue "Current knowledge document is isolated: $($File.FullName.Substring($Root.Length + 1))"
        }
    }

    $KnowledgeDomains = [ordered]@{
        "product" = "00-product-map.md"
        "domain" = "00-domain-map.md"
        "architecture" = "00-architecture-map.md"
        "modules" = "00-modules-map.md"
        "business" = "00-business-map.md"
        "contracts" = "00-contracts-map.md"
        "decisions" = "00-decisions-map.md"
        "plans" = "00-plans-map.md"
        "quality" = "00-quality-map.md"
    }
    foreach ($Entry in $KnowledgeDomains.GetEnumerator()) {
        $Domain = $Entry.Key
        $DomainRoot = Join-Path $DocsRoot $Domain
        $IndexPath = Join-Path $DomainRoot $Entry.Value
        if (-not (Test-Path -LiteralPath $IndexPath -PathType Leaf)) {
            Add-Issue "Knowledge domain is missing content map: docs/$Domain/$($Entry.Value)"
            continue
        }

        $MappedPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
        foreach ($Target in @(Get-InternalMarkdownTargets $IndexPath)) {
            $MappedPaths.Add($Target) | Out-Null
        }
        foreach ($File in @(Get-ChildItem -LiteralPath $DomainRoot -File -Filter "*.md")) {
            if ($File.Name -eq $Entry.Value) {
                continue
            }
            if (-not $MappedPaths.Contains($File.FullName)) {
                Add-Issue "Knowledge document is not listed by its domain map: $($File.FullName.Substring($Root.Length + 1))"
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
    "docs/product",
    "docs/architecture",
    "docs/domain",
    "docs/modules",
    "docs/business",
    "docs/contracts",
    "docs/decisions",
    "docs/plans",
    "docs/quality"
    "docs/project-memory"
)
$RequiredFiles = @(
    "AGENTS.md",
    "README.md",
    ".agent-context/config.json",
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
    "docs/project-memory/00-project-memory-map.md"
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
if (Test-Path -LiteralPath (Join-Path $Root ".agent-context/memory-sources")) {
    Add-Issue "Legacy .agent-context/memory-sources must not exist after the schema 3 migration"
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
    foreach ($Field in @("schema_version", "project_id", "project_name", "agent", "memory", "quality")) {
        if (-not ($Config.PSObject.Properties.Name -contains $Field)) {
            Add-Issue ".agent-context/config.json missing field '$Field'"
        }
    }
    Test-NonPlaceholder ([string]$Config.project_id) "project_id"
    Test-NonPlaceholder ([string]$Config.project_name) "project_name"

    if ($Config.schema_version -ne 3) {
        Add-Issue "schema_version must be 3"
    }
    if ($Config.PSObject.Properties.Name -contains "engine") {
        Add-Issue "schema 3 must use 'agent', not legacy 'engine'"
    }
    if ($Config.agent.mode -ne "thin-launcher") {
        Add-Issue "agent.mode must be 'thin-launcher'"
    }
    foreach ($Field in @("name", "mode", "version", "source")) {
        Test-NonPlaceholder ([string]$Config.agent.$Field) "agent.$Field"
    }

    if ($Config.memory.local_index.git_tracked -ne $false) {
        Add-Issue "memory.local_index.git_tracked must be false"
    }
    foreach ($Field in @("provider", "path")) {
        Test-NonPlaceholder ([string]$Config.memory.local_index.$Field) "memory.local_index.$Field"
    }
    if ($Config.memory.local_index.provider -ne "embedded-json") {
        Add-Issue "memory.local_index.provider must be 'embedded-json'"
    }
    if ($Config.quality.validation_commands.Count -eq 0) {
        Add-Issue "quality.validation_commands must not be empty"
    }
    if ($Config.memory.PSObject.Properties.Name -contains "source_paths") {
        Add-Issue "schema 3 must not contain legacy memory.source_paths"
    }
    $Sources = @($Config.memory.sources)
    if ($Sources.Count -ne 1) {
        Add-Issue "ArcMind schema 3 must configure exactly one Obsidian knowledge source"
    }
    foreach ($Source in $Sources) {
        foreach ($Field in @("id", "provider", "path")) {
            Test-NonPlaceholder ([string]$Source.$Field) "memory.sources.$Field"
        }
        if ($Source.provider -ne "obsidian") {
            Add-Issue "ArcMind knowledge source must use the Obsidian provider"
        }
        if ($Source.path -ne "docs") {
            Add-Issue "ArcMind Obsidian knowledge source must be 'docs'"
        }
    }
}

Test-MarkdownLinks
Test-KnowledgeGraph

if ($Issues.Count -gt 0) {
    Write-Host "Agent project check failed:" -ForegroundColor Red
    foreach ($Issue in $Issues) {
        Write-Host (" - " + $Issue) -ForegroundColor Red
    }
    exit 1
}

Write-Host "Agent project check passed." -ForegroundColor Green
exit 0
