[CmdletBinding()]
param(
  [string]$InputPath = "",
  [string]$EnvPath = "",
  [string]$ApiUrl = "http://localhost:5000/api/daily-tasks/external-bulk-create"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

if (-not $InputPath) {
  $InputPath = Join-Path $scriptDir "daily-tasks.json"
}

if (-not $EnvPath) {
  $EnvPath = Join-Path (Split-Path $scriptDir -Parent) "backend\.env"
}

function Write-Section {
  param([string]$Message)
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Get-EnvValueFromFile {
  param(
    [string]$Path,
    [string]$Name
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Env file not found: $Path"
  }

  $escapedName = [regex]::Escape($Name)

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()

    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    if ($trimmed -match "^${escapedName}\s*=\s*(.*)$") {
      $rawValue = $matches[1].Trim()

      if (
        ($rawValue.StartsWith('"') -and $rawValue.EndsWith('"')) -or
        ($rawValue.StartsWith("'") -and $rawValue.EndsWith("'"))
      ) {
        return $rawValue.Substring(1, $rawValue.Length - 2)
      }

      return $rawValue
    }
  }

  return ""
}

function Resolve-TaskApiKey {
  param([string]$Path)

  if ($env:TASK_API_KEY) {
    return $env:TASK_API_KEY
  }

  $taskApiKey = Get-EnvValueFromFile -Path $Path -Name "TASK_API_KEY"
  if ($taskApiKey) {
    return $taskApiKey
  }

  $internalApiKey = Get-EnvValueFromFile -Path $Path -Name "INTERNAL_API_KEY"
  if ($internalApiKey) {
    return $internalApiKey
  }

  $ownerSummaryKey = Get-EnvValueFromFile -Path $Path -Name "CRM_OWNER_SUMMARY_API_KEY"
  if ($ownerSummaryKey) {
    return $ownerSummaryKey
  }

  throw "TASK_API_KEY not found in environment or env file: $Path"
}

Write-Section "Tiles CRM Daily Tasks Push"
Write-Host "Input file: $InputPath"
Write-Host "Env file:   $EnvPath"
Write-Host "API URL:    $ApiUrl"

if (-not (Test-Path -LiteralPath $InputPath)) {
  throw "Input JSON file not found: $InputPath"
}

$taskApiKey = Resolve-TaskApiKey -Path $EnvPath
$jsonText = Get-Content -LiteralPath $InputPath -Raw

if (-not $jsonText.Trim()) {
  throw "Input JSON file is empty: $InputPath"
}

try {
  $payloadObject = $jsonText | ConvertFrom-Json
} catch {
  throw "Invalid JSON in $InputPath. $($_.Exception.Message)"
}

if (-not $payloadObject.tasks -or $payloadObject.tasks.Count -le 0) {
  throw "JSON must contain at least one task under the 'tasks' array."
}

$headers = @{
  "Content-Type" = "application/json"
  "x-task-api-key" = $taskApiKey
}

Write-Section "Sending Request"

try {
  $response = Invoke-RestMethod -Method Post -Uri $ApiUrl -Headers $headers -Body $jsonText
} catch {
  $statusCode = ""
  $responseBody = ""

  if ($_.Exception.Response) {
    try {
      $statusCode = [int]$_.Exception.Response.StatusCode
    } catch {
      $statusCode = ""
    }

    try {
      $stream = $_.Exception.Response.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
      }
    } catch {
      $responseBody = ""
    }
  }

  Write-Host "FAILED" -ForegroundColor Red
  if ($statusCode -ne "") {
    Write-Host "HTTP Status: $statusCode" -ForegroundColor Yellow
  }
  if ($responseBody) {
    Write-Host "Response: $responseBody" -ForegroundColor Yellow
  } else {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
  }
  exit 1
}

Write-Section "Result"

if ($response.ok -ne $true) {
  Write-Host "FAILED: API returned unexpected response." -ForegroundColor Red
  $response | ConvertTo-Json -Depth 8
  exit 1
}

$createdTasks = @()

if ($response.tasks) {
  $createdTasks = @($response.tasks)
} elseif ($response.task) {
  $createdTasks = @($response.task)
}

Write-Host "SUCCESS: Created $($createdTasks.Count) task(s)." -ForegroundColor Green

if ($createdTasks.Count -gt 0) {
  foreach ($task in $createdTasks) {
    Write-Host ("- [{0}] {1}" -f $task.id, $task.title)
  }
}
