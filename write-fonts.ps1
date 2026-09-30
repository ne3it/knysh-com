$regular = Get-Content 'E:\knysh.com\DejaVuSans.b64' -Raw
$bold = Get-Content 'E:\knysh.com\DejaVuSans-Bold.b64' -Raw

$content = @"
// DejaVu Sans font Base64 encoded TTF files for jsPDF
// Generated from https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37/ttf/

export const DEJAVU_SANS_REGULAR_BASE64 = `$regular`;

export const DEJAVU_SANS_BOLD_BASE64 = `$bold`;
"@

[System.IO.File]::WriteAllText('E:\knysh.com\src\lib\fonts.ts', $content)
Write-Host 'Fonts file written, size: ' (Get-ChildItem 'E:\knysh.com\src\lib\fonts.ts').Length 'bytes'