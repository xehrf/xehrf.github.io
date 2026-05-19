from types import SimpleNamespace

from app.announcements.sources.hh_poller import _build_searches


def _settings(**overrides):
    values = {
        "hh_search_text": "",
        "hh_default_area": 40,
        "hh_default_experience": "",
        "hh_professional_role": 96,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_build_searches_filters_to_programmer_role_by_default():
    assert _build_searches(_settings()) == [{"area": 40, "professional_role": 96}]


def test_build_searches_allows_text_and_experience_filters():
    assert _build_searches(
        _settings(hh_search_text="python", hh_default_experience="between1And3")
    ) == [
        {
            "text": "python",
            "area": 40,
            "experience": "between1And3",
            "professional_role": 96,
        }
    ]
