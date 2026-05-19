$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$dayPath = Join-Path $root 'public\themes\cargo\backgrounds\day.png'
$outPath = Join-Path $root 'public\themes\cargo\backgrounds\scroll.png'
$tmpPath = Join-Path $root 'public\themes\cargo\backgrounds\scroll.tmp.png'

$width = 1080
$height = 7680
$dayY = 5760

function Mix-Color($from, $to, [double] $amount) {
  [System.Drawing.Color]::FromArgb(
    255,
    [int]($from.R + (($to.R - $from.R) * $amount)),
    [int]($from.G + (($to.G - $from.G) * $amount)),
    [int]($from.B + (($to.B - $from.B) * $amount))
  )
}

function Draw-StarField($graphics) {
  $rng = [System.Random]::new(4277)
  for ($i = 0; $i -lt 340; $i += 1) {
    $alpha = [int](42 + ($rng.NextDouble() * 116))
    $size = 0.55 + ($rng.NextDouble() * 1.4)
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($alpha, 238, 247, 255))
    $graphics.FillEllipse(
      $brush,
      [single]($rng.NextDouble() * $width),
      [single]($rng.NextDouble() * 2450),
      [single]$size,
      [single]$size
    )
    $brush.Dispose()
  }
}

function Draw-Wisps($graphics, [double] $centerX, [double] $centerY, [double] $scale, [int] $alpha, [int] $seed) {
  $rng = [System.Random]::new($seed)
  for ($i = 0; $i -lt 8; $i += 1) {
    $lineY = $centerY + (($rng.NextDouble() - 0.5) * 130 * $scale)
    $pen = [System.Drawing.Pen]::new(
      [System.Drawing.Color]::FromArgb([int]($alpha * (0.28 + ($rng.NextDouble() * 0.34))), 245, 250, 255),
      [single]((0.55 + ($rng.NextDouble() * 0.8)) * $scale)
    )
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawBezier(
      $pen,
      [single]($centerX - (460 * $scale)),
      [single]$lineY,
      [single]($centerX - (150 * $scale)),
      [single]($lineY - (34 * $scale)),
      [single]($centerX + (150 * $scale)),
      [single]($lineY + (26 * $scale)),
      [single]($centerX + (460 * $scale)),
      [single]($lineY - (5 * $scale))
    )
    $pen.Dispose()
  }
}

function Draw-SkyPatch($graphics, $image, [int] $sourceY, [int] $destY, [int] $patchHeight, [double] $scale, [int] $alpha, [int] $offsetX) {
  $matrix = [System.Drawing.Imaging.ColorMatrix]::new()
  $matrix.Matrix00 = 1.08
  $matrix.Matrix11 = 1.08
  $matrix.Matrix22 = 1.08
  $matrix.Matrix33 = $alpha / 255.0
  $attrs = [System.Drawing.Imaging.ImageAttributes]::new()
  $attrs.SetColorMatrix($matrix, [System.Drawing.Imaging.ColorMatrixFlag]::Default, [System.Drawing.Imaging.ColorAdjustType]::Bitmap)

  $destWidth = [int]($width * $scale)
  $destHeight = [int]($patchHeight * $scale)
  $dest = [System.Drawing.Rectangle]::new($offsetX, $destY, $destWidth, $destHeight)
  $graphics.DrawImage($image, $dest, 0, $sourceY, $image.Width, $patchHeight, [System.Drawing.GraphicsUnit]::Pixel, $attrs)
  $attrs.Dispose()
}

function Draw-CloudTexture($graphics, $image, [int] $sourceY, [int] $sourceHeight, [int] $destY, [double] $scale, [int] $maxAlpha, [int] $offsetX) {
  $overlay = [System.Drawing.Bitmap]::new($image.Width, $sourceHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $sourceHeight; $y += 1) {
    for ($x = 0; $x -lt $image.Width; $x += 1) {
      $pixel = $image.GetPixel($x, $sourceY + $y)
      $whiteLevel = [Math]::Min($pixel.R, [Math]::Min($pixel.G, $pixel.B))
      $cloudStrength = [Math]::Max(0, [Math]::Min(1, ($whiteLevel - 145) / 110.0))
      if ($cloudStrength -gt 0) {
        $alpha = [int]($maxAlpha * [Math]::Pow($cloudStrength, 1.35))
        $overlay.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $pixel.R, $pixel.G, $pixel.B))
      }
    }
  }

  $dest = [System.Drawing.Rectangle]::new($offsetX, $destY, [int]($image.Width * $scale), [int]($sourceHeight * $scale))
  $graphics.DrawImage($overlay, $dest)
  $overlay.Dispose()
}

function Draw-CloudBank($graphics, [double] $centerX, [double] $centerY, [double] $scale, [int] $seed, [int] $alpha) {
  $rng = [System.Random]::new($seed)
  for ($i = 0; $i -lt 28; $i += 1) {
    $x = $centerX + (($rng.NextDouble() - 0.5) * 520 * $scale)
    $y = $centerY + (($rng.NextDouble() - 0.5) * 130 * $scale)
    $w = (96 + ($rng.NextDouble() * 170)) * $scale
    $h = (28 + ($rng.NextDouble() * 62)) * $scale
    $shade = [int](230 + ($rng.NextDouble() * 25))
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb([int]($alpha * (0.22 + ($rng.NextDouble() * 0.36))), $shade, $shade, 255))
    $graphics.FillEllipse($brush, [single]($x - ($w / 2)), [single]($y - ($h / 2)), [single]$w, [single]$h)
    $brush.Dispose()
  }

  $shadow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb([int]($alpha * 0.12), 120, 158, 198))
  $graphics.FillEllipse($shadow, [single]($centerX - (315 * $scale)), [single]($centerY + (28 * $scale)), [single](630 * $scale), [single](72 * $scale))
  $shadow.Dispose()
}

function Draw-Moon($graphics) {
  $moonRect = [System.Drawing.RectangleF]::new(810, 2050, 112, 112)
  $moonPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $moonPath.AddEllipse($moonRect)
  $moonBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new($moonPath)
  $moonBrush.CenterColor = [System.Drawing.Color]::FromArgb(154, 232, 238, 227)
  $moonBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(48, 232, 238, 227))
  $graphics.FillEllipse($moonBrush, $moonRect)
  $moonBrush.Dispose()
  $moonPath.Dispose()
}

function Draw-Rocket($graphics) {
  $cx = 210
  $cy = 2860
  $scale = 0.8
  $bodyBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(176, 236, 241, 244))
  $finBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(138, 187, 63, 57))
  $flameBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(102, 255, 176, 67))

  $graphics.FillPolygon($bodyBrush, @(
      [System.Drawing.PointF]::new($cx, $cy - (42 * $scale)),
      [System.Drawing.PointF]::new($cx + (16 * $scale), $cy - (10 * $scale)),
      [System.Drawing.PointF]::new($cx + (10 * $scale), $cy + (38 * $scale)),
      [System.Drawing.PointF]::new($cx - (10 * $scale), $cy + (38 * $scale)),
      [System.Drawing.PointF]::new($cx - (16 * $scale), $cy - (10 * $scale))
    ))
  $graphics.FillPolygon($finBrush, @(
      [System.Drawing.PointF]::new($cx - (10 * $scale), $cy + (20 * $scale)),
      [System.Drawing.PointF]::new($cx - (34 * $scale), $cy + (52 * $scale)),
      [System.Drawing.PointF]::new($cx - (8 * $scale), $cy + (38 * $scale))
    ))
  $graphics.FillPolygon($finBrush, @(
      [System.Drawing.PointF]::new($cx + (10 * $scale), $cy + (20 * $scale)),
      [System.Drawing.PointF]::new($cx + (34 * $scale), $cy + (52 * $scale)),
      [System.Drawing.PointF]::new($cx + (8 * $scale), $cy + (38 * $scale))
    ))
  $graphics.FillPolygon($flameBrush, @(
      [System.Drawing.PointF]::new($cx - (7 * $scale), $cy + (40 * $scale)),
      [System.Drawing.PointF]::new($cx, $cy + (82 * $scale)),
      [System.Drawing.PointF]::new($cx + (7 * $scale), $cy + (40 * $scale))
    ))

  $bodyBrush.Dispose()
  $finBrush.Dispose()
  $flameBrush.Dispose()
}

function Draw-Satellite($graphics, [double] $cx, [double] $cy, [double] $scale, [int] $rotation) {
  $graphics.TranslateTransform([single]$cx, [single]$cy)
  $graphics.RotateTransform($rotation)
  $panelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(128, 71, 119, 174))
  $panelEdge = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(112, 193, 220, 244), [single](1.2 * $scale))
  $bodyBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(160, 224, 230, 234))
  $darkPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(98, 32, 50, 74), [single](1 * $scale))

  foreach ($side in @(-1, 1)) {
    $rect = [System.Drawing.RectangleF]::new([single]($side * 24 * $scale), [single](-9 * $scale), [single]($side * 48 * $scale), [single](18 * $scale))
    if ($side -lt 0) {
      $rect = [System.Drawing.RectangleF]::new([single](-72 * $scale), [single](-9 * $scale), [single](48 * $scale), [single](18 * $scale))
    }
    $graphics.FillRectangle($panelBrush, $rect)
    $graphics.DrawRectangle($panelEdge, $rect.X, $rect.Y, $rect.Width, $rect.Height)
    for ($i = 1; $i -lt 3; $i += 1) {
      $x = $rect.X + (($rect.Width / 3) * $i)
      $graphics.DrawLine($darkPen, [single]$x, $rect.Y, [single]$x, [single]($rect.Y + $rect.Height))
    }
  }

  $graphics.FillEllipse($bodyBrush, [single](-15 * $scale), [single](-12 * $scale), [single](30 * $scale), [single](24 * $scale))
  $graphics.DrawEllipse($darkPen, [single](-15 * $scale), [single](-12 * $scale), [single](30 * $scale), [single](24 * $scale))
  $graphics.DrawLine($panelEdge, [single](0), [single](12 * $scale), [single](0), [single](40 * $scale))
  $graphics.DrawArc($panelEdge, [single](-18 * $scale), [single](34 * $scale), [single](36 * $scale), [single](18 * $scale), 205, 130)

  $panelBrush.Dispose()
  $panelEdge.Dispose()
  $bodyBrush.Dispose()
  $darkPen.Dispose()
  $graphics.ResetTransform()
}

function Draw-Airplane($graphics) {
  $trail = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(74, 245, 250, 255), 2.2)
  $graphics.DrawBezier($trail, 0, 3990, 72, 3962, 118, 3958, 156, 3956)
  $trail.Dispose()

  $body = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(186, 236, 244, 250))
  $wing = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(136, 75, 104, 132))
  $graphics.FillPolygon($wing, @(
      [System.Drawing.PointF]::new(204, 3952),
      [System.Drawing.PointF]::new(158, 3988),
      [System.Drawing.PointF]::new(229, 3959)
    ))
  $graphics.FillPolygon($wing, @(
      [System.Drawing.PointF]::new(178, 3952),
      [System.Drawing.PointF]::new(154, 3932),
      [System.Drawing.PointF]::new(196, 3949)
    ))
  $graphics.FillPolygon($body, @(
      [System.Drawing.PointF]::new(130, 3953),
      [System.Drawing.PointF]::new(232, 3946),
      [System.Drawing.PointF]::new(258, 3952),
      [System.Drawing.PointF]::new(232, 3960),
      [System.Drawing.PointF]::new(130, 3960)
    ))
  $body.Dispose()
  $wing.Dispose()
}

function Draw-Birds($graphics) {
  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(92, 22, 45, 69), 1.2)
  foreach ($point in @(@(120, 4620), @(176, 4686), @(905, 4820), @(960, 4760), @(150, 5150), @(845, 5220), @(700, 5320), @(760, 5288), @(820, 5350), @(220, 5550), @(310, 5518))) {
    $x = $point[0]
    $y = $point[1]
    $graphics.DrawBezier($pen, $x - 10, $y, $x - 5, $y - 6, $x - 2, $y - 6, $x, $y)
    $graphics.DrawBezier($pen, $x, $y, $x + 2, $y - 6, $x + 5, $y - 6, $x + 10, $y)
  }
  $pen.Dispose()
}

$day = [System.Drawing.Bitmap]::FromFile($dayPath)
$sumR = 0L
$sumG = 0L
$sumB = 0L
$count = 0L
foreach ($sampleY in @(0, 1, 2, 4, 8, 16, 32)) {
  for ($x = 0; $x -lt $day.Width; $x += 8) {
    $pixel = $day.GetPixel($x, $sampleY)
    $sumR += $pixel.R
    $sumG += $pixel.G
    $sumB += $pixel.B
    $count += 1
  }
}
$daySky = [System.Drawing.Color]::FromArgb(255, [int]($sumR / $count), [int]($sumG / $count), [int]($sumB / $count))

$bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$space = [System.Drawing.Color]::FromArgb(255, 4, 8, 23)
$nearSpace = [System.Drawing.Color]::FromArgb(255, 9, 24, 53)
$strato = [System.Drawing.Color]::FromArgb(255, 34, 82, 136)

for ($y = 0; $y -lt $height; $y += 1) {
  if ($y -lt 1700) {
    $color = Mix-Color $space $nearSpace ($y / 1700.0)
  } elseif ($y -lt 3600) {
    $color = Mix-Color $nearSpace $strato ([Math]::Pow((($y - 1700) / 1900.0), 1.04))
  } elseif ($y -lt $dayY) {
    $color = Mix-Color $strato $daySky ([Math]::Pow((($y - 3600) / ($dayY - 3600.0)), 0.78))
  } else {
    $color = $daySky
  }
  $pen = [System.Drawing.Pen]::new($color)
  $graphics.DrawLine($pen, 0, $y, $width, $y)
  $pen.Dispose()
}

Draw-StarField $graphics
Draw-Moon $graphics
Draw-Satellite $graphics 865 2360 0.72 -18
Draw-Satellite $graphics 170 3160 0.58 21
Draw-Rocket $graphics
Draw-CloudTexture $graphics $day 0 320 4040 1.16 62 -86
Draw-CloudTexture $graphics $day 0 320 4560 0.98 78 22
Draw-CloudTexture $graphics $day 0 320 5120 1.04 112 -14
Draw-Wisps $graphics 250 3820 1.05 28 31
Draw-Wisps $graphics 830 4280 0.82 22 42
Draw-Wisps $graphics 360 5040 1.1 20 53
Draw-Airplane $graphics
Draw-Birds $graphics

$matchRect = [System.Drawing.Rectangle]::new(0, $dayY - 360, $width, 360)
$matchBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  $matchRect,
  [System.Drawing.Color]::FromArgb(0, $daySky.R, $daySky.G, $daySky.B),
  [System.Drawing.Color]::FromArgb(210, $daySky.R, $daySky.G, $daySky.B),
  [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$graphics.FillRectangle($matchBrush, $matchRect)
$matchBrush.Dispose()

for ($i = 0; $i -lt 80; $i += 2) {
  $progress = $i / 80.0
  $sourceY = [Math]::Max(0, 79 - $i)
  $destY = $dayY - 80 + $i
  $alpha = [int](20 + (180 * [Math]::Pow($progress, 1.7)))
  $matrix = [System.Drawing.Imaging.ColorMatrix]::new()
  $matrix.Matrix33 = $alpha / 255.0
  $attrs = [System.Drawing.Imaging.ImageAttributes]::new()
  $attrs.SetColorMatrix($matrix, [System.Drawing.Imaging.ColorMatrixFlag]::Default, [System.Drawing.Imaging.ColorAdjustType]::Bitmap)
  $dest = [System.Drawing.Rectangle]::new(0, $destY, $width, 2)
  $graphics.DrawImage($day, $dest, 0, $sourceY, $day.Width, 2, [System.Drawing.GraphicsUnit]::Pixel, $attrs)
  $attrs.Dispose()
}

$graphics.DrawImage($day, [System.Drawing.Rectangle]::new(0, $dayY, $width, 1920))

$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/png' }
$params = [System.Drawing.Imaging.EncoderParameters]::new(1)
$params.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::ColorDepth, 32L)
$bitmap.Save($tmpPath, $encoder, $params)

$graphics.Dispose()
$bitmap.Dispose()
$day.Dispose()

Move-Item -Force -LiteralPath $tmpPath -Destination $outPath
Write-Host "Wrote $outPath"
