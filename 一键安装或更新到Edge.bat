@echo off
chcp 65001 >nul
echo =========================================================
echo   小咩魔法采集 (v1.0.8) · 一键安装/更新到 C:\cbmate-ext
echo =========================================================
echo.
set "SRC=%~dp0"
set "DST=C:\cbmate-ext"

if not exist "%DST%" mkdir "%DST%"
xcopy "%SRC%*" "%DST%\" /E /Y /I /Q >nul

echo [完成] 已将最新扩展文件同步至: %DST%
echo.
echo 1. 若您之前已加载过 C:\cbmate-ext，请在浏览器扩展页面点击「刷新」图标即可；
echo 2. 若首次安装，请在浏览器打开 edge://extensions 或 chrome://extensions，
echo    开启「开发人员模式」，点击「加载解压缩的扩展」并选择 C:\cbmate-ext。
echo.
pause
