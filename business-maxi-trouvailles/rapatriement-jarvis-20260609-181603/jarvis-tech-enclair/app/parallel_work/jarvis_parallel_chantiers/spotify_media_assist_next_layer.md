# Chantier spotify_media_assist - couche 958

Decision: HOLD_MANUAL
Scope: future_connector
Jarvis core candidate: False
Future connector candidate: True
External project not blocked: True
Mode: local_media_control_layers
Integration: spotify controller and voice commands
Focus: Prepare Spotify commands and playlist helpers without starting playback automatically.
Action: Prepare a draft packet and wait for Mouss validation.

Garde-fous:
- no_auto_playback_without_user_request
- no_account_change
- no_paid_subscription_action
- local_control_only

Regressions a privilegier:
- jarvis_command_regression.py
- jarvis_recent_artifact_secret_scan_regression.py

Modules candidats:
- spotify_controller.py
- voice_shortcuts.py
- jarvis_tools_registry.py

Variables ou artefacts de configuration a verifier:
- SPOTIFY_CLIENT_ID
- SPOTIFY_CLIENT_SECRET
- SPOTIFY_REDIRECT_URI

Regle d'integration:
- Sauvegarder avant toute modification d'un fichier existant.
- Lancer les regressions ciblees et le scan anti-fuite.
- Integrer automatiquement seulement si la decision est GO_PREPARE_LAYER.
- Garder toute action sensible en HOLD_MANUAL.
