$bytes = [System.IO.File]::ReadAllBytes('E:\knysh.com\DejaVuSans.ttf')
$b64 = [Convert]::ToBase64String($bytes)
[System.IO.File]::WriteAllText('E:\knysh.com\DejaVuSans.b64', $b64)
Write-Host 'Regular: ' $b64.Length 'chars'

$bytes = [System.IO.File]::ReadAllBytes('E:\knysh.com\DejaVuSans-Bold.ttf')
$b64 = [Convert]::ToBase64String($bytes)
[System.IO.File]::WriteAllText('E:\knysh.com\DejaVuSans-Bold.b64', $b64)
Write-Host 'Bold: ' $b64.Length 'chars'