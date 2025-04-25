@echo off
echo Running Lucid API Server deployment script...
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-deployment.ps1"
pause 