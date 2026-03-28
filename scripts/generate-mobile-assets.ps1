Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

function New-RoundedRectPath {
    param(
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $diameter = $Radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-IconBitmap {
    param([int]$Size)

    $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::FromArgb(249, 241, 231))

    $platePath = New-RoundedRectPath ([float]($Size * 0.11)) ([float]($Size * 0.21)) ([float]($Size * 0.78)) ([float]($Size * 0.52)) ([float]($Size * 0.08))
    $teal = [System.Drawing.Color]::FromArgb(22, 160, 133)
    $orange = [System.Drawing.Color]::FromArgb(211, 84, 0)
    $gold = [System.Drawing.Color]::FromArgb(241, 196, 15)
    $dark = [System.Drawing.Color]::FromArgb(44, 62, 80)

    $plateBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $accentBrush = New-Object System.Drawing.SolidBrush($gold)
    $stripeBrush = New-Object System.Drawing.SolidBrush($teal)
    $borderPen = New-Object System.Drawing.Pen($orange, [float][Math]::Max(8, $Size * 0.03))
    $darkPen = New-Object System.Drawing.Pen($dark, [float][Math]::Max(10, $Size * 0.038))
    $handlePen = New-Object System.Drawing.Pen($orange, [float][Math]::Max(12, $Size * 0.04))
    $darkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $darkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $handlePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $handlePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $graphics.FillPath($plateBrush, $platePath)
    $graphics.DrawPath($borderPen, $platePath)
    $graphics.FillRectangle($stripeBrush, [float]($Size * 0.17), [float]($Size * 0.28), [float]($Size * 0.66), [float]($Size * 0.08))
    $graphics.FillRectangle($accentBrush, [float]($Size * 0.17), [float]($Size * 0.59), [float]($Size * 0.66), [float]($Size * 0.05))

    $font = New-Object System.Drawing.Font('Segoe UI', [float]($Size * 0.2), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $stringFormat = New-Object System.Drawing.StringFormat
    $stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
    $textBrush = New-Object System.Drawing.SolidBrush($dark)
    $textRect = New-Object System.Drawing.RectangleF ([float]($Size * 0.18)), ([float]($Size * 0.35)), ([float]($Size * 0.46)), ([float]($Size * 0.2))
    $graphics.DrawString('TS', $font, $textBrush, $textRect, $stringFormat)

    $lensRect = New-Object System.Drawing.RectangleF ([float]($Size * 0.48)), ([float]($Size * 0.36)), ([float]($Size * 0.26)), ([float]($Size * 0.26))
    $lensBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 22, 160, 133))
    $graphics.DrawEllipse($darkPen, $lensRect)
    $graphics.FillEllipse($lensBrush, $lensRect)
    $graphics.DrawLine($handlePen, [float]($Size * 0.67), [float]($Size * 0.56), [float]($Size * 0.81), [float]($Size * 0.70))

    $starPoints = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF ([float]($Size * 0.70)), ([float]($Size * 0.20))),
        (New-Object System.Drawing.PointF ([float]($Size * 0.73)), ([float]($Size * 0.28))),
        (New-Object System.Drawing.PointF ([float]($Size * 0.82)), ([float]($Size * 0.29))),
        (New-Object System.Drawing.PointF ([float]($Size * 0.75)), ([float]($Size * 0.35))),
        (New-Object System.Drawing.PointF ([float]($Size * 0.78)), ([float]($Size * 0.43))),
        (New-Object System.Drawing.PointF ([float]($Size * 0.70)), ([float]($Size * 0.38))),
        (New-Object System.Drawing.PointF ([float]($Size * 0.62)), ([float]($Size * 0.43))),
        (New-Object System.Drawing.PointF ([float]($Size * 0.65)), ([float]($Size * 0.35))),
        (New-Object System.Drawing.PointF ([float]($Size * 0.58)), ([float]($Size * 0.29))),
        (New-Object System.Drawing.PointF ([float]($Size * 0.67)), ([float]($Size * 0.28)))
    )
    $graphics.FillPolygon($accentBrush, $starPoints)

    $graphics.Dispose()
    return $bitmap
}

function New-SplashBitmap {
    param([int]$Size)

    $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::FromArgb(249, 241, 231))

    $teal = [System.Drawing.Color]::FromArgb(22, 160, 133)
    $orange = [System.Drawing.Color]::FromArgb(211, 84, 0)
    $gold = [System.Drawing.Color]::FromArgb(241, 196, 15)
    $dark = [System.Drawing.Color]::FromArgb(44, 62, 80)

    $graphics.FillRectangle((New-Object System.Drawing.SolidBrush($dark)), 0, [float]($Size * 0.18), $Size, [float]($Size * 0.12))
    $graphics.FillRectangle((New-Object System.Drawing.SolidBrush($gold)), 0, [float]($Size * 0.30), $Size, [float]($Size * 0.02))

    $icon = New-IconBitmap([Math]::Floor($Size * 0.34))
    $iconX = [Math]::Floor(($Size - $icon.Width) / 2)
    $iconY = [Math]::Floor($Size * 0.36)
    $graphics.DrawImage($icon, $iconX, $iconY, $icon.Width, $icon.Height)

    $titleFont = New-Object System.Drawing.Font('Georgia', [float]($Size * 0.07), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $subtitleFont = New-Object System.Drawing.Font('Segoe UI', [float]($Size * 0.028), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $center = New-Object System.Drawing.StringFormat
    $center.Alignment = [System.Drawing.StringAlignment]::Center
    $titleBrush = New-Object System.Drawing.SolidBrush($orange)
    $subtitleBrush = New-Object System.Drawing.SolidBrush($teal)
    $graphics.DrawString('Tag Spotter', $titleFont, $titleBrush, (New-Object System.Drawing.PointF ([float]($Size / 2)), ([float]($Size * 0.78))), $center)
    $graphics.DrawString('Spot plates. Earn distance. Learn states.', $subtitleFont, $subtitleBrush, (New-Object System.Drawing.PointF ([float]($Size / 2)), ([float]($Size * 0.86))), $center)

    $graphics.Dispose()
    $icon.Dispose()
    return $bitmap
}

function Save-Png {
    param(
        [System.Drawing.Bitmap]$Bitmap,
        [string]$Path
    )

    $directory = Split-Path -Parent $Path
    if (-not (Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory | Out-Null
    }

    $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

$root = Resolve-Path (Join-Path $PSScriptRoot '..')

$iconTargets = @{
    'android/app/src/main/res/mipmap-mdpi/ic_launcher.png' = 48
    'android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png' = 48
    'android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png' = 108
    'android/app/src/main/res/mipmap-hdpi/ic_launcher.png' = 72
    'android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png' = 72
    'android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png' = 162
    'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png' = 96
    'android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png' = 96
    'android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png' = 216
    'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png' = 144
    'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png' = 144
    'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png' = 324
    'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png' = 192
    'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png' = 192
    'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png' = 432
    'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png' = 1024
}

foreach ($entry in $iconTargets.GetEnumerator()) {
    $bitmap = New-IconBitmap -Size $entry.Value
    Save-Png -Bitmap $bitmap -Path (Join-Path $root $entry.Key)
    $bitmap.Dispose()
}

$splash = New-SplashBitmap -Size 2732
$splashTargets = @(
    'android/app/src/main/res/drawable/splash.png',
    'android/app/src/main/res/drawable-land-mdpi/splash.png',
    'android/app/src/main/res/drawable-port-mdpi/splash.png',
    'android/app/src/main/res/drawable-land-hdpi/splash.png',
    'android/app/src/main/res/drawable-port-hdpi/splash.png',
    'android/app/src/main/res/drawable-land-xhdpi/splash.png',
    'android/app/src/main/res/drawable-port-xhdpi/splash.png',
    'android/app/src/main/res/drawable-land-xxhdpi/splash.png',
    'android/app/src/main/res/drawable-port-xxhdpi/splash.png',
    'android/app/src/main/res/drawable-land-xxxhdpi/splash.png',
    'android/app/src/main/res/drawable-port-xxxhdpi/splash.png',
    'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png',
    'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png',
    'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png'
)

foreach ($target in $splashTargets) {
    Save-Png -Bitmap $splash -Path (Join-Path $root $target)
}
$splash.Dispose()
