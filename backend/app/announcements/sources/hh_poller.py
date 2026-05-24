"""Periodic poller that pulls fresh hh.ru vacancies and upserts them as
Announcements. Engagement counters (view/click/save) and ratings are preserved
across upserts; only the content fields and expiry are refreshed.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.announcements.sources.hh import HHClient
from app.core.config import get_settings
from app.core.redis_client import get_redis
from app.db.models import (
    Announcement,
    AnnouncementCategory,
    AnnouncementSkillLevel,
    AnnouncementSource,
)
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

HH_SWEEP_LOCK_KEY = "announcements:hh_poll_lock"

# hh.ru experience codes → our skill levels.
EXPERIENCE_MAP: dict[str, AnnouncementSkillLevel] = {
    "noExperience": AnnouncementSkillLevel.junior,
    "between1And3": AnnouncementSkillLevel.middle,
    "between3And6": AnnouncementSkillLevel.senior,
    "moreThan6": AnnouncementSkillLevel.lead,
}

def _build_searches(settings) -> list[dict[str, Any]]:
    """Build the list of hh /vacancies queries to run each poll cycle.

    For now we keep a single search driven by settings. Later this can be
    swapped for a DB-backed list managed via an admin UI.
    """
    search: dict[str, Any] = {}
    if settings.hh_search_text:
        search["text"] = settings.hh_search_text
    if settings.hh_default_area:
        search["area"] = settings.hh_default_area
    if settings.hh_default_experience:
        search["experience"] = settings.hh_default_experience
    if settings.hh_professional_role:
        search["professional_role"] = settings.hh_professional_role
    return [search]

# Description size cap so we don't bloat the DB with hh's HTML-heavy text.
MAX_DESCRIPTION_LEN = 4000


import re as _re

_HTML_TAG_RE = _re.compile(r"<[^>]+>")
_HTML_BLOCK_TAGS = _re.compile(
    r"</(p|div|li|ul|ol|h[1-6]|tr|table)\s*>",
    flags=_re.IGNORECASE,
)
_HTML_LIST_ITEM = _re.compile(r"<li[^>]*>", flags=_re.IGNORECASE)
_MULTIPLE_NEWLINES = _re.compile(r"\n{3,}")


def _strip_html(text: str | None) -> str:
    """Strip hh.ru HTML to readable plain text. Preserves paragraph and
    list-item breaks; replaces block-level closes with a newline so we don't
    end up with a single wall of text."""
    if not text:
        return ""
    cleaned = text
    cleaned = _HTML_LIST_ITEM.sub("\n• ", cleaned)
    cleaned = _HTML_BLOCK_TAGS.sub("\n", cleaned)
    cleaned = cleaned.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
    cleaned = _HTML_TAG_RE.sub("", cleaned)
    cleaned = _MULTIPLE_NEWLINES.sub("\n\n", cleaned)
    # Common HTML entities the poller might encounter:
    cleaned = (
        cleaned.replace("&nbsp;", " ")
        .replace("&laquo;", "«")
        .replace("&raquo;", "»")
        .replace("&mdash;", "—")
        .replace("&ndash;", "–")
        .replace("&hellip;", "…")
        .replace("&quot;", '"')
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
    )
    return cleaned.strip()


def _build_description(vacancy: dict[str, Any]) -> str:
    snippet = vacancy.get("snippet") or {}
    parts: list[str] = []
    requirement = _strip_html(snippet.get("requirement"))
    if requirement:
        parts.append(f"Требования:\n{requirement}")
    responsibility = _strip_html(snippet.get("responsibility"))
    if responsibility:
        parts.append(f"Обязанности:\n{responsibility}")
    if not parts:
        parts.append("Подробности — по ссылке на hh.ru.")
    text = "\n\n".join(parts)
    return text[:MAX_DESCRIPTION_LEN]


def _extract_tags(vacancy: dict[str, Any]) -> list[str]:
    tags: list[str] = []
    schedule = (vacancy.get("schedule") or {}).get("id")
    if schedule == "remote":
        tags.append("remote")
    employment = (vacancy.get("employment") or {}).get("id")
    if employment == "part":
        tags.append("part-time")
    elif employment == "project":
        tags.append("project")
    skills = vacancy.get("key_skills") or []
    for skill in skills[:8]:
        name = (skill or {}).get("name")
        if name:
            tags.append(name)
    if vacancy.get("accept_temporary"):
        tags.append("temporary")
    # Dedup but keep order.
    seen: set[str] = set()
    return [t for t in tags if not (t in seen or seen.add(t))][:20]


def _extract_contacts(vacancy: dict[str, Any]) -> dict[str, str | None]:
    """Pull contact fields out of a full hh.ru vacancy payload. Most public
    vacancies don't expose this — the employer has to opt in — so all four
    fields will commonly be None."""
    contacts = vacancy.get("contacts") or {}
    name = (contacts.get("name") or "").strip() or None
    email = (contacts.get("email") or "").strip() or None
    phones = contacts.get("phones") or []
    phone: str | None = None
    if phones and isinstance(phones, list):
        first = phones[0] or {}
        # Hh phones come as {country, city, number, comment, formatted}
        # We prefer the human-readable formatted version when available.
        phone = (
            first.get("formatted")
            or "+{country}{city}{number}".format(
                country=first.get("country") or "",
                city=first.get("city") or "",
                number=first.get("number") or "",
            ).strip("+ ") or None
        )
    return {
        "contact_handle": name,
        "contact_phone": phone,
        "contact_email": email,
    }


def _map_full_description(vacancy: dict[str, Any]) -> str:
    """Use the full `description` field from /vacancies/{id}; fall back to the
    snippet shape if only that's available."""
    full = _strip_html(vacancy.get("description"))
    if full:
        return full[:MAX_DESCRIPTION_LEN]
    return _build_description(vacancy)


# HH-vacancies are typically live for 30 days from publication; after that
# the employer has to re-promote them or they get archived.
HH_VACANCY_LIFETIME_DAYS = 30


def _parse_hh_datetime(value: str | None) -> datetime | None:
    """hh returns ISO 8601 like ``2026-05-20T12:34:56+0300``. Python 3.11+'s
    ``datetime.fromisoformat`` handles that directly; we still wrap it in
    try/except so a single malformed value doesn't kill an import cycle."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _compute_expires_at(vacancy: dict[str, Any], *, fallback_ttl_hours: int) -> datetime:
    """Each vacancy gets its own expiry based on hh.ru's ``published_at`` +
    standard 30-day lifetime. This makes every card's countdown unique and
    real instead of every batch sharing the same now+7d expiry."""
    now = datetime.now(timezone.utc)
    published_at = _parse_hh_datetime(vacancy.get("published_at"))
    if published_at is None:
        return now + timedelta(hours=fallback_ttl_hours)
    candidate = published_at + timedelta(days=HH_VACANCY_LIFETIME_DAYS)
    # If the vacancy is technically past its standard period but still in
    # search results, give it at least a day of grace so users can see it.
    if candidate <= now:
        candidate = now + timedelta(days=1)
    return candidate


def _map_vacancy(vacancy: dict[str, Any], *, ttl_hours: int) -> dict[str, Any] | None:
    """Translate a hh /vacancies item into kwargs for an Announcement upsert.

    Returns None for vacancies we can't safely import (missing id, archived,
    etc) so the caller can skip them.
    """
    vid = vacancy.get("id")
    name = vacancy.get("name")
    alt_url = vacancy.get("alternate_url")
    if not vid or not name or not alt_url:
        return None
    if vacancy.get("archived"):
        return None

    experience_id = (vacancy.get("experience") or {}).get("id")
    skill = EXPERIENCE_MAP.get(experience_id)

    salary = vacancy.get("salary") or {}
    employer = vacancy.get("employer") or {}
    area = vacancy.get("area") or {}

    return {
        "external_id": str(vid),
        "external_url": alt_url,
        "title": name[:200],
        "description": _build_description(vacancy),
        "category": AnnouncementCategory.job_offer,
        "skill_level": skill,
        "source_type": AnnouncementSource.hh,
        "salary_from": salary.get("from"),
        "salary_to": salary.get("to"),
        "salary_currency": (salary.get("currency") or "")[:10] or None,
        "employer_name": (employer.get("name") or "")[:255] or None,
        "area_name": (area.get("name") or "")[:255] or None,
        "tags": _extract_tags(vacancy),
        "expires_at": _compute_expires_at(vacancy, fallback_ttl_hours=ttl_hours),
    }


def _upsert(db: Session, payload: dict[str, Any]) -> tuple[int, int]:
    """Insert or update an announcement by (source_type, external_id).
    Returns (inserted, updated) — 1 in one slot, 0 in the other."""
    existing = (
        db.query(Announcement)
        .filter(
            Announcement.source_type == AnnouncementSource.hh,
            Announcement.external_id == payload["external_id"],
        )
        .first()
    )
    if existing is None:
        db.add(Announcement(**payload))
        return (1, 0)

    # Preserve engagement counters and ratings — only refresh content + TTL.
    for field in (
        "title",
        "description",
        "skill_level",
        "salary_from",
        "salary_to",
        "salary_currency",
        "employer_name",
        "area_name",
        "tags",
        "external_url",
        "expires_at",
    ):
        setattr(existing, field, payload[field])
    return (0, 1)


async def poll_once(client: HHClient, db: Session, *, settings) -> tuple[int, int]:
    """Run one full poll cycle across all configured searches. Returns
    (inserted_total, updated_total)."""
    inserted = updated = 0
    for search in _build_searches(settings):
        for page in range(settings.hh_max_pages):
            try:
                data = await client.search_vacancies(
                    per_page=settings.hh_per_page,
                    page=page,
                    **search,
                )
            except Exception:
                logger.exception("hh.ru search failed for %s page=%d", search, page)
                break
            items = data.get("items") or []
            if not items:
                break
            for vacancy in items:
                payload = _map_vacancy(vacancy, ttl_hours=settings.hh_announcement_ttl_hours)
                if payload is None:
                    continue
                ins, upd = _upsert(db, payload)
                inserted += ins
                updated += upd
            db.commit()
            # Pagination is 0-indexed; stop early if hh signals last page.
            pages_total = data.get("pages")
            if pages_total is not None and page + 1 >= pages_total:
                break
    return inserted, updated


async def run_forever() -> None:
    settings = get_settings()
    logger.info(
        "hh.ru poller booting: enabled=%s ua_set=%s token_set=%s area=%s exp=%s role=%s interval=%ds",
        settings.hh_enabled,
        bool(settings.hh_user_agent),
        bool(settings.hh_access_token),
        settings.hh_default_area,
        settings.hh_default_experience,
        settings.hh_professional_role,
        settings.hh_poll_interval_seconds,
    )
    if not settings.hh_enabled:
        logger.warning("hh.ru poller disabled by config (HH_ENABLED=false); skipping")
        return
    if not settings.hh_user_agent:
        logger.warning("HH_USER_AGENT is empty; hh.ru poller will not start")
        return

    try:
        client = HHClient(settings.hh_user_agent, access_token=settings.hh_access_token or None)
    except Exception:
        logger.exception("Failed to construct HHClient; poller aborted")
        return

    logger.info("hh.ru poller entering main loop")
    try:
        while True:
            db = SessionLocal()
            r = None
            lock_acquired = False
            try:
                try:
                    r = get_redis()
                    lock_acquired = bool(
                        r.set(HH_SWEEP_LOCK_KEY, "1", ex=settings.hh_poll_interval_seconds * 2, nx=True)
                    )
                except Exception:
                    # Redis is only a cross-worker guard here. The upsert path is
                    # idempotent enough for a single Render worker, so don't let a
                    # missing Redis service prevent vacancy imports entirely.
                    logger.warning("Redis lock unavailable for hh.ru poller; polling without lock", exc_info=True)
                    lock_acquired = True
                if not lock_acquired:
                    logger.info("hh.ru poll skipped: another instance holds the lock")
                else:
                    ins, upd = await poll_once(client, db, settings=settings)
                    logger.info("hh.ru poll done: inserted=%d updated=%d", ins, upd)
            except Exception:
                logger.exception("hh.ru poll cycle failed")
                try:
                    db.rollback()
                except Exception:
                    pass
            finally:
                if lock_acquired:
                    try:
                        if r is not None:
                            r.delete(HH_SWEEP_LOCK_KEY)
                    except Exception:
                        pass
                if r is not None:
                    r.close()
                db.close()
            await asyncio.sleep(settings.hh_poll_interval_seconds)
    finally:
        await client.aclose()
