param(
  [string]$DbPath,
  [string]$OutWeights
)

if (-not $DbPath -or -not $OutWeights) {
  Write-Host "Usage: .\\train_chunk_scorer.ps1 -DbPath <chunk_training.sqlite> -OutWeights <weights.json>" -ForegroundColor Yellow
  exit 2
}

python "$PSScriptRoot\chunk_scorer.py" "$DbPath" "$OutWeights"
