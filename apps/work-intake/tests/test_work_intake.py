import httpx
import pytest
from fastapi.testclient import TestClient

from work_intake.main import create_app


def work_item(external_key="demo-101"):
    return {
        "external_key": external_key,
        "title": "Improve room booking",
        "description": "Add equipment filters.",
        "source": "operations-demo",
        "status": "open",
        "labels": ["demo", "backend"],
    }


@pytest.fixture
def local_client(tmp_path, monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("GITHUB_REPOSITORY", raising=False)
    app = create_app(database_path=str(tmp_path / "work-items.sqlite3"))
    with TestClient(app) as client:
        yield client


def test_local_mode_health_cors_and_preview(local_client):
    page = local_client.get("/")
    assert page.status_code == 200
    assert "개발 요청을 Cloud Agent 작업으로 정리합니다." in page.text
    assert 'fetch("/work-items"' in page.text

    assert local_client.get("/health").json() == {
        "status": "ok",
        "mode": "local",
    }
    cors = local_client.options(
        "/work-items",
        headers={
            "Origin": "http://127.0.0.1:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert cors.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"

    response = local_client.post("/work-items", json=work_item())
    assert response.status_code == 201
    result = response.json()
    assert result["idempotent_replay"] is False
    assert result["work_item"]["delivery_mode"] == "local"
    assert result["work_item"]["delivery_status"] == "preview"
    assert result["work_item"]["preview_body"] == {
        "title": "Improve room booking",
        "body": (
            "Add equipment filters.\n\n---\nExternal key: `demo-101`"
            "\nSource: `operations-demo`"
        ),
        "labels": ["demo", "backend"],
    }


def test_local_create_is_idempotent_and_list_get_work(local_client):
    first = local_client.post("/work-items", json=work_item()).json()
    replay = local_client.post(
        "/github/issues", json=work_item()
    ).json()
    assert replay["idempotent_replay"] is True
    assert replay["work_item"]["id"] == first["work_item"]["id"]
    assert (
        len(
            local_client.get(
                "/work-items?source=operations-demo&status=open"
            ).json()
        )
        == 1
    )
    assert (
        local_client.get(f"/work-items/{first['work_item']['id']}").json()
        == first["work_item"]
    )
    assert local_client.get("/work-items/999").status_code == 404


def test_real_github_mode_posts_issue_once(tmp_path, monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("GITHUB_REPOSITORY", raising=False)
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(
            201,
            json={
                "number": 42,
                "html_url": "https://github.com/acme/sample/issues/42",
            },
        )

    github_client = httpx.Client(transport=httpx.MockTransport(handler))
    app = create_app(
        database_path=str(tmp_path / "github.sqlite3"),
        github_token="test-token",
        github_repository="acme/sample",
        github_client=github_client,
    )
    with TestClient(app) as client:
        first = client.post("/github/issues", json=work_item("jira:OPS-42"))
        replay = client.post("/github/issues", json=work_item("jira:OPS-42"))

    assert first.status_code == 201
    result = first.json()["work_item"]
    assert result["delivery_mode"] == "github"
    assert result["delivery_status"] == "created"
    assert result["preview_body"] is None
    assert result["github_issue_number"] == 42
    assert replay.json()["idempotent_replay"] is True
    assert len(requests) == 1
    request = requests[0]
    assert str(request.url) == "https://api.github.com/repos/acme/sample/issues"
    assert request.headers["authorization"] == "Bearer test-token"
    sent = __import__("json").loads(request.content)
    assert sent["title"] == "Improve room booking"
    assert "jira:OPS-42" in sent["body"]


@pytest.mark.parametrize(
    ("response", "expected_detail"),
    [
        (
            httpx.Response(422, json={"message": "Validation Failed"}),
            "GitHub API returned HTTP 422: Validation Failed",
        ),
        (
            httpx.Response(201, text="not-json"),
            "GitHub API returned an invalid JSON response",
        ),
        (
            httpx.Response(201, json={"number": 12}),
            "GitHub API response omitted issue number or URL",
        ),
    ],
)
def test_github_response_errors_are_explicit(
    tmp_path, monkeypatch, response, expected_detail
):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("GITHUB_REPOSITORY", raising=False)

    def handler(request):
        return response

    app = create_app(
        database_path=str(tmp_path / f"errors-{response.status_code}.sqlite3"),
        github_token="token",
        github_repository="acme/sample",
        github_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    with TestClient(app) as client:
        result = client.post("/work-items", json=work_item())
    assert result.status_code == 502
    assert result.json()["detail"] == expected_detail


def test_github_network_error_and_partial_configuration(tmp_path, monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("GITHUB_REPOSITORY", raising=False)

    def disconnected(request):
        raise httpx.ConnectError("offline", request=request)

    network_app = create_app(
        database_path=str(tmp_path / "network.sqlite3"),
        github_token="token",
        github_repository="acme/sample",
        github_client=httpx.Client(transport=httpx.MockTransport(disconnected)),
    )
    partial_app = create_app(
        database_path=str(tmp_path / "partial.sqlite3"),
        github_token="token",
        github_repository=None,
    )
    with TestClient(network_app) as client:
        network_result = client.post("/work-items", json=work_item())
    with TestClient(partial_app) as client:
        partial_result = client.post("/work-items", json=work_item())
    assert network_result.status_code == 502
    assert network_result.json()["detail"].endswith("ConnectError")
    assert partial_result.status_code == 503
    assert "requires both" in partial_result.json()["detail"]


def test_jira_webhook_normalization(local_client):
    response = local_client.post(
        "/webhooks/jira/normalize",
        json={
            "webhookEvent": "jira:issue_created",
            "issue": {
                "key": "OPS-7",
                "fields": {
                    "summary": "Projector is unavailable",
                    "description": {"type": "doc", "version": 1},
                    "labels": ["facilities", 100],
                    "status": {"name": "In Progress"},
                },
            },
        },
    )
    assert response.status_code == 200
    assert response.json() == {
        "event_type": "jira:issue_created",
        "work_item": {
            "external_key": "jira:OPS-7",
            "title": "Projector is unavailable",
            "description": '{"type": "doc", "version": 1}',
            "source": "jira",
            "status": "in_progress",
            "labels": ["facilities"],
        },
    }


@pytest.mark.parametrize("payload", [{}, {"issue": {"key": "OPS-1", "fields": {}}}])
def test_invalid_jira_webhooks_are_rejected(local_client, payload):
    assert (
        local_client.post("/webhooks/jira/normalize", json=payload).status_code
        == 422
    )
