"""Thin async wrapper around the public hh.ru vacancies API.

We use only the public read endpoints (no auth) and identify the client via a
User-Agent string — hh.ru blocks anonymous traffic without one. Returned dicts
mirror the hh.ru JSON shape; mapping into our internal model lives in
``hh_poller.py``.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

HH_BASE_URL = "https://api.hh.ru"
DEFAULT_TIMEOUT = httpx.Timeout(15.0, connect=10.0)


class HHClient:
    def __init__(self, user_agent: str) -> None:
        if not user_agent:
            # hh.ru returns 403 without a UA, so refuse to start a useless client.
            raise ValueError("HH user-agent is required")
        self._client = httpx.AsyncClient(
            base_url=HH_BASE_URL,
            headers={"User-Agent": user_agent, "Accept": "application/json"},
            timeout=DEFAULT_TIMEOUT,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def search_vacancies(
        self,
        *,
        text: str | None = None,
        area: int | None = None,
        experience: str | None = None,
        professional_role: int | None = None,
        per_page: int = 50,
        page: int = 0,
    ) -> dict[str, Any]:
        """Search /vacancies. See https://api.hh.ru/openapi/redoc#tag/Poisk-vakansij

        ``experience`` is one of: noExperience, between1And3, between3And6, moreThan6.
        """
        params: dict[str, Any] = {"per_page": max(1, min(100, per_page)), "page": page}
        if text:
            params["text"] = text
        if area is not None:
            params["area"] = area
        if experience:
            params["experience"] = experience
        if professional_role is not None:
            params["professional_role"] = professional_role

        # 429 / 5xx → short retry with jittered backoff; we want polling to be
        # resilient but not pile on hh during incidents.
        for attempt in range(3):
            try:
                resp = await self._client.get("/vacancies", params=params)
                if resp.status_code == 429:
                    await asyncio.sleep(2 ** attempt)
                    continue
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                if 500 <= e.response.status_code < 600 and attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                    continue
                logger.warning("hh.ru search failed: %s %s", e.response.status_code, e.response.text[:200])
                raise
            except httpx.TimeoutException:
                if attempt < 2:
                    await asyncio.sleep(1)
                    continue
                raise
        return {"items": [], "found": 0}
