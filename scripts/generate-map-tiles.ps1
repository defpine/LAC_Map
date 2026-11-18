param(
  [Parameter(Mandatory = $true)][string]$SourcePath,
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [int]$TileSize = 512
)

Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Bitmap]::FromFile((Resolve-Path $SourcePath).Path)
try {
  $maxLevel = 0
  $largestSide = [Math]::Max($source.Width, $source.Height)
  while (($TileSize * [Math]::Pow(2, $maxLevel)) -lt $largestSide) { $maxLevel++ }

  for ($level = 0; $level -le $maxLevel; $level++) {
    $scale = [Math]::Pow(2, $level)
    $scaledWidth = [int][Math]::Ceiling($source.Width / $scale)
    $scaledHeight = [int][Math]::Ceiling($source.Height / $scale)
    $columns = [int][Math]::Ceiling($scaledWidth / $TileSize)
    $rows = [int][Math]::Ceiling($scaledHeight / $TileSize)
    $levelDirectory = Join-Path $OutputDirectory "level_$level"
    New-Item -ItemType Directory -Force -Path $levelDirectory | Out-Null

    for ($y = 0; $y -lt $rows; $y++) {
      for ($x = 0; $x -lt $columns; $x++) {
        $tile = New-Object System.Drawing.Bitmap $TileSize, $TileSize, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($tile)
        try {
          $graphics.Clear([System.Drawing.Color]::Transparent)
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          # CRS.Simple places the image's top edge at a negative Y coordinate.
          # Build tiles in that grid so partial top tiles retain the needed padding.
          $gridY = $y - $rows
          $displayX = $x * $TileSize
          $displayY = ($gridY * $TileSize) + $scaledHeight
          $validLeft = [Math]::Max(0, $displayX)
          $validTop = [Math]::Max(0, $displayY)
          $validRight = [Math]::Min($scaledWidth, $displayX + $TileSize)
          $validBottom = [Math]::Min($scaledHeight, $displayY + $TileSize)

          if ($validRight -gt $validLeft -and $validBottom -gt $validTop) {
            $destination = New-Object System.Drawing.Rectangle ($validLeft - $displayX), ($validTop - $displayY), ($validRight - $validLeft), ($validBottom - $validTop)
            $sourceRect = New-Object System.Drawing.Rectangle ([int][Math]::Floor($validLeft * $scale)), ([int][Math]::Floor($validTop * $scale)), ([int][Math]::Ceiling(($validRight - $validLeft) * $scale)), ([int][Math]::Ceiling(($validBottom - $validTop) * $scale))
            $graphics.DrawImage($source, $destination, $sourceRect.X, $sourceRect.Y, $sourceRect.Width, $sourceRect.Height, [System.Drawing.GraphicsUnit]::Pixel)
          }

          $outputPath = Join-Path $levelDirectory "${x}_${y}.png"
          if (Test-Path -LiteralPath $outputPath) { [System.IO.File]::Delete($outputPath) }
          $tile.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
          $graphics.Dispose()
          $tile.Dispose()
        }
      }
    }
  }
} finally {
  $source.Dispose()
}
