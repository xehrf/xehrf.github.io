from app.rating.router import router


def test_rating_routes_are_registered() -> None:
    required = {
        ("/rating/leaderboard", "GET"),
        ("/rating/history/me", "GET"),
        ("/rating/history/{user_id}", "GET"),
        ("/rating/seasons", "GET"),
        ("/rating/categories", "GET"),
        ("/rating/position/me", "GET"),
        ("/rating/compare", "GET"),
    }
    available = {(route.path, method) for route in router.routes for method in route.methods}
    for route_key in required:
        assert route_key in available
