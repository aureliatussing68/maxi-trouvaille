# CODEX_UPGRADE_REPORT

<!-- markdownlint-disable MD013 MD034 -->

Date: 2026-06-05  
Workspace: `C:\Users\sinek\Desktop\jarvice`  
Mode: installation gratuite/officielle/reputee, sans suppression, sans API payante, sans affichage de secrets.

## Resume

L'environnement Codex a ete renforce par vagues controlees : outils systeme, Git/GitHub, Python, Node/TypeScript, tests, documentation, audit securite, 3D/media, Roblox, MCP et extensions VS Code.

Point important corrige : `C:\Users\sinek\.codex\config.toml` contenait `service_tier = "priority"`, refuse par le CLI Codex actuel. La valeur a ete remplacee par `service_tier = "flex"` apres sauvegarde, ce qui a permis de configurer les MCP proprement.

## Sauvegardes

Sauvegardes creees avant modification/installation :

- `C:\Users\sinek\Desktop\jarvice\logs\codex_upgrade_20260605_1223\backups\codex_config.toml.bak`
- `C:\Users\sinek\Desktop\jarvice\logs\codex_upgrade_20260605_1223\backups\codex_global_state.json.bak`
- `C:\Users\sinek\Desktop\jarvice\logs\codex_upgrade_20260605_1223\backups\codex_config_pre_mcp.toml.bak`

Les fichiers d'authentification sensibles n'ont pas ete copies ni affiches.

## Outils installes ou confirmes

Systeme/dev :

- GitHub CLI `2.93.0`
- `uv` / `uvx` `0.11.19`
- `jq` `1.8.1`, `yq` `4.53.2`
- `just` `1.51.0`, `fd` `10.4.2`, `rg` `15.1.0`
- `bat` `0.26.1`, `fzf` `0.73.1`, `delta` `0.19.2`, `lazygit` `0.62.2`
- `hyperfine` `1.20.0`, `zoxide` `0.9.9`
- CMake `4.3.3`, Ninja `1.13.2`
- Go `1.26.4`, Rust/Cargo/Rustup `1.96.0` / `1.29.0`
- Deno `2.8.2`, Bun `1.3.14`
- Pandoc `3.9.0.2`, SQLite `3.53.2`

Securite/audit :

- Gitleaks `8.30.1`
- Trivy `0.71.0`
- Syft `1.45.0`
- Grype `0.113.0`
- Bandit `1.9.4`
- pip-audit `2.10.0`
- Semgrep `1.165.0`

Python via `pipx` :

- ruff `0.15.16`
- black `26.5.1`
- mypy `2.1.0`
- pytest `9.0.3` avec `pytest-cov`, `pytest-xdist`, `pytest-mock`, `hypothesis`
- pre-commit `4.6.0`
- pydocstyle `6.3.0`
- interrogate `1.7.0`
- mkdocs `1.6.1` avec `mkdocs-material`
- pdoc `16.0.0`
- yamllint `1.38.0`

Node/JS/TS/docs/tests :

- pnpm `11.5.2`, yarn `1.22.22`
- TypeScript `6.0.3`, tsx `4.22.4`
- ESLint `10.4.1`, Prettier `3.8.3`, Biome `2.4.16`
- Vitest `4.1.8`, Playwright `1.60.0`
- TypeDoc `0.28.19`, JSDoc `4.0.5`, markdownlint `0.48.0`
- npm-check-updates `22.2.2`, depcheck `1.4.7`, madge `8.0.0`
- Lighthouse `13.3.0`, LHCI `0.15.1`
- serve `14.2.6`, zx `8.8.5`
- glTF Transform CLI `4.3.0`

MCP packages :

- `@modelcontextprotocol/inspector` `0.22.0`
- `@modelcontextprotocol/sdk` `1.29.0`
- `@modelcontextprotocol/server-filesystem` `2026.1.14`
- `@modelcontextprotocol/server-memory` `2026.1.26`
- `@modelcontextprotocol/server-sequential-thinking` `2025.12.18`
- `@upstash/context7-mcp` `3.1.0`
- `@playwright/mcp` `0.0.75`
- `ruflo` `3.10.37` installe en CLI, MCP en parking disabled.

Roblox/media/3D :

- Rojo `7.6.1`
- Aftman `0.3.0`
- Roblox Studio present
- FFmpeg `8.1.1`
- Blender deja present, upgrade non force pour eviter une rupture de workflow 3D.

## MCP Codex configures

Configuration globale : `C:\Users\sinek\.codex\config.toml`

Actifs :

- `openaiDeveloperDocs` : `https://developers.openai.com/mcp`
- `context7` : documentation technique a jour
- `mcp-sequential-thinking` : raisonnement structure
- `mcp-playwright` : verification navigateur, avec `default_tools_approval_mode = "prompt"`
- `mcp-filesystem-workspaces` : filesystem limite aux dossiers :
  - `C:\Users\sinek\Desktop\jarvice`
  - `C:\Users\sinek\Desktop\Jarvis-TechEnClair\app`
  - `C:\Users\sinek\Desktop\roblox`
  - `C:\Users\sinek\Desktop\maxi-trouvaille`
  - `C:\Users\sinek\Desktop\sos-debarras-68`

Parking / HOLD :

- `ruflo-parking` : configure mais `enabled = false`, car Ruflo expose daemon/swarm/autopilot. Il est pret, mais pas lance automatiquement.
- `server-memory` : installe mais non active pour eviter une memoire MCP non controlee sur des donnees sensibles.
- GitHub MCP : non active car le plugin GitHub et `gh` sont deja disponibles; pas de login/token force.

Note : les MCP ajoutes peuvent necessiter un redemarrage ou une nouvelle session Codex pour apparaitre comme outils disponibles dans l'interface.

## VS Code

Extensions installees/confirmees :

- Python, debugpy, Pylance
- Ruff, Mypy type checker
- Playwright
- ESLint, Prettier
- YAML, TOML, EditorConfig
- GitHub Actions, GitHub Pull Requests
- markdownlint, Mermaid Markdown
- Rojo, Lua

Pas de Copilot ni extension payante ajoutee.

## Validations

Rapports generes dans :

- `C:\Users\sinek\Desktop\jarvice\logs\codex_upgrade_20260605_1223\tool_audit_after.json`
- `C:\Users\sinek\Desktop\jarvice\logs\codex_upgrade_20260605_1223\npm_global_after_install.txt`
- `C:\Users\sinek\Desktop\jarvice\logs\codex_upgrade_20260605_1223\pipx_after_install.txt`
- `C:\Users\sinek\Desktop\jarvice\logs\codex_upgrade_20260605_1223\codex_mcp_final_list.txt`
- `C:\Users\sinek\Desktop\jarvice\logs\codex_upgrade_20260605_1223\vscode_extensions_after.txt`

Resultats :

- Audit versions : OK sur les outils principaux.
- `pip-audit` sur `Jarvis-TechEnClair\app\requirements.txt` : aucune vulnerabilite connue.
- `npm audit` sur `Jarvis-TechEnClair\app\frontend` : OK.
- Trivy secret : resultats rediges dans les rapports JSON.
- Gitleaks : resultats rediges dans les rapports JSON.

Alertes anti-fuite sans valeurs affichees :

- `jarvice` : Gitleaks signale 1 pattern `generic-api-key` dans `.env.local`; Trivy signale 1 finding.
- `Jarvis-TechEnClair\app` : Gitleaks signale 2466 patterns, principalement dans `.browser_profile*`, caches navigateur et backups; Trivy signale 21 findings, surtout `.env*`, backups et quelques faux positifs probables dans dependances/lockfiles.

Aucune valeur de cle n'est reprise dans ce rapport. Les prochaines couches Jarvis devront traiter ces alertes par triage, exclusions propres et sauvegardes, sans suppression automatique.

## HOLD / non installes

- Graphviz : l'installateur winget silencieux est reste bloque; processus stoppe proprement, aucun installateur actif ensuite.
- ImageMagick : installation silencieuse annulee/echec code 2; non relancee en interactif.
- Blender : deja installe, mise a jour non forcee.
- Ruflo MCP : preconfigure mais desactive.
- Aucune API payante, aucun paiement, aucune publication, aucun envoi, aucune connexion compte forcee.

## Extension audio/video/reactivite Jarvis

Ajout effectue le 2026-06-05 dans le venv Jarvis, sans installation payante et sans capture live automatique.

Paquets ajoutes:

- Audio: `soundfile`, `pydub`, `vosk`, `noisereduce`, `openwakeword`.
- Video/vision/media: `imageio`, `imageio-ffmpeg`, `moviepy`, `mss`.
- Reactivite/naturel: `watchdog`, `watchfiles`, `rapidfuzz`, `dateparser`, `humanize`, `cachetools`, `orjson`, `ollama`.
- Correction dependances: `grpcio-status==1.62.3` pour rester compatible avec `protobuf 4.25.9` et `mediapipe 0.10.14`.

Integration Jarvis:

- `config/jarvis_multimodal_toolkit_preview.json`
- `jarvis_multimodal_toolkit_status.py`
- `jarvis_multimodal_toolkit_status_regression.py`
- Ajoute aux chantiers `voice_reactivity` et `vision_camera_gesture` dans le controle central.

Tests:

- `pip check`: OK.
- `jarvis_multimodal_toolkit_status.py`: OK, audio 11/11, video/vision 7/7, reactivite 10/10.
- `jarvis_multimodal_toolkit_status_regression.py`: OK.
- `jarvis_parallel_chantiers.py`: OK.
- `jarvis_parallel_chantiers_regression.py`: OK.
- Scan anti-fuite recent: OK.

Garde-fous maintenus:

- Pas de micro automatique.
- Pas de camera automatique.
- Pas de capture ecran automatique.
- Pas de lecture audio automatique.
- Pas de keylogging.
- Pas d'appel IA distant ou payant depuis ce module.
- Tests live micro/camera/ecran/TTS/wake word en validation manuelle.

## Compatibilite chantiers

Jarvis :

- Python, audit securite, docs, pre-commit, MCP docs, filesystem limite, Playwright et outils web sont prets.
- Les scans indiquent un chantier prioritaire de hygiene secrets/logs/backups avant toute publication ou synchronisation.

Roblox :

- Rojo, Aftman, Roblox Studio, Lua extension et outils Git sont disponibles.
- Le MCP filesystem inclut `C:\Users\sinek\Desktop\roblox`.

Maxi Trouvaille :

- Node/TS, pnpm/yarn, ESLint, Prettier, Playwright, Lighthouse/LHCI, audit npm et docs sont disponibles.
- Le MCP filesystem inclut `C:\Users\sinek\Desktop\maxi-trouvaille`.

SOS Debarras 68 :

- Outils SEO/web utiles disponibles : Lighthouse/LHCI, Playwright, Pandoc, markdownlint.
- Le MCP filesystem inclut `C:\Users\sinek\Desktop\sos-debarras-68`.

## Workflows recommandes

Commandes utiles :

```powershell
codex mcp list
gh auth status
ruff check .
pytest
pip-audit -r requirements.txt
npm audit
pnpm test
npx playwright test
lighthouse http://localhost:3000 --view
gitleaks detect --redact --no-banner --source .
trivy fs --scanners secret .
rojo --version
aftman --version
gltf-transform --help
```

Pour Ruflo :

```powershell
ruflo --help
ruflo doctor
ruflo mcp --help
```

Ne pas lancer `ruflo init`, `ruflo start`, `ruflo daemon`, `ruflo autopilot` ou `ruflo swarm` dans un projet sensible sans validation explicite.

## Sources principales

- OpenAI Codex manual / MCP : https://developers.openai.com/codex/codex-manual.md
- OpenAI Docs MCP : https://developers.openai.com/mcp
- Model Context Protocol : https://modelcontextprotocol.io
- GitHub CLI : https://cli.github.com
- uv : https://docs.astral.sh/uv/
- Playwright MCP : https://github.com/microsoft/playwright-mcp
- Context7 MCP : https://github.com/upstash/context7
- Ruff : https://docs.astral.sh/ruff/
- Trivy : https://trivy.dev
- Gitleaks : https://github.com/gitleaks/gitleaks
- Syft / Grype : https://anchore.com/opensource/
- Rojo : https://rojo.space
- Aftman : https://github.com/LPGhatguy/aftman
- Ruflo package : https://www.npmjs.com/package/ruflo
