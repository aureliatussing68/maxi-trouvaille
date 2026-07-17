# Chantier social_desktop_apps - couche 958

Decision: HOLD_MANUAL
Scope: future_connector
Jarvis core candidate: False
Future connector candidate: True
External project not blocked: True
Mode: inventory_shortcuts_manual_install
Integration: desktop app inventory and manual login checklist
Focus: Inventory TikTok, CapCut, Instagram, Facebook, YouTube, LinkedIn, Pinterest, Snapchat and prepare desktop shortcuts when apps already exist.
Action: Prepare a draft packet and wait for Mouss validation.

Garde-fous:
- no_unattended_install
- no_account_login_without_mouss
- no_store_purchase
- shortcuts_only_when_existing_app_found
- human_validation_required

Regressions a privilegier:
- jarvis_desktop_fast_status_regression.py
- jarvis_window_control_center_regression.py
- jarvis_recent_artifact_secret_scan_regression.py

Modules candidats:
- desktop_control.py
- project_workspace.py
- jarvis_window_control_center.py

Variables ou artefacts de configuration a verifier:
- aucune

Regle d'integration:
- Sauvegarder avant toute modification d'un fichier existant.
- Lancer les regressions ciblees et le scan anti-fuite.
- Integrer automatiquement seulement si la decision est GO_PREPARE_LAYER.
- Garder toute action sensible en HOLD_MANUAL.
