@echo off
title FIA Clean & Care - Automated Stability Test Suite
color 0A

echo ====================================================================
echo             FIA CLEAN & CARE - AUTOMATED REGRESSION TESTS
echo                  Version: v52.0.0 (Locked Milestone)
echo ====================================================================
echo.

cd /d "%~dp0"

echo Running 117 Automated Business, Accounting and FIFO Tests...
echo.

where bun >nul 2>nul
if %errorlevel% equ 0 (
    bun tests/accounting-engine.test.js
    goto check_result
)

where node >nul 2>nul
if %errorlevel% equ 0 (
    node tests/accounting-engine.test.js
    goto check_result
)

echo [ERROR] Neither Bun nor Node.js runtime was found in system PATH.
pause
exit /b 1

:check_result
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ====================================================================
    echo [ERROR] Automated tests failed! Regressions detected.
    echo ====================================================================
    pause
    exit /b %errorlevel%
)

echo.
echo ====================================================================
echo [SUCCESS] All 117 tests passed! App calculations are 100%% verified.
echo ====================================================================
echo.
pause
