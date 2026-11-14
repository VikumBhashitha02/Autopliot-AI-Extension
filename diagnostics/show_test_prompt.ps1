param(
    [int]$AutoCloseSeconds = 30,
    [switch]$StartDisabledSubmit = $false
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = "Antigravity IDE - Action Confirmation"
$form.Size = New-Object System.Drawing.Size(520, 360)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "Antigravity IDE requires confirmation to proceed with the action:"
$lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$lblTitle.Location = New-Object System.Drawing.Point(20, 20)
$lblTitle.Size = New-Object System.Drawing.Size(460, 40)
$form.Controls.Add($lblTitle)

$grpOptions = New-Object System.Windows.Forms.GroupBox
$grpOptions.Text = "Select Recommended Action"
$grpOptions.Location = New-Object System.Drawing.Point(20, 70)
$grpOptions.Size = New-Object System.Drawing.Size(460, 150)
$grpOptions.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$form.Controls.Add($grpOptions)

$radio1 = New-Object System.Windows.Forms.RadioButton
$radio1.Text = "(Recommended) Apply approved workflow changes"
$radio1.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$radio1.Location = New-Object System.Drawing.Point(20, 30)
$radio1.Size = New-Object System.Drawing.Size(420, 25)
$grpOptions.Controls.Add($radio1)

$radio2 = New-Object System.Windows.Forms.RadioButton
$radio2.Text = "Inspect diff and pause execution"
$radio2.Location = New-Object System.Drawing.Point(20, 65)
$radio2.Size = New-Object System.Drawing.Size(420, 25)
$grpOptions.Controls.Add($radio2)

$radio3 = New-Object System.Windows.Forms.RadioButton
$radio3.Text = "Skip this step and proceed to next task"
$radio3.Location = New-Object System.Drawing.Point(20, 100)
$radio3.Size = New-Object System.Drawing.Size(420, 25)
$grpOptions.Controls.Add($radio3)

$btnSubmit = New-Object System.Windows.Forms.Button
$btnSubmit.Text = "Submit"
$btnSubmit.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$btnSubmit.Location = New-Object System.Drawing.Point(280, 240)
$btnSubmit.Size = New-Object System.Drawing.Size(95, 35)
$btnSubmit.DialogResult = [System.Windows.Forms.DialogResult]::OK
if ($StartDisabledSubmit) {
    $btnSubmit.Enabled = $false
}
$form.Controls.Add($btnSubmit)

$btnCancel = New-Object System.Windows.Forms.Button
$btnCancel.Text = "Cancel"
$btnCancel.Location = New-Object System.Drawing.Point(385, 240)
$btnCancel.Size = New-Object System.Drawing.Size(95, 35)
$btnCancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($btnCancel)

# If start disabled, enable submit when radio selected
if ($StartDisabledSubmit) {
    $enableSubmit = {
        $btnSubmit.Enabled = $true
    }
    $radio1.Add_CheckedChanged($enableSubmit)
    $radio2.Add_CheckedChanged($enableSubmit)
    $radio3.Add_CheckedChanged($enableSubmit)
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = $AutoCloseSeconds * 1000
$timer.Add_Tick({
    $timer.Stop()
    $form.Close()
})
$timer.Start()

$result = $form.ShowDialog()
Write-Output ("DIALOG_RESULT:" + $result.ToString() + "|RADIO1_CHECKED:" + $radio1.Checked)
