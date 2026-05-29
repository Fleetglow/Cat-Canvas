Start-Sleep -Seconds 3
Start-Process "http://127.0.0.1:3000/"

Start-Sleep -Milliseconds 800

# 用 FindWindow 按标题精确查找窗口句柄
$code = @'
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll", SetLastError=true)]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

$hwnd = [Win32]::FindWindow($null, "Infinite Canvas Server [CMD]")
if ($hwnd -ne [IntPtr]::Zero) {
    # SW_MINIMIZE = 6
    [Win32]::ShowWindow($hwnd, 6)
} else {
    # 兜底：枚举所有顶级窗口（按标题模糊匹配）
    Add-Type -TypeDefinition '
    using System;
    using System.Runtime.InteropServices;
    public class EnumWin {
        private delegate bool EnumDelegate(IntPtr hWnd, IntPtr lParam);
        [DllImport("user32.dll")] private static extern bool EnumWindows(EnumDelegate lpEnumFunc, IntPtr lParam);
        [DllImport("user32.dll")] private static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
        public static void MinimizeByTitle(string keyword) {
            EnumWindows((hWnd, _) => {
                var sb = new System.Text.StringBuilder(256);
                if (GetWindowText(hWnd, sb, 256) > 0 && sb.ToString().Contains(keyword)) {
                    Win32.ShowWindow(hWnd, 6);
                }
                return true;
            }, IntPtr.Zero);
        }
    }
    ' -ErrorAction SilentlyContinue
    [EnumWin]::MinimizeByTitle("Infinite Canvas")
}
