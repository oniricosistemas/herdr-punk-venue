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
# S8 projects nine known figure instances out of the preserved entrance.
$shippedEntranceHash = '0e78ad1a938b46ca9b4e1c15cc3c3cd8377b98ee721ad91204b40f1eb36198f7'
# S9 redraw with 12-unit heads, now without the two flags. Keep the original manifest hash.
$authorizedCrowdHash = 'ca6252a00b737c43d22855f20141f6cc327f85c11a781a950c2e64fe1e13d861'
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
$originalGeneratedNames = $expected
$crowdCutouts = @('crowd-front-punk.svg', 'crowd-front-neighbor.svg')
$crowdAnchors = @{ punk = 206; neighbor = 243 }
$queuePoses = @{ drinker = 3; neighbor = 3; seated = 3; punk = 4; doorway = 4 }
$queueFrames = @(foreach ($pose in $queuePoses.Keys) {
    for ($frame = 0; $frame -lt $queuePoses[$pose]; $frame++) { "queue-$pose-$frame.svg" }
})
$queueWide = @($queueFrames | Where-Object { $_ -like 'queue-doorway-*' }) + @('entrance-foreground.svg')
$generatedNames = $originalGeneratedNames + $crowdCutouts + $queueFrames + @('entrance-foreground.svg', 'crowd-backplate.svg')
$additions = @($kinds | ForEach-Object { "$_-strike.svg" }) + @('monitor-riser.svg')
$walkers = @('punk', 'neighbor')
$walkFrames = @(foreach ($walker in $walkers) {
    foreach ($frame in 0..3) { "queue-walk-$walker-$frame.svg" }
})
$expected = $generatedNames + $additions + $walkFrames
$squareNames = @($originalGeneratedNames | Where-Object { $_ -notin $scenes })
if (@(Compare-Object ($squareNames | Sort-Object) ($squareHashes.PSObject.Properties.Name | Sort-Object)).Count -ne 0) {
    throw 'Square-asset preservation manifest does not match the 34 expected names'
}
function Assert-Art($directory, $inventory, [switch]$ShippedEntrance) {
    $files = @(Get-ChildItem -LiteralPath $directory -File)
    $diff = @(Compare-Object ($inventory | Sort-Object) ($files.Name | Sort-Object))
    if ($diff.Count -ne 0) { throw "Wrong asset file set: $($diff | Out-String)" }
    $hashes = @{}
    $queueGeometry = @{}
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
        $width = if ($file.Name -in @('crowd.svg', 'crowd-backplate.svg')) { '512' }
            elseif ($file.Name -in $scenes -or $file.Name -in $walkFrames -or $file.Name -in $queueWide) { '256' } else { '64' }
        if ($doc.DocumentElement.LocalName -ne 'svg' -or
            $doc.DocumentElement.NamespaceURI -ne 'http://www.w3.org/2000/svg' -or
            $doc.DocumentElement.GetAttribute('viewBox') -cne "0 0 $width 64" -or
            $doc.DocumentElement.GetAttribute('width') -cne $width -or
            $doc.DocumentElement.GetAttribute('height') -cne '64') {
            throw "$($file.Name): wrong SVG root, namespace, dimensions or viewBox"
        }
        if ($file.Name -eq 'crowd.svg') {
            $fans = @($doc.SelectNodes('/*/*[local-name()="defs"]/*[local-name()="g"]'))
            foreach ($fan in $fans) {
                $face = $fan.FirstChild
                if ($face.LocalName -ne 'rect' -or $face.GetAttribute('fill') -cne '#eee3c5' -or
                    $fan.GetAttribute('transform') -cnotmatch '^scale\(([0-9.]+)\)$') {
                    throw 'crowd.svg: missing scaled fan face'
                }
                $scale = [double]::Parse($Matches[1], [Globalization.CultureInfo]::InvariantCulture)
                $headHeight = [int]$face.GetAttribute('height') * $scale
                if ($headHeight -ne 12) {
                    throw "crowd.svg: head height $headHeight must be 12 canvas units"
                }
                $pose = $fan.GetAttribute('id')
                if ($crowdAnchors.ContainsKey($pose)) {
                    $faceCenter = $scale * ([double]$face.GetAttribute('x') + [double]$face.GetAttribute('width') / 2)
                    $uses = @($doc.SelectNodes("/*/*[@href='#$pose']"))
                    if ($uses.Count -eq 0 -or @($uses | Where-Object {
                        [Math]::Abs([double]$_.GetAttribute('x') + $faceCenter - $crowdAnchors[$pose]) -lt 0.5
                    }).Count -ne 1) {
                        throw "crowd.svg: $pose face must match its main.js cutout x anchor"
                    }
                }
            }
            $figures = @($doc.SelectNodes('/*/*[local-name()="use"]'))
            if ($fans.Count -ne 3 -or $figures.Count -ne 24) {
                throw 'crowd.svg: expected 24 figures in three poses'
            }
        }
        if ($file.Name -in @('crowd.svg', 'crowd-backplate.svg')) {
            # The hem is the only standalone painted shape; figures are defs/use.
            $standalone = $doc.SelectNodes('/*/*[not(local-name()="title" or local-name()="defs" or local-name()="use")]')
            if ($doc.SelectNodes('//*[@role or @aria-label]').Count -ne 0 -or
                $standalone.Count -ne 1 -or $standalone[0].LocalName -ne 'path') {
                throw "$($file.Name): expected only the crowd hem and figure shapes, without flags, poles or labels"
            }
        }
        if (($file.Name -in @('crowd.svg', 'crowd-backplate.svg') -or $file.Name -in $crowdCutouts) -and
            $doc.DocumentElement.GetAttribute('shape-rendering') -cne 'crispEdges') {
            throw "$($file.Name): crowd art must use crisp edges"
        }
        if (($file.Name -in $walkFrames -or $file.Name -in $queueFrames) -and
            $doc.DocumentElement.GetAttribute('shape-rendering') -cne 'crispEdges') {
            throw "$($file.Name): queue walker must use crisp edges"
        }
        if ($file.Name -in $queueFrames) {
            $shapes = $doc.SelectNodes('//*[local-name()="path" or local-name()="rect" or local-name()="circle" or local-name()="use"]')
            if (($file.Name -eq 'queue-doorway-3.svg') -ne ($shapes.Count -eq 0)) {
                throw "$($file.Name): only the doorway's gone pose may be empty"
            }
            $queueGeometry[$file.Name] = @($shapes | ForEach-Object { $_.OuterXml }) -join ''
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
                    $attribute.Value -ne 'none' -and ($attribute.Value -notin $palette -or
                    ($file.Name -in $walkFrames -and $attribute.Value -eq '#385947'))) {
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
        if ($file.Name -in $originalScenes) {
            $authorized = if ($ShippedEntrance -and $file.Name -eq 'entrance.svg') { $shippedEntranceHash }
                elseif ($file.Name -eq 'crowd.svg') { $authorizedCrowdHash }
                else { $sceneHashes.($file.Name) }
            if ($hashes[$file.Name] -ine $authorized) {
                throw "$($file.Name): original scene changed from its authorized SHA-256"
            }
        }
    }
    foreach ($kind in $kinds) {
        $unique = @($states | ForEach-Object { $hashes["$kind-$_.svg"] } | Select-Object -Unique)
        if ($unique.Count -ne 4) { throw "$kind has duplicate states" }
    }
    foreach ($walker in $walkers) {
        $frames = @(0..3 | ForEach-Object { $hashes["queue-walk-$walker-$_.svg"] } | Where-Object { $_ })
        if ($frames.Count -ne 0 -and @($frames | Select-Object -Unique).Count -ne 4) {
            throw "$walker must have four distinct walk frames"
        }
    }
    foreach ($pose in $queuePoses.Keys) {
        $frames = @(for ($frame = 0; $frame -lt $queuePoses[$pose]; $frame++) {
            $name = "queue-$pose-$frame.svg"
            if ($pose -eq 'doorway') { $hashes[$name] } else { $queueGeometry[$name] }
        })
        if (@($frames | Select-Object -Unique).Count -ne $queuePoses[$pose]) {
            throw "$pose must have $($queuePoses[$pose]) distinct queue frames"
        }
    }
    return $hashes
}
# Check shipped files before generation, so stale/corrupt delivery is not masked.
$shipped = Assert-Art $art $expected -ShippedEntrance
# Generate 62 assets in scratch, including all 41 originals. The original
# two walk sets and other stage additions are checked in the shipped inventory.
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
    $first = Assert-Art $generatedArt $generatedNames -ShippedEntrance
    & node $generator
    if ($LASTEXITCODE -ne 0) { throw "Second generator run exited $LASTEXITCODE" }
    $second = Assert-Art $generatedArt $generatedNames -ShippedEntrance
    foreach ($name in $generatedNames) {
        if ($shipped[$name] -cne $first[$name] -or $first[$name] -cne $second[$name]) {
            throw "$name is stale or not byte-identical across regeneration"
        }
    }
    # Independently prove that the shipped entrance differs from the preserved
    # generator output by exactly the original T8 and new S8 use removals.
    & node $generator --preserved-entrance
    if ($LASTEXITCODE -ne 0) { throw "Preserved entrance generation exited $LASTEXITCODE" }
    $entrancePath = Join-Path $generatedArt 'entrance.svg'
    if ((Get-FileHash -LiteralPath $entrancePath -Algorithm SHA256).Hash -ine $sceneHashes.'entrance.svg') {
        throw 'Preserved entrance changed from its original SHA-256'
    }
    $projectedEntrance = [IO.File]::ReadAllText($entrancePath)
    foreach ($figure in @('punk 145 33', 'neighbor 220 32', 'neighbor 103 30', 'neighbor 169 32',
        'drinker 9 28', 'drinker 193 33', 'punk 38 29', 'seated 6 37', 'seated 42 37')) {
        $id, $x, $y = $figure -split ' '
        $line = '  <use href="#{0}" x="{1}" y="{2}"/>' -f $id, $x, $y
        $projectedEntrance = $projectedEntrance.Replace(($line + "`n"), '')
    }
    $expectedEntrance = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($projectedEntrance))
    $actualEntrance = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $art 'entrance.svg')))
    if ($actualEntrance -cne $expectedEntrance) {
        throw 'entrance.svg differs from regeneration beyond the nine authorized queue figure removals'
    }
} finally {
    Remove-Item -LiteralPath $scratch -Recurse -Force
}
$largest = Get-ChildItem -LiteralPath $art -File | Sort-Object Length -Descending | Select-Object -First 1
Write-Output "PASS: $($expected.Count) XML SVGs; exact filenames, safe local shapes, six-color palette, all under 8 KiB."
Write-Output "PASS: wide scenes, $($walkFrames.Count) preserved walk frames and $($queueFrames.Count) new queue poses have matching viewBoxes; crowd and its backplate are 512x64 (8:1)."
Write-Output "PASS: fallback and 34 square SVGs match preserved SHA-256; crowd and entrance match their authorized updated hashes."
Write-Output "PASS: 24 larger crowd figures, two anchored figure cutouts, no flags or poles on either strip, and crisp edges."
Write-Output "PASS: 13 distinct real band names, exact accessible casing, uppercase shape spelling, no scene repeats; neutral ENTRADA sign."
Write-Output "PASS: 4 variants reserve dark lower-center musician and bottom-eighth crowd zones."
Write-Output "PASS: two generator runs and shipped art are byte-identical (SHA-256, all $($generatedNames.Count) generated files, including all $($originalGeneratedNames.Count) originals). The preserved entrance matches its original SHA-256 and has exactly nine authorized figure removals."
Write-Output "Largest asset: $($largest.Name), $($largest.Length) bytes."
