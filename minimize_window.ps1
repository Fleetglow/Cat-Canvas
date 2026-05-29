Start-Sleep -Seconds 3
Start-Process "http://127.0.0.1:3000/"
Start-Sleep -Milliseconds 800

$member = '[DllImport("user32.dll")] public static extern System.IntPtr FindWindow(string lpClassName, string lpWindowName); [DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr hWnd, int nCmdShow);'
Add-Type -MemberDefinition $member -Name "Win32" -Namespace "Native" -ErrorAction SilentlyContinue

$hwnd = [Native.Win32]::FindWindow($null, "Infinite Canvas Server [CMD]")
if ($hwnd -ne [System.IntPtr]::Zero) {
    [Native.Win32]::ShowWindow($hwnd, 6)
}
