# Cronometro de apresentacao - janela fixa no canto, sempre por cima
# Duplo clique: iniciar/pausar | Botao direito: menu | Arrastar: mover
param([double]$Minutos = 0)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic
[System.Windows.Forms.Application]::EnableVisualStyles()

if ($Minutos -le 0) {
    $r = [Microsoft.VisualBasic.Interaction]::InputBox("Duracao da apresentacao (minutos):", "Cronometro de apresentacao", "20")
    if ([string]::IsNullOrWhiteSpace($r)) { exit }
    $Minutos = [double]($r -replace ',', '.')
}

$script:totalMs = $Minutos * 60000
$script:warnMs  = 5 * 60000
$script:sw      = New-Object System.Diagnostics.Stopwatch
$script:drag    = $false
$script:dragPt  = New-Object System.Drawing.Point(0,0)

$verde    = [System.Drawing.Color]::FromArgb(61,220,132)
$amarelo  = [System.Drawing.Color]::FromArgb(245,197,66)
$laranja  = [System.Drawing.Color]::FromArgb(255,138,61)
$vermelho = [System.Drawing.Color]::FromArgb(255,77,77)
$fundo    = [System.Drawing.Color]::FromArgb(17,20,26)
$fundo2   = [System.Drawing.Color]::FromArgb(70,16,16)

$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = 'None'
$form.TopMost = $true
$form.BackColor = $fundo
$form.Size = New-Object System.Drawing.Size(240, 100)
$form.StartPosition = 'Manual'
$form.Opacity = 0.92
$form.Text = 'Cronometro'
$tela = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$form.Location = New-Object System.Drawing.Point(($tela.Right - $form.Width - 16), ($tela.Top + 16))

$lblTit = New-Object System.Windows.Forms.Label
$lblTit.Text = 'TEMPO RESTANTE'
$lblTit.ForeColor = [System.Drawing.Color]::FromArgb(138,147,163)
$lblTit.Font = New-Object System.Drawing.Font('Consolas', 8)
$lblTit.Location = New-Object System.Drawing.Point(12, 6)
$lblTit.AutoSize = $true

$lblBig = New-Object System.Windows.Forms.Label
$lblBig.ForeColor = $verde
$lblBig.Font = New-Object System.Drawing.Font('Consolas', 32, [System.Drawing.FontStyle]::Bold)
$lblBig.Location = New-Object System.Drawing.Point(6, 20)
$lblBig.AutoSize = $true

$lblInf = New-Object System.Windows.Forms.Label
$lblInf.ForeColor = [System.Drawing.Color]::FromArgb(170,178,192)
$lblInf.Font = New-Object System.Drawing.Font('Consolas', 9)
$lblInf.Location = New-Object System.Drawing.Point(12, 76)
$lblInf.AutoSize = $true

$form.Controls.AddRange(@($lblTit, $lblBig, $lblInf))

function Formatar([double]$ms) {
    if ($ms -lt 0) { $s = [math]::Floor(-$ms / 1000); $p = '+' }
    else { $s = [math]::Ceiling($ms / 1000); $p = '' }
    $m = [math]::Floor($s / 60); $r = $s % 60
    return ('{0}{1:00}:{2:00}' -f $p, $m, $r)
}

function Atualizar {
    $el  = $script:sw.Elapsed.TotalMilliseconds
    $rem = $script:totalMs - $el
    $agora = Get-Date
    $lblBig.Text = Formatar $rem
    if ($rem -lt 0) {
        $lblBig.ForeColor = $vermelho
        if ([math]::Floor($el / 1000) % 2 -eq 0) { $form.BackColor = $fundo2 } else { $form.BackColor = $fundo }
        $fim = 'ESGOTADO'
    } else {
        $form.BackColor = $fundo
        if ($rem -le 60000) { $lblBig.ForeColor = $laranja }
        elseif ($rem -le $script:warnMs) { $lblBig.ForeColor = $amarelo }
        else { $lblBig.ForeColor = $verde }
        $fim = 'Fim ' + $agora.AddMilliseconds($rem).ToString('HH:mm')
    }
    $estado = ''
    if (-not $script:sw.IsRunning) { if ($el -eq 0) { $estado = ' PRONTO' } else { $estado = ' PAUSADO' } }
    $lblTit.Text = 'TEMPO RESTANTE' + $estado
    $lblInf.Text = $fim + '   ' + $agora.ToString('HH:mm:ss')
    $form.TopMost = $true
}

function Alternar { if ($script:sw.IsRunning) { $script:sw.Stop() } else { $script:sw.Start() }; Atualizar }

# Menu do botao direito
$menu = New-Object System.Windows.Forms.ContextMenuStrip
[void]$menu.Items.Add('Iniciar / Pausar', $null, { Alternar })
[void]$menu.Items.Add('Reiniciar', $null, { $script:sw.Reset(); Atualizar })
[void]$menu.Items.Add('+1 minuto', $null, { $script:totalMs += 60000; Atualizar })
[void]$menu.Items.Add('-1 minuto', $null, { if ($script:totalMs -gt 60000) { $script:totalMs -= 60000 }; Atualizar })
[void]$menu.Items.Add('Nova duracao...', $null, {
    $r = [Microsoft.VisualBasic.Interaction]::InputBox("Duracao (minutos):", "Cronometro", [string][math]::Round($script:totalMs / 60000))
    if (-not [string]::IsNullOrWhiteSpace($r)) { $script:totalMs = [double]($r -replace ',', '.') * 60000; $script:sw.Reset(); Atualizar }
})
[void]$menu.Items.Add('-')
[void]$menu.Items.Add('Sair', $null, { $form.Close() })
$form.ContextMenuStrip = $menu

# Arrastar e duplo clique (no formulario e nos textos)
foreach ($c in @($form, $lblTit, $lblBig, $lblInf)) {
    if ($c -ne $form) { $c.ContextMenuStrip = $menu }
    $c.Add_MouseDown({ param($s, $e)
        if ($e.Button -eq 'Left') { $script:drag = $true; $script:dragPt = [System.Windows.Forms.Cursor]::Position; $script:formPt = $form.Location }
    })
    $c.Add_MouseMove({ param($s, $e)
        if ($script:drag) {
            $p = [System.Windows.Forms.Cursor]::Position
            $form.Location = New-Object System.Drawing.Point(($script:formPt.X + $p.X - $script:dragPt.X), ($script:formPt.Y + $p.Y - $script:dragPt.Y))
        }
    })
    $c.Add_MouseUp({ $script:drag = $false })
    $c.Add_DoubleClick({ Alternar })
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 250
$timer.Add_Tick({ Atualizar })
$timer.Start()

Atualizar
[void]$form.ShowDialog()
$timer.Stop()
