from app.freelance.router import router


def test_freelance_message_routes_are_registered() -> None:
    required = {
        ("/contracts/{contract_id}/messages", "GET"),
        ("/contracts/{contract_id}/messages", "POST"),
        ("/contracts/{contract_id}/timeline", "GET"),
        ("/contracts/{contract_id}/request-revision", "POST"),
        ("/posts/{post_id}/contract", "GET"),
        ("/posts/my", "GET"),
    }
    available = {
        (route.path, method)
        for route in router.routes
        for method in route.methods
    }
    for item in required:
        assert item in available
