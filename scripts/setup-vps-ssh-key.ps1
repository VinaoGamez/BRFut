# Gera chave SSH local (se não existir) e instala na VPS BRFut.
# Uso: .\scripts\setup-vps-ssh-key.ps1 -VpsHost 177.153.66.13 -VpsUser root
param(
  [string]$VpsHost = '177.153.66.13',
  [string]$VpsUser = 'root',
  [string]$KeyPath = "$env:USERPROFILE\.ssh\brfut_vps"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path (Split-Path $KeyPath))) {
  New-Item -ItemType Directory -Force -Path (Split-Path $KeyPath) | Out-Null
}

if (-not (Test-Path $KeyPath)) {
  Write-Host "Gerando chave em $KeyPath ..."
  ssh-keygen -t ed25519 -f $KeyPath -N '""' -C "brfut-vps-$(whoami)"
} else {
  Write-Host "Chave já existe: $KeyPath"
}

$pub = Get-Content "$KeyPath.pub" -Raw
Write-Host @"

Próximo passo — cole a chave na VPS (uma vez, com senha):

  type `"$KeyPath.pub`" | ssh ${VpsUser}@${VpsHost} `"mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`"

Teste sem senha:

  ssh -i `"$KeyPath`" ${VpsUser}@${VpsHost} `"echo ok`"

Opcional (~/.ssh/config):

  Host brfut-vps
    HostName $VpsHost
    User $VpsUser
    IdentityFile $KeyPath

"@
