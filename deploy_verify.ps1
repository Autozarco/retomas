# deploy_verify.ps1 - next steps after push
Write-Host "NEXT STEPS AFTER GITHUB PUSH" -ForegroundColor Cyan
Write-Host "1) Create Neon DB and copy DATABASE_URL"
Write-Host "2) On Render, import repo and let render.yaml configure services"
Write-Host "3) Set env vars on Render: DATABASE_URL, JWT_SECRET"
Write-Host "4) (Optional) Deploy frontend on Vercel and set NEXT_PUBLIC_API_URL"
