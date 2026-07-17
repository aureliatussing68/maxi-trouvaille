# Chantier marketing_automation_mail - couche 958

Decision: HOLD_MANUAL
Scope: future_connector
Jarvis core candidate: False
Future connector candidate: True
External project not blocked: True
Mode: draft_only_growth_layers
Integration: business drafts, mail drafts, social drafts, ad drafts, content calendar
Focus: Prepare revenue workstreams: mail drafts, TikTok and social drafts, ad drafts, product briefs, and follow-up queues.
Action: Prepare a draft packet and wait for Mouss validation.
Worker: agent_marketing_automation
Worker phase: HOLD_REVIEW
Worker state: HOLD
Worker latest: parallel_work/agent_marketing_automation/guardrails_marketing_automation.md

Garde-fous:
- draft_only
- no_email_send_without_manual_validation
- no_publication
- no_paid_ads_launch
- no_account_change
- human_validation_required

Regressions a privilegier:
- jarvis_business_ads_preview_regression.py
- jarvis_business_ads_script_export_regression.py
- jarvis_business_validation_queue_regression.py
- jarvis_recent_artifact_secret_scan_regression.py

Modules candidats:
- google_services.py
- jarvis_business_ads_preview.py
- jarvis_business_ads_script_export.py
- jarvis_business_validation_queue.py

Variables ou artefacts de configuration a verifier:
- GOOGLE_OAUTH_CLIENT_FILE
- GOOGLE_DRIVE_SCOPES
- TIKTOK_CLIENT_KEY
- TIKTOK_CLIENT_SECRET
- META_APP_ID
- META_APP_SECRET
- META_ACCESS_TOKEN
- FACEBOOK_PAGE_ID
- INSTAGRAM_BUSINESS_ACCOUNT_ID
- LINKEDIN_CLIENT_ID
- LINKEDIN_CLIENT_SECRET
- SNAPCHAT_CLIENT_ID
- SNAPCHAT_CLIENT_SECRET
- PINTEREST_APP_ID
- PINTEREST_APP_SECRET
- SERPAPI_API_KEY
- YOUTUBE_API_KEY
- GOOGLE_ADS_DEVELOPER_TOKEN

Regle d'integration:
- Sauvegarder avant toute modification d'un fichier existant.
- Lancer les regressions ciblees et le scan anti-fuite.
- Integrer automatiquement seulement si la decision est GO_PREPARE_LAYER.
- Garder toute action sensible en HOLD_MANUAL.
