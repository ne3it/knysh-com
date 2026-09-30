$urls = @(
    'https://github.com/dejavu-fonts/dejavu-fonts/raw/version_2_37/ttf/DejaVuSans.ttf',
    'https://github.com/dejavu-fonts/dejavu-fonts/raw/version_2_37/ttf/DejaVuSans-Bold.ttf'
)

$wc = New-Object System.Net.WebClient

# Download regular
try {
    $wc.DownloadFile($urls[0], 'DejaVuSans.ttf')
    $bytes = [System.IO.File]::ReadAllBytes('DejaVuSans.ttf')
    $b64 = [Convert]::ToBase64String($bytes)
    [System.IO.File]::WriteAllText('DejaVuSans.b64', $b64)
    Write-Host 'Regular font downloaded and encoded'
} catch {
    Write-Host 'Error downloading regular: ' $_.Exception.Message
}

# Download bold
try {
    $wc.DownloadFile($urls[1], 'DejaVuSans-Bold.ttf')
    $bytes = [System.IO.File]::ReadAllBytes('DejaVuSans-Bold.ttf')
    $b64 = [Convert]::ToBase64String($bytes)
    [System.IO.File]::WriteAllText('DejaVuSans-Bold.b64', $b64)
    Write-Host 'Bold font downloaded and encoded'
} catch {
    Write-Host 'Error downloading bold: ' $_.Exception.Message
}