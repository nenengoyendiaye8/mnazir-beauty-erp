@echo off
title M.Nazir_Beauty - ERP Savon Naturel
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  echo Demarrage du serveur ERP M.Nazir_Beauty sur http://localhost:3453 ...
  start "" "http://localhost:3453"
  node server.js
) else (
  echo Ouverture directe de l'ERP M.Nazir_Beauty...
  start "" "%~dp0index.html"
)
