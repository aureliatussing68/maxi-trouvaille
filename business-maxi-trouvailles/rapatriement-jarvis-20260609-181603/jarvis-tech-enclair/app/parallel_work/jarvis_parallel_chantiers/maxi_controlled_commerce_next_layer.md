# Chantier maxi_controlled_commerce - couche 958

Decision: HOLD_MANUAL
Scope: future_connector
Jarvis core candidate: False
Future connector candidate: True
External project not blocked: True
Mode: draft_only_business_layers
Integration: business gates and Maxi workspace
Focus: Improve product display, search drafts, and selection packets without buying or publishing.
Action: Prepare a draft packet and wait for Mouss validation.

Garde-fous:
- no_payment
- no_order
- no_publication
- no_account_change
- human_validation_required

Regressions a privilegier:
- jarvis_business_safe_next_step_regression.py
- jarvis_business_execution_guard_regression.py
- jarvis_business_search_gate_regression.py
- jarvis_recent_artifact_secret_scan_regression.py

Modules candidats:
- jarvis_business_safe_next_step.py
- jarvis_business_search_gate.py
- maxi_browser_controller.py

Variables ou artefacts de configuration a verifier:
- ALIEXPRESS_APP_KEY
- ALIEXPRESS_APP_SECRET
- ALIEXPRESS_TRACKING_ID

Regle d'integration:
- Sauvegarder avant toute modification d'un fichier existant.
- Lancer les regressions ciblees et le scan anti-fuite.
- Integrer automatiquement seulement si la decision est GO_PREPARE_LAYER.
- Garder toute action sensible en HOLD_MANUAL.
