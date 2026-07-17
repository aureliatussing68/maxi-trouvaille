# Chantier ai_orchestration - couche 958

Decision: HOLD_WORKER_REVIEW
Scope: jarvis_core
Jarvis core candidate: True
Future connector candidate: False
External project not blocked: False
Mode: provider_inventory_and_router_layers
Integration: brain link and AI control center
Focus: Keep OpenWebUI as central dispatcher and propagate the IA/tool routing snapshot across HUD packet, frontend bridge/UI, toolbox, startup and return briefs before any live model call.
Action: Keep the worker packet in HOLD review; do not integrate automatically.
Worker: agent_ai_orchestration
Worker phase: HOLD_REVIEW
Worker state: HOLD
Worker latest: parallel_work/agent_ai_orchestration/provider_alias_orchestration_regression_report.txt
Atelier return state: GO
Atelier return path: parallel_work\jarvis_parallel_discussions\returns\atelier03_layer002_return.md
Atelier manual follow-up: False
Atelier follow-up reason: 
Atelier dry-run handoff: False
Atelier no auto start/kill: False

Rapports locaux recents:
- 2026-06-09 18:03:33 rapport_big_layer_brain_constellation_20260609_1805.txt
- 2026-06-09 16:33:39 rapport_big_layer_brain_graph_tool_route_20260609_1633.txt
- 2026-06-09 16:25:30 rapport_big_layer_brain_graph_presence_briefs_20260609_1625.txt
- 2026-06-09 16:10:42 rapport_big_layer_brain_graph_cockpit_20260609_1610.txt
- 2026-06-09 15:59:09 rapport_big_layer_brain_connection_graph_20260609_1559.txt

Garde-fous:
- no_secret_values
- no_paid_api_call_without_manual_validation
- openwebui_local_only
- provider_activation_must_be_explicit
- routing_snapshot_no_credit
- codex_handoff_controlled

Regressions a privilegier:
- jarvis_ai_control_center_regression.py
- jarvis_ai_routing_advice_regression.py
- jarvis_ai_tools_integration_status_regression.py
- jarvis_central_brain_toolbox_regression.py
- jarvis_runtime_hud_ready_packet_regression.py
- jarvis_runtime_hud_frontend_bridge_regression.py
- jarvis_runtime_hud_frontend_ui_contract_regression.py
- jarvis_startup_ready_brief_regression.py
- jarvis_return_brief_regression.py
- jarvis_ai_providers_fast_status_regression.py
- jarvis_brain_link_regression.py
- jarvis_codex_interface_panel_regression.py
- jarvis_recent_artifact_secret_scan_regression.py

Modules candidats:
- jarvis_ai_control_center.py
- jarvis_ai_routing_advice.py
- jarvis_ai_tools_integration_status.py
- jarvis_ai_providers_fast_status.py
- jarvis_central_brain_toolbox.py
- jarvis_runtime_hud_ready_packet.py
- jarvis_runtime_hud_frontend_bridge.py
- frontend/index.html
- frontend/src/main.ts
- frontend/src/style.css
- jarvis_startup_ready_brief.py
- jarvis_return_brief.py
- jarvis_brain_link.py
- jarvis_codex_interface_panel.py
- openwebui_bridge.py

Variables ou artefacts de configuration a verifier:
- OPENWEBUI_URL
- OPENWEBUI_API_KEY
- OPENWEBUI_MODEL
- OPENWEBUI_TIMEOUT
- OPENWEBUI_HEALTH_TIMEOUT
- OPENWEBUI_ENABLED
- OPENWEBUI_CHAT_COMPLETIONS_PATH
- OPENWEBUI_MODEL_ATTEMPTS
- OPENWEBUI_MODEL_COOLDOWN_SECONDS
- JARVIS_DIRECT_AI_FALLBACK
- OPENAI_API_KEY
- OPENAI_URL
- OPENAI_MODEL
- ANTHROPIC_API_KEY
- ANTHROPIC_URL
- GEMINI_API_KEY
- GEMINI_URL
- GEMINI_MODEL
- GROQ_API_KEY
- GROQ_URL
- XAI_API_KEY
- XAI_URL
- MISTRAL_API_KEY
- MISTRAL_URL
- MISTRAL_MODEL
- MISTRAL_ENABLED
- MISTRAL_TIMEOUT
- OLLAMA_URL
- OPENCLAW_ENABLED
- OPENCLAW_BASE_URL
- OPENCLAW_API_KEY
- OPENCLAW_MODE
- OPENCLAW_REQUIRE_CONFIRMATION
- OPENCLAW_TIMEOUT

Regle d'integration:
- Sauvegarder avant toute modification d'un fichier existant.
- Lancer les regressions ciblees et le scan anti-fuite.
- Integrer automatiquement seulement si la decision est GO_PREPARE_LAYER.
- Garder toute action sensible en HOLD_MANUAL.
