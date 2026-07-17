# Chantier vision_camera_gesture - couche 958

Decision: HOLD_MANUAL
Scope: jarvis_preview
Jarvis core candidate: False
Future connector candidate: False
External project not blocked: False
Mode: manual_preview_only
Integration: vision module and gesture control
Focus: Prepare webcam and gesture preview packets before any camera activation.
Action: Prepare a draft packet and wait for Mouss validation.

Garde-fous:
- no_camera_start_without_manual_validation
- preview_local_only
- no_recording
- no_upload

Regressions a privilegier:
- jarvis_gesture_guard_regression.py
- jarvis_gesture_status_route_regression.py
- jarvis_multimodal_toolkit_status_regression.py
- jarvis_recent_artifact_secret_scan_regression.py

Modules candidats:
- vision_module.py
- gesture_control.py
- jarvis_multimodal_toolkit_status.py

Variables ou artefacts de configuration a verifier:
- aucune

Regle d'integration:
- Sauvegarder avant toute modification d'un fichier existant.
- Lancer les regressions ciblees et le scan anti-fuite.
- Integrer automatiquement seulement si la decision est GO_PREPARE_LAYER.
- Garder toute action sensible en HOLD_MANUAL.
