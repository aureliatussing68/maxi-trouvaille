# Chantier voice_reactivity - couche 958

Decision: HOLD_INTEGRATED
Scope: jarvis_core
Jarvis core candidate: True
Future connector candidate: False
External project not blocked: False
Mode: readiness_and_latency_layers
Integration: voice control center and runtime logs
Focus: Shorten diagnosis loops and keep Bluetooth silence expected when the mic is manually cut.
Action: Skip this already integrated worker packet and wait for a newer GO.
Worker: agent_voice_reactivity
Worker phase: INTEGRATED_REVIEWED
Worker state: INTEGRATED
Worker latest: parallel_work/agent_voice_reactivity/central_review_voice_reactivity_integrated_20260603_1348.md

Rapports locaux recents:
- 2026-06-09 16:50:18 rapport_big_layer_hud_topology_voice_silence_20260609_1650.txt

Garde-fous:
- no_forced_micro_toggle
- no_unrequested_audio_capture
- silence_can_be_expected
- logs_must_be_redacted

Regressions a privilegier:
- jarvis_voice_control_center_regression.py
- jarvis_voice_silence_watchdog_regression.py
- jarvis_multimodal_toolkit_status_regression.py
- jarvis_recent_artifact_secret_scan_regression.py

Modules candidats:
- jarvis_voice_control_center.py
- voice_pipeline.py
- audio_device_manager.py
- jarvis_multimodal_toolkit_status.py

Variables ou artefacts de configuration a verifier:
- aucune

Regle d'integration:
- Sauvegarder avant toute modification d'un fichier existant.
- Lancer les regressions ciblees et le scan anti-fuite.
- Integrer automatiquement seulement si la decision est GO_PREPARE_LAYER.
- Garder toute action sensible en HOLD_MANUAL.
