# Chantier pc_runtime_openwebui - couche 958

Decision: GO_PREPARE_LAYER
Scope: jarvis_core
Jarvis core candidate: True
Future connector candidate: False
External project not blocked: False
Mode: local_runtime_health_layers
Integration: window control and local OpenWebUI guard
Focus: Keep local runtime and window commands non intrusive, especially before gaming pauses; keep parallel automation prompts in standby with names/counts only.
Action: Prepare a small local layer, backup touched files, run targeted tests, then report. Keep atelier HOLD as manual follow-up; no runtime start/kill. Recent local reports already cover this track; choose a distinct micro-layer or run verification only if no new safe integration is obvious.
Atelier return state: HOLD
Atelier return path: parallel_work\jarvis_parallel_discussions\returns\atelier06_pc_runtime_openwebui_return.md
Atelier manual follow-up: True
Atelier follow-up reason: runtime_manual_recovery_handoff
Atelier dry-run handoff: True
Atelier no auto start/kill: True

Rapports locaux recents:
- 2026-06-09 17:14:40 rapport_big_layer_pc_runtime_decision_card_20260609_1715.txt
- 2026-06-09 14:49:10 rapport_couche958_pc_runtime_openwebui_startup_return_standby_alias_relay_parking_complete_20260609_1448.txt
- 2026-06-09 14:33:46 rapport_couche958_pc_runtime_openwebui_central_readiness_standby_alias_relay_parking_complete_20260609_1434.txt
- 2026-06-09 14:17:35 rapport_couche958_pc_runtime_openwebui_frontend_bridge_standby_alias_relay_payload_parking_complete_20260609_1418.txt
- 2026-06-09 14:00:17 rapport_couche958_pc_runtime_openwebui_frontend_bridge_standby_alias_relay_parking_complete_summary_20260609_1401.txt
- consigne: choisir une micro-couche distincte deja non couverte, sinon verification uniquement

Garde-fous:
- local_only
- no_focus_change_during_pause
- manual_confirmation_for_sensitive_window_actions
- no_docker_or_port_change_without_reason
- heartbeat_pause_when_mouss_uses_pc

Regressions a privilegier:
- jarvis_window_control_center_regression.py
- jarvis_openwebui_local_guard_regression.py
- jarvis_runtime_watchdog_regression.py
- jarvis_recent_artifact_secret_scan_regression.py
- jarvis_secret_scan_policy_draft_regression.py
- jarvis_heartbeat_non_intrusive_policy_regression.py
- jarvis_heartbeat_non_intrusive_status_regression.py
- jarvis_operational_local_status_regression.py
- jarvis_parallel_automation_prompts_status_regression.py

Modules candidats:
- jarvis_window_control_center.py
- jarvis_openwebui_local_guard.py
- jarvis_runtime_watchdog.py
- config/jarvis_heartbeat_non_intrusive_policy.json
- jarvis_heartbeat_non_intrusive_status.py
- jarvis_operational_local_status.py
- jarvis_parallel_automation_prompts_status.py

Variables ou artefacts de configuration a verifier:
- OPENWEBUI_API_KEY
- OPENWEBUI_MODEL

Regle d'integration:
- Sauvegarder avant toute modification d'un fichier existant.
- Lancer les regressions ciblees et le scan anti-fuite.
- Integrer automatiquement seulement si la decision est GO_PREPARE_LAYER.
- Garder toute action sensible en HOLD_MANUAL.
