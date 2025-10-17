# push_to_github.ps1 - creates repo and pushes
$ErrorActionPreference = "Stop"
$githubUser = "autozarco"
$repoName = "retomas"
$tokenFile = ".\setup_token.txt"
if (!(Test-Path $tokenFile)) { Write-Host "Token file not found"; exit 1 }
$token = (Get-Content $tokenFile -Raw).Trim()
$createUrl = "https://api.github.com/user/repos"
$body = @{ name = $repoName; description = "Retomas app - created by automation"; private = $false } | ConvertTo-Json
$headers = @{ Authorization = "token $token"; "User-Agent" = "retomas-setup-script" }
try { $resp = Invoke-RestMethod -Uri $createUrl -Method Post -Headers $headers -Body $body -ContentType "application/json" -ErrorAction Stop; Write-Host "Repository created: $($resp.html_url)" } catch { Write-Host "If repo exists, continuing..." }
if (-not (Test-Path ".git")) { git init; git add .; git commit -m "Initial commit - retomas auto" } 
$remoteUrl = "https://$($githubUser):$($token)@github.com/$($githubUser)/$($repoName).git"
try { git remote remove origin } catch {}
git remote add origin $remoteUrl
git branch -M main
git push -u origin main --force
Write-Host "Push complete - remember to remove setup_token.txt for security"
