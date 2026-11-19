@echo off
chcp 65001 > nul
echo ========================================================
echo   M.NAZIR_BEAUTY ERP - ENVOI GITHUB & DEPLOIEMENT RENDER
echo ========================================================
echo.

set /p REPO_URL="Entrez l'URL de votre depot GitHub (ex: https://github.com/nenengoyendiaye8/mnazir-beauty-erp.git) : "

if "%REPO_URL%"=="" (
    echo [ERREUR] Aucune URL saisie. Annulation.
    pause
    exit /b
)

echo.
echo [1/3] Configuration du depot distant GitHub...
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo.
echo [2/3] Preparation de la branche principale (main)...
git branch -M main

echo.
echo [3/3] Envoi des fichiers sur GitHub...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   SUCCES ! Votre code est publie sur GitHub.
    echo.
    echo   Etape suivante sur Render (https://dashboard.render.com) :
    echo   1. Cliquez sur "New +" -^> "Static Site" (ou "Blueprint")
    echo   2. Selectionnez le depot GitHub : mnazir-beauty-erp
    echo   3. Build Command : npm install ^&^& npm run build
    echo   4. Publish Directory : dist
    echo   5. Cliquez sur "Create Static Site" !
    echo ========================================================
) else (
    echo.
    echo [ERREUR] Impossible de pousser sur GitHub.
    echo Verifiez que le depot est bien cree sur GitHub.
)

pause
