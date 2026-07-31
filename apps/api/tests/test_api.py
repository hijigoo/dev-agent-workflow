from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from meeting_api.main import create_app


@pytest.fixture
def client(tmp_path):
    app = create_app(str(tmp_path / "reservations.sqlite3"))
    with TestClient(app) as test_client:
        yield test_client


def reservation(
    start: str = "2026-08-01T09:00:00+09:00",
    end: str = "2026-08-01T10:00:00+09:00",
    room_id: str = "atlas",
    title: str = "Operations review",
):
    return {"room_id": room_id, "title": title, "start": start, "end": end}


def test_health_and_cors(client):
    assert client.get("/health").json() == {"status": "ok"}
    response = client.options(
        "/rooms",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_mini_agent_is_deterministic_and_reports_pipeline_versions(client):
    response = client.post("/agent/respond", json={"message": "How do I reserve a room?"})

    assert response.status_code == 200
    assert response.json() == {
        "answer": (
            "Choose a room, provide a timezone-aware start and end time, "
            "then confirm the reservation."
        ),
        "intent": "reservation-help",
        "confidence": 0.96,
        "stages": [
            "normalize",
            "classify:reservation-help",
            "respond:reservation-help",
        ],
        "runtime_version": "v1.0.0",
        "pipeline_version": "v1.0.0",
    }
    assert client.get("/agent/about").json()["mode"] == "deterministic-local"


def test_mini_agent_rejects_empty_or_oversized_messages(client):
    assert client.post("/agent/respond", json={"message": "  "}).status_code == 422
    assert client.post("/agent/respond", json={"message": "x" * 501}).status_code == 422


def test_seeded_rooms_are_deterministic_and_filterable(client):
    rooms = client.get("/rooms").json()
    assert [room["id"] for room in rooms] == [
        "atlas",
        "borealis",
        "cascade",
        "denali",
    ]

    filtered = client.get(
        "/rooms",
        params=[
            ("min_capacity", "10"),
            ("required_equipment", "video"),
            ("equipment", "whiteboard"),
        ],
    ).json()
    assert [room["id"] for room in filtered] == ["cascade"]
    assert [room["id"] for room in client.get("/rooms?q=den").json()] == ["denali"]


def test_create_normalizes_timezone_to_utc_and_lists(client):
    response = client.post("/reservations", json=reservation())
    assert response.status_code == 201
    created = response.json()
    assert created["start"] == "2026-08-01T00:00:00Z"
    assert created["end"] == "2026-08-01T01:00:00Z"
    assert datetime.fromisoformat(created["created_at"].replace("Z", "+00:00")).tzinfo == timezone.utc
    assert client.get("/reservations?room_id=atlas").json() == [created]


@pytest.mark.parametrize(
    ("start", "end"),
    [
        ("2026-08-01T09:00:00", "2026-08-01T10:00:00+09:00"),
        ("2026-08-01T09:00:00+09:00", "2026-08-01T10:00:00"),
    ],
)
def test_timezone_naive_values_are_rejected(client, start, end):
    response = client.post("/reservations", json=reservation(start=start, end=end))
    assert response.status_code == 422
    assert "timezone-aware datetime required" in response.text


def test_invalid_interval_and_unknown_room_are_rejected(client):
    assert (
        client.post(
            "/reservations",
            json=reservation(
                start="2026-08-01T10:00:00Z", end="2026-08-01T10:00:00Z"
            ),
        ).status_code
        == 422
    )
    assert (
        client.post("/reservations", json=reservation(room_id="missing")).status_code
        == 404
    )


def test_overlapping_reservation_conflicts(client):
    assert client.post("/reservations", json=reservation()).status_code == 201
    response = client.post(
        "/reservations",
        json=reservation(
            start="2026-08-01T09:30:00+09:00",
            end="2026-08-01T10:30:00+09:00",
        ),
    )
    assert response.status_code == 409


def test_adjacent_half_open_reservations_do_not_conflict(client):
    first = client.post("/reservations", json=reservation())
    adjacent = client.post(
        "/reservations",
        json=reservation(
            start="2026-08-01T10:00:00+09:00",
            end="2026-08-01T11:00:00+09:00",
            title="Adjacent session",
        ),
    )
    preceding = client.post(
        "/reservations",
        json=reservation(
            start="2026-08-01T08:00:00+09:00",
            end="2026-08-01T09:00:00+09:00",
            title="Preceding session",
        ),
    )
    assert (first.status_code, adjacent.status_code, preceding.status_code) == (201, 201, 201)


def test_cancellation_releases_interval_and_can_be_filtered(client):
    created = client.post("/reservations", json=reservation()).json()
    cancelled = client.delete(f"/reservations/{created['id']}")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert (
        client.post(f"/reservations/{created['id']}/cancel").json()["status"]
        == "cancelled"
    )
    replacement = client.post(
        "/reservations", json=reservation(title="Replacement")
    )
    assert replacement.status_code == 201
    assert len(client.get("/reservations?status=cancelled").json()) == 1
    assert client.delete("/reservations/9999").status_code == 404


def test_mini_agent_classifies_korean_room_search(client):
    response = client.post(
        "/agent/respond",
        json={"message": "화상회의가 가능한 10명 회의실을 찾아줘"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "room-search"
    assert body["confidence"] == 0.93
    assert body["stages"] == [
        "normalize",
        "classify:room-search",
        "respond:room-search",
    ]


def test_quality_metrics_include_only_aggregates(client):
    created = client.post("/reservations", json=reservation()).json()
    client.post(
        "/reservations",
        json=reservation(
            start="2026-08-01T09:15:00+09:00",
            end="2026-08-01T09:45:00+09:00",
            title="Sensitive title",
        ),
    )
    client.delete(f"/reservations/{created['id']}")
    metrics = client.get("/metrics/quality")
    assert metrics.status_code == 200
    assert metrics.json() == {
        "total_reservations": 1,
        "active_reservations": 0,
        "cancelled_reservations": 1,
        "conflict_rejections": 1,
        "cancellation_rate": 1.0,
        "average_duration_minutes": 60.0,
    }
    assert "Sensitive" not in metrics.text
    assert client.get("/quality-metrics").json() == metrics.json()
