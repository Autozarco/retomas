Retomas — Windows Auto Deploy Package (full guide with images)
User: autozarco
Repo: retomas

Files included:
- setup_token.txt (paste your GitHub token here)
- push_to_github.ps1 / .bat  (create repo and push)
- deploy_verify.ps1  (next steps)
- Guia_Deploy_Completo.pdf  (visual guide)
- Project skeleton (backend/, frontend/, docker-compose.yml, render.yaml)

Steps:
1. Install Git for Windows: https://git-scm.com/download/win
2. Extract this ZIP to C:\Users\<you>\Documents\retomas_auto_win
3. Paste your GitHub token into setup_token.txt
4. Double-click push_to_github.bat to create the GitHub repo and push
5. After successful push, run deploy_verify.ps1 and follow the visual PDF
