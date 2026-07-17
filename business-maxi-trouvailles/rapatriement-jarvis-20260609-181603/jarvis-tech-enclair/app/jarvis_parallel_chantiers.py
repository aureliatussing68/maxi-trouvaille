from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any

from jarvis_parallel_discussion_inbox import run_parallel_discussion_inbox
from jarvis_safety_guard import sanitize_payload, scrub_text


APP_DIR = Path(__file__).resolve().parent
CONFIG_PATH = APP_DIR / "config" / "jarvis_parallel_chantiers.json"
LOG_DIR = APP_DIR / "logs"
PACKET_DIR = APP_DIR / "parallel_work" / "jarvis_parallel_chantiers"
JSON_PATH = LOG_DIR / "jarvis_parallel_chantiers.json"
TXT_PATH = LOG_DIR / "jarvis_parallel_chantiers.txt"
WORKER_SUPERVISOR_BOARD_JSON_PATH = APP_DIR / "parallel_work" / "agent_supervisor" / "parallel_worker_status_board.json"
TRACK_WORKER_IDS = {
    "voice_reactivity": "agent_voice_reactivity",
    "ai_orchestration": "agent_ai_orchestration",
    "marketing_automation_mail": "agent_marketing_automation",
}
JARVIS_CORE_TRACK_IDS = {"voice_reactivity", "ai_orchestration", "pc_runtime_openwebui"}
JARVIS_PREVIEW_TRACK_IDS = {"avatar_3d_mimouss", "vision_camera_gesture"}
FUTURE_CONNECTOR_TRACK_IDS = {
    "maxi_controlled_commerce",
    "marketing_automation_mail",
    "social_desktop_apps",
    "spotify_media_assist",
}
FUTURE_EXTERNAL_CONNECTORS = {
    "maxi_trouvailles": {
        "label": "Maxi Trouvailles",
        "owner_scope": "external_workspace_owned_by_its_parallel_threads",
        "jarvis_mode": "future_connector_intake_after_core_ready",
        "track_ids": [
            "maxi_controlled_commerce",
            "marketing_automation_mail",
            "social_desktop_apps",
        ],
    },
    "roblox": {
        "label": "Roblox",
        "owner_scope": "external_workspace_owned_by_its_parallel_threads",
        "jarvis_mode": "future_connector_intake_after_core_ready",
        "track_ids": [],
    },
}

REPORT_RE = re.compile(r"rapport_step(?P<step>\d+)_", re.I)
SECRET_MARKERS = ("sk-", "sk_", "sk-ant-", "xai-", "AIza", "gsk_", "Bearer ", "-----BEGIN")
MAX_SHORT_MESSAGE_CHARS = 220
LOCAL_REPORT_LIMIT = 24
TRACK_REPORT_LIMIT = 5


def _load_config() -> dict[str, Any]:
    data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def _load_worker_supervisor_board() -> dict[str, Any]:
    if not WORKER_SUPERVISOR_BOARD_JSON_PATH.exists():
        return {}
    try:
        data = json.loads(WORKER_SUPERVISOR_BOARD_JSON_PATH.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _latest_step() -> int:
    latest = 0
    if not LOG_DIR.exists():
        return 0
    for path in LOG_DIR.glob("rapport_step*.txt"):
        match = REPORT_RE.search(path.name)
        if match:
            latest = max(latest, int(match.group("step")))
    return latest


def _report_track_id(name: str) -> str:
    lower = name.lower()
    if any(
        token in lower
        for token in (
            "watchdog",
            "pc_runtime",
            "openwebui",
            "window",
            "fenetre",
            "runtime_restart",
            "runtime_manual",
            "runtime_reprise",
            "startup_return",
            "core_reprise",
            "operational_status",
            "gaming_pause",
            "pause_gaming",
            "secret_policy",
            "secret_scan_policy",
            "secret_hygiene",
            "parallel_chantiers_policy",
            "heartbeat_non_intrusive",
            "non_intrusive_policy",
            "anti_fuite",
            "anti-fuite",
        )
    ):
        return "pc_runtime_openwebui"
    if any(token in lower for token in ("voice", "micro", "audio", "vocal", "silence", "multimodal_toolkit", "multimodal_command")):
        return "voice_reactivity"
    if any(
        token in lower
        for token in (
            "ai_orchestration",
            "ai_routing",
            "ai_tools",
            "ia_",
            "provider",
            "toolbox",
            "brain",
            "routing",
            "codex_interface",
            "codex_bridge",
        )
    ):
        return "ai_orchestration"
    if "avatar" in lower or "mimouss" in lower:
        return "avatar_3d_mimouss"
    if any(token in lower for token in ("business", "maxi", "aliexpress", "commerce")):
        return "maxi_controlled_commerce"
    if any(token in lower for token in ("marketing", "mail", "ads", "social")):
        return "marketing_automation_mail"
    if any(token in lower for token in ("desktop", "shortcut")):
        return "social_desktop_apps"
    if any(token in lower for token in ("vision", "camera", "gesture")):
        return "vision_camera_gesture"
    if "spotify" in lower or "media" in lower:
        return "spotify_media_assist"
    return "general"


def _local_integration_reports() -> list[dict[str, Any]]:
    if not LOG_DIR.exists():
        return []
    reports: list[dict[str, Any]] = []
    for path in LOG_DIR.glob("rapport_*.txt"):
        try:
            stat = path.stat()
        except OSError:
            continue
        reports.append(
            {
                "name": _clip(path.name, 160),
                "path": _clip(f"logs/{path.name}", 200),
                "track_id": _report_track_id(path.name),
                "mtime": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime)),
            }
        )
    reports.sort(key=lambda item: str(item.get("mtime") or ""), reverse=True)
    return reports[:LOCAL_REPORT_LIMIT]


def _local_reports_by_track(reports: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for report in reports:
        track_id = str(report.get("track_id") or "general")
        grouped.setdefault(track_id, [])
        if len(grouped[track_id]) < TRACK_REPORT_LIMIT:
            grouped[track_id].append(report)
    return grouped


def _track_scope_class(track_id: str) -> str:
    if track_id in JARVIS_CORE_TRACK_IDS:
        return "jarvis_core"
    if track_id in JARVIS_PREVIEW_TRACK_IDS:
        return "jarvis_preview"
    if track_id in FUTURE_CONNECTOR_TRACK_IDS:
        return "future_connector"
    return "jarvis_review"


def _project_scope_policy(packets: list[dict[str, Any]]) -> dict[str, Any]:
    track_ids = [str(packet.get("id") or "") for packet in packets if isinstance(packet, dict)]
    core_track_ids = [track_id for track_id in track_ids if track_id in JARVIS_CORE_TRACK_IDS]
    preview_track_ids = [track_id for track_id in track_ids if track_id in JARVIS_PREVIEW_TRACK_IDS]
    future_connector_track_ids = [
        track_id for track_id in track_ids if track_id in FUTURE_CONNECTOR_TRACK_IDS
    ]
    external_connector_tracks = [
        {
            "id": str(packet.get("id") or ""),
            "decision": str(packet.get("decision") or ""),
            "sensitive": packet.get("sensitive") is True,
            "manual_gate": packet.get("manual_gate") is True,
            "external_project_not_blocked": True,
            "jarvis_integration_now": False,
            "jarvis_future_connector_candidate": True,
        }
        for packet in packets
        if isinstance(packet, dict) and str(packet.get("id") or "") in FUTURE_CONNECTOR_TRACK_IDS
    ]
    connectors = {
        connector_id: {
            **connector,
            "jarvis_integration_now": False,
            "external_project_not_blocked": True,
            "requires_future_connector_contract": True,
            "requires_manual_validation_before_jarvis_integration": True,
        }
        for connector_id, connector in FUTURE_EXTERNAL_CONNECTORS.items()
    }
    return {
        "schema": "jarvis.project_scope_policy.v1",
        "status": "JARVIS_CORE_OPERATIONAL_FIRST",
        "jarvis_current_scope": "jarvis_core_only",
        "core_must_be_operational_before_external_connectors": True,
        "core_track_ids": core_track_ids,
        "preview_track_ids": preview_track_ids,
        "future_connector_track_ids": future_connector_track_ids,
        "future_external_connectors": connectors,
        "external_connector_tracks": external_connector_tracks,
        "external_projects_not_blocked": True,
        "external_threads_may_rerapatriate_in_their_own_folders": True,
        "jarvis_does_not_scan_or_modify_external_workspaces": True,
        "jarvis_integration_requires_connector_contract": True,
        "roblox_registered_as_future_connector_placeholder": True,
        "maxi_registered_as_future_connector_candidate": True,
        "short_message": "Jarvis core d'abord; Maxi/Roblox libres dans leurs dossiers, connecteurs futurs seulement.",
        "safety": {
            "read_only_scope_policy": True,
            "no_external_workspace_write": True,
            "no_cross_project_integration": True,
            "no_block_external_threads": True,
            "no_payment": True,
            "no_order": True,
            "no_publication": True,
            "no_account_login": True,
            "no_secret_values": True,
            "manual_validation_for_connector_intake": True,
        },
    }


def _clip(text: Any, limit: int = MAX_SHORT_MESSAGE_CHARS) -> str:
    clean = " ".join(scrub_text(str(text or "")).split())
    if len(clean) <= limit:
        return clean
    return clean[: max(0, limit - 3)].rstrip() + "..."


def _worker_summary(worker: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _clip(worker.get("id"), 120),
        "phase": _clip(worker.get("phase"), 120),
        "state": _clip(worker.get("state"), 80),
        "latest_report": _clip(worker.get("latest_report"), 180),
        "sensitive": bool(worker.get("sensitive")),
        "file_count": int(worker.get("file_count") or 0),
        "flagged_count": int(worker.get("flagged_count") or 0),
    }


def _workers_by_track(board: dict[str, Any]) -> dict[str, dict[str, Any]]:
    workers = board.get("workers") if isinstance(board.get("workers"), list) else []
    by_worker = {
        str(worker.get("id") or ""): _worker_summary(worker)
        for worker in workers
        if isinstance(worker, dict) and worker.get("id")
    }
    return {
        track_id: by_worker[worker_id]
        for track_id, worker_id in TRACK_WORKER_IDS.items()
        if worker_id in by_worker
    }


def _atelier_return_summary(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "track_id": _clip(row.get("track_id"), 120),
        "return_state": _clip(row.get("return_state"), 80),
        "return_path": _clip(row.get("return_path"), 180),
        "needs_central_review": bool(row.get("needs_central_review")),
        "manual_followup_required": bool(row.get("manual_followup_required")),
        "manual_followup_reason": _clip(row.get("manual_followup_reason"), 120),
        "dry_run_handoff": bool(row.get("dry_run_handoff")),
        "no_auto_start_kill": bool(row.get("no_auto_start_kill")),
    }


def _atelier_returns_by_track(inbox: dict[str, Any]) -> dict[str, dict[str, Any]]:
    rows = inbox.get("rows") if isinstance(inbox.get("rows"), list) else []
    return {
        str(row.get("track_id") or ""): _atelier_return_summary(row)
        for row in rows
        if isinstance(row, dict) and row.get("track_id") and row.get("return_state") != "WAITING"
    }


def _discussion_inbox_summary(inbox: dict[str, Any]) -> dict[str, Any]:
    manual_followups = (
        inbox.get("manual_followups")
        if isinstance(inbox.get("manual_followups"), list)
        else []
    )
    return {
        "available": bool(inbox),
        "ok": inbox.get("ok") is True,
        "return_count": int(inbox.get("return_count") or 0),
        "actionable_count": int(inbox.get("actionable_count") or 0),
        "hold_count": int(inbox.get("hold_count") or 0),
        "manual_followup_count": int(inbox.get("manual_followup_count") or 0),
        "waiting_count": int(inbox.get("waiting_count") or 0),
        "flagged_count": int(inbox.get("flagged_count") or 0),
        "short_message": _clip(inbox.get("short_message"), 180),
        "manual_followups": [
            _atelier_return_summary(item)
            for item in manual_followups
            if isinstance(item, dict)
        ],
        "safety": {
            "read_only_except_template": True,
            "no_secret_values": True,
            "no_integration": True,
            "manual_review_for_go_stop": True,
            "manual_review_for_hold_handoff": True,
            "no_automatic_integration_for_hold": True,
        },
    }


def _safe_track(track: dict[str, Any]) -> dict[str, Any]:
    safe = sanitize_payload(track)
    safe["auto_integrate"] = bool(track.get("auto_integrate")) and not bool(track.get("sensitive"))
    safe["manual_gate"] = bool(track.get("manual_gate")) or bool(track.get("sensitive"))
    safe["cadence_minutes"] = int(track.get("cadence_minutes") or 5)
    safe["priority"] = int(track.get("priority") or 99)
    return safe


def _decision(track: dict[str, Any], policy: dict[str, Any], worker: dict[str, Any] | None = None) -> str:
    status = str(track.get("status") or "").lower()
    if bool(track.get("sensitive")) or bool(track.get("manual_gate")) or status.startswith("parked"):
        return "HOLD_MANUAL"
    worker = worker or {}
    if int(worker.get("flagged_count") or 0) > 0:
        return "HOLD_WORKER_FLAGGED"
    worker_phase = str(worker.get("phase") or "").upper()
    if worker_phase == "INTEGRATED_REVIEWED":
        return "HOLD_INTEGRATED"
    if worker_phase == "HOLD_REVIEW":
        return "HOLD_WORKER_REVIEW"
    if worker_phase == "STOP_REVIEW":
        return "HOLD_WORKER_STOP"
    if not bool(policy.get("requires_green_tests", True)):
        return "HOLD_POLICY"
    if not bool(policy.get("requires_secret_scan", True)):
        return "HOLD_SECRET_SCAN_POLICY"
    return "GO_PREPARE_LAYER"


def _track_packet(
    track: dict[str, Any],
    global_next_step: int,
    policy: dict[str, Any],
    worker: dict[str, Any] | None = None,
    atelier_return: dict[str, Any] | None = None,
    recent_local_reports: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    worker = worker or {}
    atelier_return = atelier_return or {}
    recent_local_reports = recent_local_reports or []
    decision = _decision(track, policy, worker)
    guardrails = [str(item) for item in track.get("guardrails") or []]
    regressions = [str(item) for item in track.get("regressions") or []]
    modules = [str(item) for item in track.get("existing_modules") or []]
    required_env = [str(item) for item in track.get("required_env") or []]
    sensitive = bool(track.get("sensitive"))
    can_auto_integrate = bool(track.get("auto_integrate")) and decision == "GO_PREPARE_LAYER" and not sensitive
    next_layer_id = f"{global_next_step}_{track.get('id')}"
    next_action = (
        {
            "HOLD_INTEGRATED": "Skip this already integrated worker packet and wait for a newer GO.",
            "HOLD_WORKER_REVIEW": "Keep the worker packet in HOLD review; do not integrate automatically.",
            "HOLD_WORKER_STOP": "Review the STOP worker packet manually before any integration.",
            "HOLD_WORKER_FLAGGED": "Review flagged worker output before any integration.",
        }.get(decision)
        or (
            "Prepare a draft packet and wait for Mouss validation."
            if sensitive
            else "Prepare a small local layer, backup touched files, run targeted tests, then report."
        )
    )
    if atelier_return.get("manual_followup_required") is True:
        next_action = (
            f"{next_action} Keep atelier HOLD as manual follow-up; no runtime start/kill."
        )
    if decision == "GO_PREPARE_LAYER" and recent_local_reports:
        next_action = (
            f"{next_action} Recent local reports already cover this track; choose a distinct "
            "micro-layer or run verification only if no new safe integration is obvious."
        )
    return {
        "id": track.get("id"),
        "label": track.get("label"),
        "scope_class": _track_scope_class(str(track.get("id") or "")),
        "jarvis_core_integration_candidate": str(track.get("id") or "") in JARVIS_CORE_TRACK_IDS,
        "jarvis_future_connector_candidate": str(track.get("id") or "") in FUTURE_CONNECTOR_TRACK_IDS,
        "external_project_not_blocked": str(track.get("id") or "") in FUTURE_CONNECTOR_TRACK_IDS,
        "priority": track.get("priority"),
        "status": track.get("status"),
        "cadence_minutes": track.get("cadence_minutes"),
        "work_mode": track.get("work_mode"),
        "integration_target": track.get("integration_target"),
        "sensitive": sensitive,
        "manual_gate": bool(track.get("manual_gate")),
        "auto_integrate_allowed": can_auto_integrate,
        "decision": decision,
        "next_layer_id": next_layer_id,
        "next_focus": _clip(track.get("next_focus")),
        "next_action": next_action,
        "guardrails": guardrails,
        "regressions": regressions,
        "existing_modules": modules,
        "required_env": required_env,
        "packet_path": f"parallel_work/jarvis_parallel_chantiers/{track.get('id')}_next_layer.md",
        "worker": worker,
        "atelier_return": atelier_return,
        "recent_local_reports": recent_local_reports[:TRACK_REPORT_LIMIT],
        "recent_local_report_count": len(recent_local_reports),
        "distinct_local_layer_required": decision == "GO_PREPARE_LAYER" and bool(recent_local_reports),
        "safety": {
            "no_secret_values": True,
            "backup_before_patch": True,
            "tests_after_layer": True,
            "manual_validation_for_sensitive_actions": sensitive,
            "no_paid_api_call_without_manual_validation": True,
            "no_payment": True,
            "no_order": True,
            "no_publication": True,
            "uses_parallel_discussion_inbox_overlay": True,
            "uses_recent_local_report_memory": True,
            "recent_local_reports_filenames_only": True,
            "distinct_layer_after_recent_reports": decision == "GO_PREPARE_LAYER" and bool(recent_local_reports),
            "atelier_hold_manual_followup_only": True,
            "no_automatic_integration_for_atelier_hold": True,
            "scope_policy_respected": True,
            "no_cross_project_integration": True,
            "external_project_not_blocked": str(track.get("id") or "") in FUTURE_CONNECTOR_TRACK_IDS,
        },
    }


def _sort_tracks(tracks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(tracks, key=lambda item: int(item.get("priority") or 99))


def _choose_focus(packets: list[dict[str, Any]]) -> dict[str, Any]:
    for packet in packets:
        if packet.get("decision") == "GO_PREPARE_LAYER":
            return packet
    return packets[0] if packets else {}


def _packet_markdown(packet: dict[str, Any], global_next_step: int) -> str:
    worker = packet.get("worker") if isinstance(packet.get("worker"), dict) else {}
    lines = [
        f"# Chantier {packet.get('id')} - couche {global_next_step}",
        "",
        f"Decision: {packet.get('decision')}",
        f"Scope: {packet.get('scope_class', '')}",
        f"Jarvis core candidate: {packet.get('jarvis_core_integration_candidate', False)}",
        f"Future connector candidate: {packet.get('jarvis_future_connector_candidate', False)}",
        f"External project not blocked: {packet.get('external_project_not_blocked', False)}",
        f"Mode: {packet.get('work_mode')}",
        f"Integration: {packet.get('integration_target')}",
        f"Focus: {packet.get('next_focus')}",
        f"Action: {packet.get('next_action')}",
    ]
    if worker:
        lines.extend(
            [
                f"Worker: {worker.get('id', '')}",
                f"Worker phase: {worker.get('phase', '')}",
                f"Worker state: {worker.get('state', '')}",
                f"Worker latest: {worker.get('latest_report', '')}",
            ]
        )
    atelier_return = packet.get("atelier_return") if isinstance(packet.get("atelier_return"), dict) else {}
    if atelier_return:
        lines.extend(
            [
                f"Atelier return state: {atelier_return.get('return_state', '')}",
                f"Atelier return path: {atelier_return.get('return_path', '')}",
                f"Atelier manual follow-up: {atelier_return.get('manual_followup_required')}",
                f"Atelier follow-up reason: {atelier_return.get('manual_followup_reason', '')}",
                f"Atelier dry-run handoff: {atelier_return.get('dry_run_handoff')}",
                f"Atelier no auto start/kill: {atelier_return.get('no_auto_start_kill')}",
            ]
        )
    recent_reports = packet.get("recent_local_reports") if isinstance(packet.get("recent_local_reports"), list) else []
    if recent_reports:
        lines.extend(["", "Rapports locaux recents:"])
        for report in recent_reports:
            lines.append(f"- {report.get('mtime', '')} {report.get('name', '')}")
        if packet.get("distinct_local_layer_required"):
            lines.append(
                "- consigne: choisir une micro-couche distincte deja non couverte, sinon verification uniquement"
            )
    lines.extend(["", "Garde-fous:"])
    for item in packet.get("guardrails") or []:
        lines.append(f"- {item}")
    lines.extend(["", "Regressions a privilegier:"])
    for item in packet.get("regressions") or []:
        lines.append(f"- {item}")
    lines.extend(["", "Modules candidats:"])
    for item in packet.get("existing_modules") or []:
        lines.append(f"- {item}")
    required_env = packet.get("required_env") or []
    lines.extend(["", "Variables ou artefacts de configuration a verifier:"])
    if required_env:
        for item in required_env:
            lines.append(f"- {item}")
    else:
        lines.append("- aucune")
    lines.extend(
        [
            "",
            "Regle d'integration:",
            "- Sauvegarder avant toute modification d'un fichier existant.",
            "- Lancer les regressions ciblees et le scan anti-fuite.",
            "- Integrer automatiquement seulement si la decision est GO_PREPARE_LAYER.",
            "- Garder toute action sensible en HOLD_MANUAL.",
            "",
        ]
    )
    return "\n".join(lines)


def _write_packets(packets: list[dict[str, Any]], global_next_step: int) -> None:
    PACKET_DIR.mkdir(parents=True, exist_ok=True)
    for packet in packets:
        path = PACKET_DIR / f"{packet.get('id')}_next_layer.md"
        path.write_text(_packet_markdown(packet, global_next_step), encoding="utf-8")


def _secret_free_text(text: str) -> bool:
    return all(marker not in text for marker in SECRET_MARKERS)


def build_parallel_chantiers_status(track_filter: str = "", write_packets: bool = True) -> dict[str, Any]:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    config = _load_config()
    worker_board = _load_worker_supervisor_board()
    discussion_inbox_raw = run_parallel_discussion_inbox()
    discussion_inbox = _discussion_inbox_summary(discussion_inbox_raw)
    workers_by_track = _workers_by_track(worker_board)
    atelier_returns_by_track = _atelier_returns_by_track(discussion_inbox_raw)
    policy = config.get("integration_policy") if isinstance(config.get("integration_policy"), dict) else {}
    latest_step = _latest_step()
    global_next_step = latest_step + 1
    local_reports = _local_integration_reports()
    local_reports_by_track = _local_reports_by_track(local_reports)
    raw_tracks = config.get("tracks") if isinstance(config.get("tracks"), list) else []
    tracks = [_safe_track(track) for track in raw_tracks if isinstance(track, dict)]
    if track_filter:
        tracks = [track for track in tracks if str(track.get("id")) == track_filter]
    tracks = _sort_tracks(tracks)
    packets = [
        _track_packet(
            track,
            global_next_step,
            policy,
            workers_by_track.get(str(track.get("id") or "")),
            atelier_returns_by_track.get(str(track.get("id") or "")),
            local_reports_by_track.get(str(track.get("id") or ""), []),
        )
        for track in tracks
    ]
    if write_packets:
        _write_packets(packets, global_next_step)
    focus = _choose_focus(packets)
    sensitive_holds = [packet for packet in packets if packet.get("decision") == "HOLD_MANUAL"]
    worker_holds = [packet for packet in packets if str(packet.get("decision") or "").startswith("HOLD_WORKER")]
    integrated_holds = [packet for packet in packets if packet.get("decision") == "HOLD_INTEGRATED"]
    go_packets = [packet for packet in packets if packet.get("decision") == "GO_PREPARE_LAYER"]
    project_scope_policy = _project_scope_policy(packets)
    credential_plan = sorted(
        {
            str(item)
            for packet in packets
            for item in (packet.get("required_env") or [])
            if str(item).strip()
        }
    )
    short_message = _clip(
        f"Multi-chantiers: {len(packets)} pistes, {len(go_packets)} GO, "
        f"{len(sensitive_holds)} HOLD manuel, {len(worker_holds)} HOLD worker, "
        f"{len(integrated_holds)} integre(s), {discussion_inbox.get('manual_followup_count', 0)} suivi manuel atelier. "
        f"Focus {focus.get('id', 'aucun')}. Scope Jarvis core; externes non bloques."
    )
    payload = {
        "checked_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "ok": bool(packets),
        "schema_version": config.get("schema_version"),
        "latest_step": latest_step,
        "next_step": global_next_step,
        "cadence_minutes": int(config.get("cadence_minutes") or 5),
        "track_count": len(packets),
        "go_count": len(go_packets),
        "manual_hold_count": len(sensitive_holds),
        "worker_hold_count": len(worker_holds),
        "integrated_count": len(integrated_holds),
        "atelier_return_count": discussion_inbox.get("return_count", 0),
        "atelier_actionable_count": discussion_inbox.get("actionable_count", 0),
        "atelier_hold_count": discussion_inbox.get("hold_count", 0),
        "atelier_manual_followup_count": discussion_inbox.get("manual_followup_count", 0),
        "recommended_track": focus.get("id", ""),
        "recommended_focus": focus.get("next_focus", ""),
        "short_message": short_message,
        "project_scope_policy": project_scope_policy,
        "credential_plan": credential_plan,
        "local_integration_reports": {
            "available": True,
            "count": len(local_reports),
            "latest": local_reports[:12],
            "by_track": local_reports_by_track,
            "safety": {
                "filenames_only": True,
                "no_report_content_read": True,
                "no_secret_values": True,
                "read_only_scan": True,
            },
        },
        "tracks": packets,
        "discussion_inbox": discussion_inbox,
        "paths": {
            "config": "config/jarvis_parallel_chantiers.json",
            "json": "logs/jarvis_parallel_chantiers.json",
            "txt": "logs/jarvis_parallel_chantiers.txt",
            "packets": "parallel_work/jarvis_parallel_chantiers",
            "worker_supervisor": "parallel_work/agent_supervisor/parallel_worker_status_board.json",
            "discussion_inbox": "logs/jarvis_parallel_discussion_inbox.json",
        },
        "packet_write_enabled": bool(write_packets),
        "status_only": not bool(write_packets),
        "safety": {
            "central_dispatcher": True,
            "no_background_autostart": True,
            "status_only_no_packet_write": not bool(write_packets),
            "no_secret_values": True,
            "no_payment": True,
            "no_order": True,
            "no_publication": True,
            "jarvis_core_first": True,
            "external_projects_not_blocked": True,
            "future_connectors_hold_until_core_ready": True,
            "no_external_workspace_write": True,
            "no_cross_project_integration": True,
            "sensitive_tracks_hold_manual": True,
            "requires_green_tests": bool(policy.get("requires_green_tests", True)),
            "requires_secret_scan": bool(policy.get("requires_secret_scan", True)),
            "uses_worker_supervisor_overlay": True,
            "worker_supervisor_read_only": True,
            "uses_parallel_discussion_inbox_overlay": True,
            "parallel_discussion_inbox_no_integration": True,
            "uses_recent_local_report_memory": True,
            "recent_local_reports_filenames_only": True,
            "recent_local_reports_no_content_read": True,
            "manual_review_for_atelier_hold_handoff": True,
            "no_automatic_integration_for_atelier_hold": True,
        },
    }
    safe = sanitize_payload(payload)
    text = format_parallel_chantiers_status(safe)
    if not _secret_free_text(text):
        safe["ok"] = False
        safe["status"] = "A_VERIFIER_SECRET_MARKER"
        text = format_parallel_chantiers_status(safe)
    JSON_PATH.write_text(json.dumps(safe, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    TXT_PATH.write_text(text, encoding="utf-8")
    return safe


def format_parallel_chantiers_status(payload: dict[str, Any]) -> str:
    lines = [
        f"Controle central multi-chantiers Jarvis - {payload.get('checked_at', '')}",
        "",
        f"Global: {'OK' if payload.get('ok') else 'A VERIFIER'}",
        f"Derniere couche globale: {payload.get('latest_step', 0)}",
        f"Prochaine couche globale: {payload.get('next_step', 0)}",
        f"Cadence demandee: {payload.get('cadence_minutes', 0)} min",
        f"Pistes: {payload.get('track_count', 0)}",
        f"GO: {payload.get('go_count', 0)}",
        f"HOLD manuel: {payload.get('manual_hold_count', 0)}",
        f"HOLD worker: {payload.get('worker_hold_count', 0)}",
        f"Integres: {payload.get('integrated_count', 0)}",
        f"Retours ateliers: {payload.get('atelier_return_count', 0)}",
        f"Ateliers a revoir: {payload.get('atelier_actionable_count', 0)}",
        f"HOLD ateliers: {payload.get('atelier_hold_count', 0)}",
        f"Suivi manuel ateliers: {payload.get('atelier_manual_followup_count', 0)}",
        f"Focus: {payload.get('recommended_track', '')}",
        f"Message court: {payload.get('short_message', '')}",
        f"Rapports locaux recents: {(payload.get('local_integration_reports') or {}).get('count', 0)}",
        "",
    ]
    scope = payload.get("project_scope_policy") if isinstance(payload.get("project_scope_policy"), dict) else {}
    if scope:
        future_connectors = (
            scope.get("future_external_connectors")
            if isinstance(scope.get("future_external_connectors"), dict)
            else {}
        )
        future_labels = [
            str(connector.get("label") or connector_id)
            for connector_id, connector in future_connectors.items()
            if isinstance(connector, dict)
        ]
        lines.extend(
            [
                "Perimetre Jarvis:",
                f"- statut: {scope.get('status', '')}",
                f"- scope_actuel: {scope.get('jarvis_current_scope', '')}",
                f"- coeur_avant_connecteurs: {scope.get('core_must_be_operational_before_external_connectors', False)}",
                f"- projets_externes_non_bloques: {scope.get('external_projects_not_blocked', False)}",
                f"- rapatriement_externe_dossiers_dedies: {scope.get('external_threads_may_rerapatriate_in_their_own_folders', False)}",
                f"- connecteurs_futurs: {', '.join(future_labels) or 'aucun'}",
                f"- integration_jarvis_sur_contrat: {scope.get('jarvis_integration_requires_connector_contract', False)}",
                f"- message: {scope.get('short_message', '')}",
                "",
            ]
        )
    lines.append("Pistes:")
    for track in payload.get("tracks") or []:
        lines.append(
            "- "
            f"P{track.get('priority')} {track.get('id')} "
            f"[{track.get('decision')}/{track.get('scope_class', '')}]: {track.get('next_focus')}"
        )
        if track.get("jarvis_future_connector_candidate") is True:
            lines.append(
                "  connecteur_futur=True external_not_blocked=True integration_jarvis_now=False"
            )
        worker = track.get("worker") if isinstance(track.get("worker"), dict) else {}
        if worker:
            lines.append(
                f"  worker={worker.get('id', '')} phase={worker.get('phase', '')} state={worker.get('state', '')}"
            )
        atelier_return = track.get("atelier_return") if isinstance(track.get("atelier_return"), dict) else {}
        if atelier_return:
            lines.append(
                f"  atelier={atelier_return.get('return_state', '')} suivi_manuel={atelier_return.get('manual_followup_required')} "
                f"raison={atelier_return.get('manual_followup_reason', '')}"
            )
        recent_reports = track.get("recent_local_reports") if isinstance(track.get("recent_local_reports"), list) else []
        if recent_reports:
            lines.append(
                f"  rapports_recents={len(recent_reports)} dernier={recent_reports[0].get('name', '')}"
            )
    local_reports = payload.get("local_integration_reports") if isinstance(payload.get("local_integration_reports"), dict) else {}
    latest_reports = local_reports.get("latest") if isinstance(local_reports.get("latest"), list) else []
    if latest_reports:
        lines.extend(["", "Derniers rapports locaux:"])
        for report in latest_reports[:6]:
            lines.append(f"- {report.get('track_id', '')}: {report.get('name', '')}")
    lines.extend(["", "Variables ou artefacts a preparer:"])
    credentials = payload.get("credential_plan") or []
    if credentials:
        for item in credentials:
            lines.append(f"- {item}")
    else:
        lines.append("- aucune")
    lines.extend(
        [
            "",
            "Regles:",
            "- Le controle central prepare les paquets de couche.",
            "- Les pistes sensibles restent en HOLD_MANUAL.",
            "- Les retours ateliers HOLD restent en suivi manuel et ne sont pas integres automatiquement.",
            "- Aucune valeur secrete ne doit apparaitre dans les sorties.",
            "- Paiement, commande, publication, envoi mail reel et action compte restent manuels.",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Jarvis parallel chantier control plane")
    parser.add_argument("--track", default="", help="Optional single track id")
    parser.add_argument("--no-packets", action="store_true", help="Do not write per-track packets")
    args = parser.parse_args()
    payload = build_parallel_chantiers_status(track_filter=args.track, write_packets=not args.no_packets)
    print(format_parallel_chantiers_status(payload))
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
