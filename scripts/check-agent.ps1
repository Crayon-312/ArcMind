[CmdletBinding()]
param([string]$ProjectRoot = "")

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = Split-Path -Parent $PSScriptRoot
}
$Root = (Resolve-Path -LiteralPath $ProjectRoot).Path
$Vault = Join-Path $Root "knowledge"
$Issues = New-Object System.Collections.Generic.List[string]

function Add-Issue([string]$Message) {
    $Issues.Add($Message) | Out-Null
}

function Test-RequiredFile([string]$RelativePath) {
    if (-not (Test-Path -LiteralPath (Join-Path $Root $RelativePath) -PathType Leaf)) {
        Add-Issue "Missing file: $RelativePath"
    }
}

function Test-RequiredDirectory([string]$RelativePath) {
    if (-not (Test-Path -LiteralPath (Join-Path $Root $RelativePath) -PathType Container)) {
        Add-Issue "Missing directory: $RelativePath"
    }
}

function Get-FrontmatterValue([string]$Content, [string]$Field) {
    foreach ($Line in ($Content -split "`r?`n")) {
        if ($Line -match ('^' + [regex]::Escape($Field) + ':\s*(.*)$')) {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return ''
}

function Get-InternalMarkdownTargets([string]$FilePath) {
    $Targets = New-Object System.Collections.Generic.List[string]
    $File = Get-Item -LiteralPath $FilePath
    $Content = Get-Content -LiteralPath $File.FullName -Raw -Encoding UTF8
    foreach ($Match in [regex]::Matches($Content, '(?<!!)\[[^\]]+\]\(([^)]+)\)')) {
        $Target = $Match.Groups[1].Value.Trim()
        if ($Target -match '^(https?://|#|mailto:)') { continue }
        $PathPart = ($Target -split '#', 2)[0]
        if ([string]::IsNullOrWhiteSpace($PathPart)) { continue }
        $Decoded = [Uri]::UnescapeDataString($PathPart).Replace('/', '\')
        $Resolved = [IO.Path]::GetFullPath((Join-Path $File.DirectoryName $Decoded))
        if ([IO.Path]::GetExtension($Resolved) -eq '.md') {
            $Targets.Add($Resolved) | Out-Null
        }
    }
    return $Targets.ToArray()
}

function Test-MarkdownLinks {
    $MarkdownFiles = @(Get-ChildItem -LiteralPath $Root -Recurse -File -Filter '*.md' | Where-Object {
        $_.FullName -notmatch '[\\/](node_modules|\.git|\.claude|\.venv)[\\/]'
    })
    foreach ($File in $MarkdownFiles) {
        $Content = Get-Content -LiteralPath $File.FullName -Raw -Encoding UTF8
        foreach ($Match in [regex]::Matches($Content, '(?<!!)\[[^\]]+\]\(([^)]+)\)')) {
            $Target = $Match.Groups[1].Value.Trim()
            if ($Target -match '^(https?://|#|mailto:)') { continue }
            $PathPart = ($Target -split '#', 2)[0]
            if ([string]::IsNullOrWhiteSpace($PathPart)) { continue }
            $Decoded = [Uri]::UnescapeDataString($PathPart).Replace('/', '\')
            $Resolved = [IO.Path]::GetFullPath((Join-Path $File.DirectoryName $Decoded))
            if (-not (Test-Path -LiteralPath $Resolved)) {
                Add-Issue "Broken Markdown link in '$($File.FullName.Substring($Root.Length + 1))': $Target"
            }
        }
    }
}

function Test-KnowledgeLayout {
    if (-not (Test-Path -LiteralPath $Vault -PathType Container)) { return }

    if (Test-Path -LiteralPath (Join-Path $Root 'docs')) {
        Add-Issue "Legacy docs knowledge root must not exist"
    }

    $AllowedTopDirectories = @(
        '.obsidian', '00-入口', '01-项目定义', '02-业务模型', '03-系统架构',
        '04-接口与事件', '05-数据模型', '06-前端设计', '07-后端设计',
        '08-安全与合规', '09-技术调研', '10-架构决策', '11-测试与验收',
        '12-运行手册', '13-已知问题', '14-开发方案', '15-发布记录',
        '20-Agent运行时', '21-实时语音', '22-工作机执行端', '23-任务与提醒',
        '24-产品记忆与上下文', '90-模板', '99-归档', '_attachments'
    )
    foreach ($Directory in Get-ChildItem -LiteralPath $Vault -Directory) {
        if ($AllowedTopDirectories -notcontains $Directory.Name) {
            Add-Issue "Unregistered top-level knowledge directory: $($Directory.Name)"
        }
    }

    $DomainMaps = [ordered]@{
        '01-项目定义' = '00-项目定义地图.md'
        '02-业务模型' = '00-业务模型地图.md'
        '03-系统架构' = '00-系统架构地图.md'
        '04-接口与事件' = '00-接口与事件地图.md'
        '05-数据模型' = '00-数据模型地图.md'
        '06-前端设计' = '00-前端设计地图.md'
        '07-后端设计' = '00-后端设计地图.md'
        '08-安全与合规' = '00-安全与合规地图.md'
        '09-技术调研' = '00-技术调研地图.md'
        '10-架构决策' = '00-架构决策地图.md'
        '11-测试与验收' = '00-测试与验收地图.md'
        '12-运行手册' = '00-运行手册地图.md'
        '13-已知问题' = '00-已知问题地图.md'
        '15-发布记录' = '00-发布记录地图.md'
        '20-Agent运行时' = '00-Agent运行时地图.md'
        '21-实时语音' = '00-实时语音地图.md'
        '22-工作机执行端' = '00-工作机执行端地图.md'
        '23-任务与提醒' = '00-任务与提醒地图.md'
        '24-产品记忆与上下文' = '00-产品记忆与上下文地图.md'
    }
    foreach ($Entry in $DomainMaps.GetEnumerator()) {
        $DomainRoot = Join-Path $Vault $Entry.Key
        $MapPath = Join-Path $DomainRoot $Entry.Value
        if (-not (Test-Path -LiteralPath $MapPath -PathType Leaf)) {
            Add-Issue "Knowledge domain is missing its unique map: knowledge/$($Entry.Key)/$($Entry.Value)"
            continue
        }
        $Mapped = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
        foreach ($Target in @(Get-InternalMarkdownTargets $MapPath)) { $Mapped.Add($Target) | Out-Null }
        foreach ($File in @(Get-ChildItem -LiteralPath $DomainRoot -File -Filter '*.md')) {
            if ($File.Name -eq $Entry.Value) { continue }
            if (-not $Mapped.Contains($File.FullName)) {
                Add-Issue "Knowledge document is not listed by its domain map: $($File.FullName.Substring($Root.Length + 1))"
            }
        }
    }
}

function Test-KnowledgeRecords {
    if (-not (Test-Path -LiteralPath $Vault -PathType Container)) { return }
    $ExcludedPattern = '[\\/](14-开发方案|90-模板|99-归档|_attachments)[\\/]'
    $Documents = @(Get-ChildItem -LiteralPath $Vault -Recurse -File -Filter '*.md' | Where-Object {
        $_.FullName -notmatch $ExcludedPattern
    })
    $SeenIds = @{}
    $KnownPaths = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $Degrees = @{}
    foreach ($Document in $Documents) {
        $KnownPaths.Add($Document.FullName) | Out-Null
        $Degrees[$Document.FullName] = 0
    }
    foreach ($Document in $Documents) {
        $Content = Get-Content -LiteralPath $Document.FullName -Raw -Encoding UTF8
        foreach ($Field in @('id', 'type', 'status', 'summary')) {
            if ([string]::IsNullOrWhiteSpace((Get-FrontmatterValue $Content $Field))) {
                Add-Issue "$($Document.FullName.Substring($Root.Length + 1)) missing required frontmatter '$Field'"
            }
        }
        $Id = Get-FrontmatterValue $Content 'id'
        if (-not [string]::IsNullOrWhiteSpace($Id)) {
            if ($SeenIds.ContainsKey($Id)) { Add-Issue "Duplicate knowledge id: $Id" }
            $SeenIds[$Id] = $Document.FullName
        }
        $Summary = Get-FrontmatterValue $Content 'summary'
        if ($Summary -match '(当前事实、边界与关联依据|Knowledge note:)') {
            Add-Issue "Low-information summary in $($Document.FullName.Substring($Root.Length + 1))"
        }
        foreach ($Target in @(Get-InternalMarkdownTargets $Document.FullName)) {
            if ($KnownPaths.Contains($Target)) {
                $Degrees[$Document.FullName]++
                $Degrees[$Target]++
            }
        }
    }
    foreach ($Document in $Documents) {
        $Content = Get-Content -LiteralPath $Document.FullName -Raw -Encoding UTF8
        $Status = Get-FrontmatterValue $Content 'status'
        if ($Status -eq 'current' -and [int]$Degrees[$Document.FullName] -eq 0) {
            Add-Issue "Current knowledge document is isolated: $($Document.FullName.Substring($Root.Length + 1))"
        }
    }
}

function Test-KnowledgeStatusLinks {
    if (-not (Test-Path -LiteralPath $Vault -PathType Container)) { return }
    $ExcludedTopDirectories = @('14-开发方案', '90-模板', '99-归档', '_attachments')
    $Documents = @(Get-ChildItem -LiteralPath $Vault -Recurse -File -Filter '*.md' | Where-Object {
        $RelativePath = $_.FullName.Substring($Vault.Length + 1)
        $TopDirectory = ($RelativePath -split '[\\/]')[0]
        $ExcludedTopDirectories -notcontains $TopDirectory
    })
    $Metadata = @{}
    foreach ($Document in $Documents) {
        $Content = Get-Content -LiteralPath $Document.FullName -Raw -Encoding UTF8
        $Metadata[$Document.FullName] = [pscustomobject]@{
            Status = Get-FrontmatterValue $Content 'status'
            Type = Get-FrontmatterValue $Content 'type'
        }
    }
    foreach ($Document in $Documents) {
        $Content = Get-Content -LiteralPath $Document.FullName -Raw -Encoding UTF8
        if ($Metadata[$Document.FullName].Status -ne 'current') { continue }
        foreach ($Match in [regex]::Matches($Content, '(?<!!)\[([^\]]+)\]\(([^)]+)\)')) {
            $Label = $Match.Groups[1].Value.Trim()
            $Target = $Match.Groups[2].Value.Trim()
            if ($Target -match '^(https?://|#|mailto:)') { continue }
            $PathPart = ($Target -split '#', 2)[0]
            if ([string]::IsNullOrWhiteSpace($PathPart)) { continue }
            $Decoded = [Uri]::UnescapeDataString($PathPart).Replace('/', '\')
            $Resolved = [IO.Path]::GetFullPath((Join-Path $Document.DirectoryName $Decoded))
            if (-not $Metadata.ContainsKey($Resolved)) { continue }
            $TargetMetadata = $Metadata[$Resolved]
            if ($TargetMetadata.Status -ne 'draft' -or $TargetMetadata.Type -eq 'open_question') { continue }
            if ($Label -notmatch '(草案|待定|待确认|开放问题|未决|待验收|仍待)') {
                Add-Issue "Current knowledge links to draft without a status label: $($Document.FullName.Substring($Root.Length + 1)) -> $Label"
            }
        }
    }
}

function Test-TaskCapsules {
    $PlanRoot = Join-Path $Vault '14-开发方案'
    if (-not (Test-Path -LiteralPath $PlanRoot -PathType Container)) { return }
    foreach ($File in @(Get-ChildItem -LiteralPath $PlanRoot -File -Filter '*.md' | Where-Object { $_.Name -match '^\d{4}-' })) {
        $Content = Get-Content -LiteralPath $File.FullName -Raw -Encoding UTF8
        foreach ($Field in @('type', 'status', 'task_id', 'change_level')) {
            if ([string]::IsNullOrWhiteSpace((Get-FrontmatterValue $Content $Field))) {
                Add-Issue "Task capsule $($File.Name) missing frontmatter '$Field'"
            }
        }
        if ((Get-FrontmatterValue $Content 'type') -ne 'task-capsule') {
            Add-Issue "Task capsule $($File.Name) must use type task-capsule"
        }
        $Status = Get-FrontmatterValue $Content 'status'
        if (@('draft', 'confirmed', 'active', 'done', 'superseded') -notcontains $Status) {
            Add-Issue "Task capsule $($File.Name) has invalid status '$Status'"
        }
        if ($Status -in @('confirmed', 'active') -and $Content -notmatch '(有序任务清单|任务清单)') {
            Add-Issue "Executable task capsule $($File.Name) has no ordered task list"
        }
    }
}

$RequiredDirectories = @(
    'knowledge/00-入口', 'knowledge/01-项目定义', 'knowledge/02-业务模型',
    'knowledge/03-系统架构', 'knowledge/04-接口与事件', 'knowledge/05-数据模型',
    'knowledge/06-前端设计', 'knowledge/07-后端设计', 'knowledge/08-安全与合规',
    'knowledge/09-技术调研', 'knowledge/10-架构决策', 'knowledge/11-测试与验收',
    'knowledge/12-运行手册', 'knowledge/13-已知问题', 'knowledge/14-开发方案',
    'knowledge/15-发布记录', 'knowledge/20-Agent运行时', 'knowledge/21-实时语音',
    'knowledge/22-工作机执行端', 'knowledge/23-任务与提醒', 'knowledge/24-产品记忆与上下文',
    'knowledge/90-模板', 'knowledge/99-归档'
)
foreach ($Directory in $RequiredDirectories) { Test-RequiredDirectory $Directory }
foreach ($File in @(
    'AGENTS.md', 'README.md', '.agent-context/config.json', '.gitignore', '.gitattributes',
    'knowledge/00-入口/00-知识库总地图.md', 'knowledge/00-入口/知识库首页.md',
    'knowledge/00-入口/开发者入口.md', 'knowledge/00-入口/知识库维护规范.md',
    'knowledge/14-开发方案/00-开发方案地图.md', 'knowledge/90-模板/任务舱模板.md'
)) { Test-RequiredFile $File }

if (Test-Path -LiteralPath (Join-Path $Root '.agent-context/memory-sources')) {
    Add-Issue 'Legacy .agent-context/memory-sources must not exist'
}

$ConfigPath = Join-Path $Root '.agent-context/config.json'
if (Test-Path -LiteralPath $ConfigPath -PathType Leaf) {
    try { $Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json }
    catch { Add-Issue ".agent-context/config.json is invalid JSON: $($_.Exception.Message)"; $Config = $null }
    if ($Config) {
        if ($Config.schema_version -ne 3) { Add-Issue 'schema_version must be 3' }
        if ($Config.agent.mode -ne 'thin-launcher') { Add-Issue "agent.mode must be thin-launcher" }
        if ($Config.agent.version -ne '0.2.0-fd84369+arcmind-retrieval.1') {
            Add-Issue 'agent.version must identify the fixed upstream commit and ArcMind retrieval patch'
        }
        $Sources = @($Config.memory.sources)
        if ($Sources.Count -ne 1) { Add-Issue 'ArcMind must configure exactly one knowledge source' }
        elseif ($Sources[0].provider -ne 'obsidian' -or $Sources[0].path -ne 'knowledge') {
            Add-Issue 'ArcMind knowledge source must be the knowledge Obsidian vault'
        }
        $RequiredExcludes = @('14-开发方案', '90-模板', '99-归档', '_attachments')
        foreach ($Excluded in $RequiredExcludes) {
            if (@($Sources[0].exclude_directories) -notcontains $Excluded) {
                Add-Issue "Knowledge source must exclude $Excluded"
            }
        }
        if ($Config.memory.local_index.provider -ne 'embedded-json' -or $Config.memory.local_index.git_tracked -ne $false) {
            Add-Issue 'Local index must use untracked embedded-json'
        }
    }
}

Test-MarkdownLinks
Test-KnowledgeLayout
Test-KnowledgeRecords
Test-KnowledgeStatusLinks
Test-TaskCapsules

if ($Issues.Count -gt 0) {
    Write-Host 'Agent project check failed:' -ForegroundColor Red
    foreach ($Issue in $Issues) { Write-Host (' - ' + $Issue) -ForegroundColor Red }
    exit 1
}

Write-Host 'Agent project check passed.' -ForegroundColor Green
exit 0
