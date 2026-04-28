import asyncio

import main


def test_lifespan_runs_seed_and_closes_session(monkeypatch) -> None:
    events: list[str] = []

    class DummySession:
        def close(self) -> None:
            events.append("close")

    dummy_session = DummySession()

    def fake_session_local() -> DummySession:
        events.append("session")
        return dummy_session

    def fake_seed(db: DummySession) -> None:
        assert db is dummy_session
        events.append("seed")

    monkeypatch.setattr(main, "SessionLocal", fake_session_local)
    monkeypatch.setattr(main, "seed_if_empty", fake_seed)

    async def run_lifespan() -> None:
        async with main.lifespan(main.app):
            events.append("inside")

    asyncio.run(run_lifespan())

    assert events == ["session", "seed", "close", "inside"]
