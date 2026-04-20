from app.matchmaking.router import router


def test_matchmaking_quests_route_is_registered() -> None:
    assert any(
        route.path == "/matchmaking/quests" and "GET" in route.methods
        for route in router.routes
    )
