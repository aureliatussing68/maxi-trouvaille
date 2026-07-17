# Chantier avatar_3d_mimouss - couche 958

Decision: HOLD_MANUAL
Scope: jarvis_preview
Jarvis core candidate: False
Future connector candidate: False
External project not blocked: False
Mode: parked_preview_feature_flag
Integration: frontend avatar preview module
Focus: Keep the existing avatar 3D preview stored behind feature flag; do not spend priority cycles on visual polish until Jarvis is operational.
Action: Prepare a small local layer, backup touched files, run targeted tests, then report.
Atelier return state: GO
Atelier return path: parallel_work\jarvis_parallel_discussions\returns\atelier01_avatar_3d_preview_state_contract.md
Atelier manual follow-up: False
Atelier follow-up reason: 
Atelier dry-run handoff: False
Atelier no auto start/kill: False

Garde-fous:
- preview_only
- feature_flag_or_manual_gate
- no_replacement_of_active_ui
- no_video_path_exposure

Regressions a privilegier:
- jarvis_mimouss_avatar_3d_gesture_cue_preset_gate_regression.py
- jarvis_recent_artifact_secret_scan_regression.py

Modules candidats:
- frontend/src/mimouss_avatar_3d_procedural.ts
- frontend/src/mimouss_avatar_3d_preview.ts
- frontend/src/mimouss_avatar_3d_preview_page.ts

Variables ou artefacts de configuration a verifier:
- aucune

Regle d'integration:
- Sauvegarder avant toute modification d'un fichier existant.
- Lancer les regressions ciblees et le scan anti-fuite.
- Integrer automatiquement seulement si la decision est GO_PREPARE_LAYER.
- Garder toute action sensible en HOLD_MANUAL.
