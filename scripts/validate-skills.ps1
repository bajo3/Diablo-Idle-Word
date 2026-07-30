[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$skillsRoot = Join-Path $repoRoot '.agents\skills'

$required = [ordered]@{
    'game-architect' = 'references/architecture-principles.md'
    'combat-system' = 'references/combat-formulas.md'
    'classes-and-skills' = 'references/class-design.md'
    'loot-and-items' = 'references/item-generation.md'
    'idle-progression' = 'references/idle-calculations.md'
    'multiplayer-authority' = 'references/multiplayer-security.md'
    'enemy-and-dungeon-generator' = 'references/content-generation.md'
    'game-balance' = 'references/balance-metrics.md'
    'save-and-migrations' = 'references/save-versioning.md'
    'automated-playtesting' = 'references/test-scenarios.md'
    'performance-2d' = 'references/performance-budget.md'
    'pixel-art-pipeline' = 'references/asset-conventions.md'
}

$requiredHeadings = @(
    '# Purpose',
    '# Trigger conditions',
    '# Do not use when',
    '# Required context',
    '# Workflow',
    '# Architecture rules',
    '# Implementation rules',
    '# Validation',
    '# Required output',
    '# Definition of done',
    '# Related documentation'
)

$errors = [System.Collections.Generic.List[string]]::new()
$names = [System.Collections.Generic.List[string]]::new()

function Add-ValidationError {
    param([string]$Message)
    $errors.Add($Message)
}

function Get-RelativeDisplayPath {
    param([string]$Path)
    return [System.IO.Path]::GetRelativePath($repoRoot, $Path).Replace('\', '/')
}

foreach ($skillName in $required.Keys) {
    $skillDir = Join-Path $skillsRoot $skillName
    $skillFile = Join-Path $skillDir 'SKILL.md'
    $referenceFile = Join-Path $skillDir $required[$skillName]

    if (-not (Test-Path -LiteralPath $skillDir -PathType Container)) {
        Add-ValidationError "Falta carpeta: .agents/skills/$skillName"
        continue
    }
    if (-not (Test-Path -LiteralPath $skillFile -PathType Leaf)) {
        Add-ValidationError "Falta SKILL.md: .agents/skills/$skillName/SKILL.md"
        continue
    }
    if (-not (Test-Path -LiteralPath $referenceFile -PathType Leaf)) {
        Add-ValidationError "Falta referencia: .agents/skills/$skillName/$($required[$skillName])"
    }

    $content = Get-Content -Raw -LiteralPath $skillFile -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($content)) {
        Add-ValidationError "Archivo vacio: .agents/skills/$skillName/SKILL.md"
        continue
    }

    $frontmatter = [regex]::Match(
        $content,
        '\A---\r?\n(?<yaml>.*?)\r?\n---(?:\r?\n|\z)',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
    if (-not $frontmatter.Success) {
        Add-ValidationError "Frontmatter invalido o ausente: .agents/skills/$skillName/SKILL.md"
        continue
    }

    $yaml = $frontmatter.Groups['yaml'].Value
    $nameMatch = [regex]::Match($yaml, '(?m)^name:\s*(?<value>[a-z0-9-]+)\s*$')
    $descriptionMatch = [regex]::Match($yaml, '(?m)^description:\s*(?<value>\S.*)\s*$')
    if (-not $nameMatch.Success) {
        Add-ValidationError "Falta name valido: .agents/skills/$skillName/SKILL.md"
    } else {
        $actualName = $nameMatch.Groups['value'].Value
        $names.Add($actualName)
        if ($actualName -ne $skillName) {
            Add-ValidationError "El name '$actualName' no coincide con la carpeta '$skillName'."
        }
    }
    if (-not $descriptionMatch.Success) {
        Add-ValidationError "Falta description no vacia: .agents/skills/$skillName/SKILL.md"
    }

    foreach ($heading in $requiredHeadings) {
        if ($content -notmatch "(?m)^$([regex]::Escape($heading))\s*$") {
            Add-ValidationError "Falta seccion '$heading' en .agents/skills/$skillName/SKILL.md"
        }
    }
}

$duplicates = $names | Group-Object | Where-Object Count -gt 1
foreach ($duplicate in $duplicates) {
    Add-ValidationError "Nombre de skill duplicado: $($duplicate.Name)"
}

$requiredMarkdown = @(
    'AGENTS.md',
    'PLANS.md',
    'GAME_DESIGN.md',
    'docs/game/architecture.md',
    'docs/game/combat.md',
    'docs/game/classes.md',
    'docs/game/items-and-loot.md',
    'docs/game/idle-progression.md',
    'docs/game/multiplayer.md',
    'docs/game/enemies-and-dungeons.md',
    'docs/game/balance.md',
    'docs/game/saves.md',
    'docs/game/testing.md',
    'docs/game/performance.md',
    'docs/game/art-pipeline.md',
    'docs/game/glossary.md',
    '.agents/skills/game-balance/scripts/README.md',
    '.agents/skills/automated-playtesting/scripts/README.md'
)

foreach ($relativePath in $requiredMarkdown) {
    $fullPath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        Add-ValidationError "Falta archivo requerido: $relativePath"
    } elseif ([string]::IsNullOrWhiteSpace((Get-Content -Raw -LiteralPath $fullPath -Encoding UTF8))) {
        Add-ValidationError "Archivo vacio: $relativePath"
    }
}

$agentsFile = Join-Path $repoRoot 'AGENTS.md'
if (Test-Path -LiteralPath $agentsFile) {
    $agentsContent = Get-Content -Raw -LiteralPath $agentsFile -Encoding UTF8
    foreach ($skillName in $required.Keys) {
        if ($agentsContent -notmatch [regex]::Escape("``$skillName``")) {
            Add-ValidationError "AGENTS.md no menciona la skill '$skillName'."
        }
    }
}

$plansFile = Join-Path $repoRoot 'PLANS.md'
if ((Test-Path -LiteralPath $plansFile) -and
    ((Get-Content -Raw -LiteralPath $plansFile -Encoding UTF8) -notmatch '(?i)ExecPlan')) {
    Add-ValidationError 'PLANS.md no define ExecPlans.'
}

$gameDesignFile = Join-Path $repoRoot 'GAME_DESIGN.md'
$gameDesignSectionPatterns = @(
    'Visi.n del juego', 'Pilares', 'Bucle activo', 'Bucle idle', 'Objetivo general',
    'Progresi.n', 'Clases', 'Estad.sticas', 'Combate', 'Habilidades', 'Equipamiento',
    'Loot', 'Enemigos', 'Dungeons', 'Jefes', 'Multiplayer', 'Econom.a',
    'Persistencia', 'Direcci.n visual', 'Audio', 'Interfaz', 'Monetizaci.n',
    'Preguntas abiertas', 'Decisiones tomadas', 'Registro de cambios'
)
if (Test-Path -LiteralPath $gameDesignFile) {
    $gameDesignContent = Get-Content -Raw -LiteralPath $gameDesignFile -Encoding UTF8
    foreach ($sectionPattern in $gameDesignSectionPatterns) {
        if ($gameDesignContent -notmatch "(?m)^##\s+$sectionPattern\s*$") {
            Add-ValidationError "GAME_DESIGN.md no contiene la seccion '$sectionPattern'."
        }
    }
}

$markdownFiles = Get-ChildItem -LiteralPath $repoRoot -Recurse -Force -File -Filter '*.md' |
    Where-Object { $_.FullName -notmatch '[\\/]\.git[\\/]' }
foreach ($markdownFile in $markdownFiles) {
    $markdown = Get-Content -Raw -LiteralPath $markdownFile.FullName -Encoding UTF8
    $links = [regex]::Matches($markdown, '\[[^\]]+\]\((?<target>[^)]+)\)')
    foreach ($link in $links) {
        $target = $link.Groups['target'].Value.Trim()
        if ($target -match '^(?:https?:|mailto:|#)') {
            continue
        }
        $pathPart = ($target -split '#', 2)[0]
        if ([string]::IsNullOrWhiteSpace($pathPart)) {
            continue
        }
        $resolvedTarget = [System.IO.Path]::GetFullPath(
            (Join-Path $markdownFile.DirectoryName ($pathPart.Replace('/', '\')))
        )
        if (-not (Test-Path -LiteralPath $resolvedTarget)) {
            Add-ValidationError "Enlace roto en $(Get-RelativeDisplayPath $markdownFile.FullName): $target"
        }
    }
}

if ($errors.Count -gt 0) {
    Write-Host "VALIDACION FALLIDA ($($errors.Count) errores)" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host " - $_" }
    exit 1
}

Write-Host "VALIDACION CORRECTA"
Write-Host "Skills: $($required.Count)"
Write-Host "Nombres unicos: $($names.Count)"
Write-Host "Markdown inspeccionado: $($markdownFiles.Count)"
Write-Host 'Frontmatter, secciones, referencias y enlaces: OK'
