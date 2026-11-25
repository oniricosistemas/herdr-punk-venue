# Windows/.NET XML validation; no modules, dependencies or network. Regeneration uses system temp only.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File punk-venue/mods/punk-venue/tools/validate.ps1
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$art = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../art'))
& node --test (Join-Path $PSScriptRoot 'banner-layout.test.mjs')
if ($LASTEXITCODE -ne 0) { throw "Banner layout tests exited $LASTEXITCODE" }
$kinds = @('guitar', 'bass', 'drums', 'singer', 'guitar2', 'keys', 'sax')
$states = @('working', 'idle', 'blocked', 'done')
$originalScenes = @('backdrop.svg', 'crowd.svg', 'entrance.svg')
$variants = @('backdrop-club.svg', 'backdrop-galpon.svg', 'backdrop-plaza.svg', 'backdrop-salon.svg')
$scenes = @($originalScenes) + $variants
$expected = @($scenes)
$squareHashes = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'square-sha256.json') -Raw | ConvertFrom-Json
$sceneHashes = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'scene-sha256.json') -Raw | ConvertFrom-Json
if (@(Compare-Object ($originalScenes | Sort-Object) ($sceneHashes.PSObject.Properties.Name | Sort-Object)).Count -ne 0) {
    throw 'Original-scene preservation manifest must contain exactly the 3 original scenes'
}
foreach ($kind in $kinds) {
    foreach ($state in $states) { $expected += "$kind-$state.svg" }
}
foreach ($gear in @('guitar', 'bass', 'drums', 'mic', 'keys', 'sax')) { $expected += "empty-$gear.svg" }
$palette = @('#151412', '#eee3c5', '#b93b36', '#c4a34f', '#385947', '#627b88')
$elements = @('svg', 'title', 'rect', 'path', 'circle', 'g', 'defs', 'use')
$attributes = @('xmlns', 'viewBox', 'shape-rendering', 'x', 'y', 'width', 'height',
    'fill', 'd', 'stroke', 'stroke-width', 'stroke-linejoin', 'stroke-linecap',
    'cx', 'cy', 'r', 'transform', 'id', 'href', 'role', 'aria-label', 'data-lines', 'data-condensed')
$bannerNames = @{
    'backdrop-club.svg' = @('Los Violadores', 'Flema', 'Argies')
    'backdrop-galpon.svg' = @('Todos Tus Muertos', 'Attaque 77', '2 Minutos')
    'backdrop-plaza.svg' = @('Boom Boom Kid', 'Fun People', 'Loquero')
    'backdrop-salon.svg' = @('Embajada Boliviana', 'Sin Ley', 'Bulldog')
    'entrance.svg' = @('ENTRADA', 'Alerta Roja')
}
$twoLineNames = @('Los Violadores', 'Todos Tus Muertos', 'Boom Boom Kid', 'Embajada Boliviana')
$condensedNames = @('Todos Tus Muertos', 'Boom Boom Kid', 'Embajada Boliviana')
$allBandNames = @($bannerNames.Values | ForEach-Object { $_ } | Where-Object { $_ -ne 'ENTRADA' } | Select-Object -Unique)
if ($allBandNames.Count -lt 12) { throw 'At least 12 distinct real band names required' }
$generatedNames = $expected
$additions = @($kinds | ForEach-Object { "$_-strike.svg" }) + @(
    'crowd-front-punk.svg', 'crowd-front-neighbor.svg', 'monitor-riser.svg')
$expected = $generatedNames + $additions
$squareNames = @($generatedNames | Where-Object { $_ -notin $scenes })
if (@(Compare-Object ($squareNames | Sort-Object) ($squareHashes.PSObject.Properties.Name | Sort-Object)).Count -ne 0) {
    throw 'Square-asset preservation manifest does not match the 34 expected names'
}
function Assert-Art($directory, $inventory) {
    $files = @(Get-ChildItem -LiteralPath $directory -File)
    $diff = @(Compare-Object ($inventory | Sort-Object) ($files.Name | Sort-Object))
    if ($diff.Count -ne 0) { throw "Wrong asset file set: $($diff | Out-String)" }
    $hashes = @{}
    foreach ($file in $files) {
        if ($file.Length -gt 8192) { throw "$($file.Name): exceeds 8 KiB ($($file.Length) bytes)" }
        $settings = New-Object System.Xml.XmlReaderSettings
        $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
        $settings.XmlResolver = $null
        $reader = [System.Xml.XmlReader]::Create($file.FullName, $settings)
        try {
            $doc = New-Object System.Xml.XmlDocument
            $doc.XmlResolver = $null
            $doc.Load($reader)
        } finally { $reader.Dispose() }
        $width = if ($file.Name -eq 'crowd.svg') { '512' }
            elseif ($file.Name -in $scenes) { '256' } else { '64' }
        if ($doc.DocumentElement.LocalName -ne 'svg' -or
            $doc.DocumentElement.NamespaceURI -ne 'http://www.w3.org/2000/svg' -or
            $doc.DocumentElement.GetAttribute('viewBox') -cne "0 0 $width 64" -or
            $doc.DocumentElement.GetAttribute('width') -cne $width -or
            $doc.DocumentElement.GetAttribute('height') -cne '64') {
            throw "$($file.Name): wrong SVG root, namespace, dimensions or viewBox"
        }
        if ($file.Name -in $variants) {
            # Last-painted solid masks guarantee no later prop/lettering can
            # intrude into the lower-center band or bottom-eighth crowd zone.
            $masks = @($doc.DocumentElement.LastChild.PreviousSibling, $doc.DocumentElement.LastChild)
            $areas = @(@('56', '22', '144', '34'), @('0', '56', '256', '8'))
            for ($i = 0; $i -lt 2; $i++) {
                $mask = $masks[$i]
                if ($mask.LocalName -ne 'rect' -or $mask.GetAttribute('fill') -cne '#151412' -or
                    $mask.GetAttribute('x') -cne $areas[$i][0] -or
                    $mask.GetAttribute('y') -cne $areas[$i][1] -or
                    $mask.GetAttribute('width') -cne $areas[$i][2] -or
                    $mask.GetAttribute('height') -cne $areas[$i][3] -or $mask.HasAttribute('stroke')) {
                    throw "$($file.Name): missing final dark musician/crowd clearance masks"
                }
            }
        }
        if ($bannerNames.ContainsKey($file.Name)) {
            $labels = @($doc.SelectNodes('//*[@role="img"]'))
            $actualNames = @($labels | ForEach-Object { $_.GetAttribute('aria-label') })
            if ($actualNames.Count -ne $bannerNames[$file.Name].Count -or
                @(Compare-Object ($bannerNames[$file.Name] | Sort-Object) ($actualNames | Sort-Object) -CaseSensitive).Count -ne 0 -or
                @($actualNames | Select-Object -Unique).Count -ne $actualNames.Count) {
                throw "$($file.Name): incorrect accessible names, casing, or repeated scene name"
            }
            foreach ($label in $labels) {
                $name = $label.GetAttribute('aria-label')
                $expectedLines = if ($name -in $twoLineNames) { 2 } else { 1 }
                $expectedCondensed = if ($name -in $condensedNames) { 'true' } else { 'false' }
                $lines = @($label.SelectNodes('./*[local-name()="g"]'))
                if ($label.GetAttribute('data-lines') -cne "$expectedLines" -or
                    $label.GetAttribute('data-condensed') -cne $expectedCondensed -or $lines.Count -ne $expectedLines) {
                    throw "$($file.Name): wrong line layout for $name"
                }
                $rendered = @()
                foreach ($line in $lines) {
                    $letters = @{}
                    $last = -1
                    foreach ($cut in $line.ChildNodes) {
                        if ($cut.LocalName -ne 'use' -or $cut.GetAttribute('href') -notmatch '^#b([A-Z0-9]|dash)$') {
                            throw "$($file.Name): banner must use internal stencil glyphs"
                        }
                        $offset = [int]($cut.GetAttribute('x'))
                        $index = [int]($offset / 4)
                        if ($offset % 4 -ne 0 -or $letters.ContainsKey($index)) { throw 'Invalid letter spacing' }
                        $letters[$index] = $cut.GetAttribute('href').Substring(2).Replace('dash', '-')
                        if ($index -gt $last) { $last = $index }
                    }
                    $text = ''
                    for ($i = 0; $i -le $last; $i++) {
                        $text += if ($letters.ContainsKey($i)) { $letters[$i] } else { ' ' }
                    }
                    $rendered += $text
                }
                if (($rendered -join ' ') -cne $name.ToUpperInvariant()) {
                    throw "$($file.Name): visible lettering does not match $name in capitals"
                }
            }
        }
        $ids = @{}
        foreach ($identified in $doc.SelectNodes('//*[@id]')) {
            $id = $identified.GetAttribute('id')
            if ($ids.ContainsKey($id)) { throw "$($file.Name): duplicate id $id" }
            $ids[$id] = $true
        }
        foreach ($element in $doc.SelectNodes('//*')) {
            if ($element.LocalName -notin $elements) { throw "$($file.Name): forbidden element $($element.Name)" }
            foreach ($attribute in $element.Attributes) {
                if ($attribute.Name -notin $attributes) { throw "$($file.Name): forbidden attribute $($attribute.Name)" }
                if ($attribute.Name -in @('fill', 'stroke') -and
                    $attribute.Value -ne 'none' -and $attribute.Value -notin $palette) {
                    throw "$($file.Name): out-of-palette color $($attribute.Value)"
                }
                if ($attribute.Name -eq 'href' -and
                    ($attribute.Value -notmatch '^#[A-Za-z][A-Za-z0-9-]*$' -or
                    -not $ids.ContainsKey($attribute.Value.Substring(1)))) {
                    throw "$($file.Name): reference must resolve to a local shape group"
                }
                if ($attribute.Name -ne 'xmlns' -and $attribute.Value -match 'url\(|https?:|data:') {
                    throw "$($file.Name): external or embedded resource"
                }
            }
        }
        $hashes[$file.Name] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        if ($file.Name -in $squareNames -and $hashes[$file.Name] -ine $squareHashes.($file.Name)) {
            throw "$($file.Name): square asset changed from its pre-revision SHA-256"
        }
        if ($file.Name -in $originalScenes -and $hashes[$file.Name] -ine $sceneHashes.($file.Name)) {
            throw "$($file.Name): original scene changed from its pre-variant SHA-256"
        }
    }
    foreach ($kind in $kinds) {
        $unique = @($states | ForEach-Object { $hashes["$kind-$_.svg"] } | Select-Object -Unique)
        if ($unique.Count -ne 4) { throw "$kind has duplicate states" }
    }
    return $hashes
}
# Check shipped files before generation, so stale/corrupt delivery is not masked.
$shipped = Assert-Art $art $expected
# The original generator owns 41 assets. Run it away from the shipped art;
# the ten live-stage additions are validated above, not produced by this tool.
$scratch = Join-Path ([IO.Path]::GetTempPath()) ('punk-venue-validate-' + [guid]::NewGuid().ToString('N'))
$tools = Join-Path $scratch 'tools'
$generatedArt = Join-Path $scratch 'art'
$null = New-Item -ItemType Directory -Path $scratch
try {
    $null = New-Item -ItemType Directory -Path $tools
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'generate.mjs'), (Join-Path $PSScriptRoot 'banner-layout.mjs') -Destination $tools
    $generator = Join-Path $tools 'generate.mjs'
    & node $generator
    if ($LASTEXITCODE -ne 0) { throw "First generator run exited $LASTEXITCODE" }
    $first = Assert-Art $generatedArt $generatedNames
    & node $generator
    if ($LASTEXITCODE -ne 0) { throw "Second generator run exited $LASTEXITCODE" }
    $second = Assert-Art $generatedArt $generatedNames
    foreach ($name in $generatedNames) {
        if ($shipped[$name] -cne $first[$name] -or $first[$name] -cne $second[$name]) {
            throw "$name is stale or not byte-identical across regeneration"
        }
    }
} finally {
    Remove-Item -LiteralPath $scratch -Recurse -Force
}
$largest = Get-ChildItem -LiteralPath $art -File | Sort-Object Length -Descending | Select-Object -First 1
Write-Output "PASS: $($expected.Count) XML SVGs; exact filenames, safe local shapes, six-color palette, all under 8 KiB."
Write-Output "PASS: backdrop/entrance and 4 variants are 256x64 (4:1); crowd is 512x64 (8:1), all with matching viewBox."
Write-Output "PASS: fallback/crowd and 34 square SVGs match preserved SHA-256; entrance matches its authorized updated hash."
Write-Output "PASS: 13 distinct real band names, exact accessible casing, uppercase shape spelling, no scene repeats; neutral ENTRADA sign."
Write-Output "PASS: 4 variants reserve dark lower-center musician and bottom-eighth crowd zones."
Write-Output "PASS: shipped art and two generator runs are byte-identical (SHA-256, all $($generatedNames.Count) generated files)."
Write-Output "Largest asset: $($largest.Name), $($largest.Length) bytes."
