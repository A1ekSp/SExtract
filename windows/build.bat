@echo off
setlocal
cd /d "%~dp0"
set "ROOT=%~dp0.."

where dotnet >nul 2>nul
if errorlevel 1 (
    echo [ERROR] .NET 10 SDK is not installed.
    echo Install it from: https://dotnet.microsoft.com/download/dotnet/10.0
    pause
    exit /b 1
)

if not exist "%~dp0www" mkdir "%~dp0www"
for %%F in (index.html script.js style.css favicon.ico) do (
    if not exist "%ROOT%\%%F" (
        echo [ERROR] Missing required web file: %%F
        pause
        exit /b 1
    )
    copy /Y "%ROOT%\%%F" "%~dp0www\%%F" >nul
)

echo.
echo Building SExtract as a single Windows x64 EXE...
echo The first build needs internet access to restore the WebView2 package.
echo.

dotnet publish SExtract.Desktop.csproj ^
  --configuration Release ^
  --runtime win-x64 ^
  --self-contained true ^
  -p:PublishSingleFile=true ^
  -p:IncludeNativeLibrariesForSelfExtract=true ^
  -p:EnableCompressionInSingleFile=true ^
  --output "%ROOT%\dist"

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. Read the error above.
    pause
    exit /b 1
)

echo.
echo SUCCESS! Your portable app is here:
echo %ROOT%\dist\SExtract.exe
pause
