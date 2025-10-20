@echo off
set /p TOKEN=Introduz o teu token GitHub: 
set USER=autozarco
set REPO=retomas

echo.
echo 🔧 A criar repositório %REPO% no GitHub...

curl -u %USER%:%TOKEN% https://api.github.com/user/repos -d "{\"name\":\"%REPO%\",\"private\":false}"

echo.
echo 🚀 Agora a enviar ficheiros...

git init
git branch -M main
git remote add origin https://github.com/%USER%/%REPO%.git
git add .
git commit -m "Inicial: Retomas Auto Zarco - projeto Replit"
git push -u origin main

echo.
echo ✅ Repositório criado com sucesso em:
echo    https://github.com/%USER%/%REPO%
pause
