from __future__ import annotations

import json
import os
import re
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

UTC = timezone.utc
REPOSITORY_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class WorkItemCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    external_key: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=256)
    description: str = Field(default="", max_length=20_000)
    source: str = Field(default="local", min_length=1, max_length=80)
    status: str = Field(default="open", min_length=1, max_length=80)
    labels: list[str] = Field(default_factory=list, max_length=20)


class WorkItem(BaseModel):
    id: int
    external_key: str
    title: str
    description: str
    source: str
    status: str
    labels: list[str]
    delivery_mode: str
    delivery_status: str
    preview_body: Optional[dict[str, Any]] = None
    github_issue_number: Optional[int] = None
    github_issue_url: Optional[str] = None
    created_at: datetime


class WorkItemResult(BaseModel):
    work_item: WorkItem
    idempotent_replay: bool


class JiraNormalization(BaseModel):
    event_type: str
    work_item: WorkItemCreate


class WorkItemRepository:
    def __init__(self, database_path: str) -> None:
        self.database_path = database_path
        self._memory_connection: Optional[sqlite3.Connection] = None
        if database_path == ":memory:":
            self._memory_connection = sqlite3.connect(
                database_path, check_same_thread=False
            )
            self._memory_connection.row_factory = sqlite3.Row
        else:
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    def connect(self) -> sqlite3.Connection:
        if self._memory_connection is not None:
            return self._memory_connection
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def close(self, connection: sqlite3.Connection) -> None:
        if connection is not self._memory_connection:
            connection.close()

    def initialize(self) -> None:
        connection = self.connect()
        try:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS work_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    external_key TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    source TEXT NOT NULL,
                    status TEXT NOT NULL,
                    labels_json TEXT NOT NULL,
                    delivery_mode TEXT NOT NULL,
                    delivery_status TEXT NOT NULL,
                    preview_body_json TEXT,
                    github_issue_number INTEGER,
                    github_issue_url TEXT,
                    created_at_utc TEXT NOT NULL
                )
                """
            )
            connection.commit()
        finally:
            self.close(connection)

    def get_by_external_key(self, external_key: str) -> Optional[WorkItem]:
        connection = self.connect()
        try:
            row = connection.execute(
                "SELECT * FROM work_items WHERE external_key = ?",
                (external_key,),
            ).fetchone()
            return self.to_work_item(row) if row else None
        finally:
            self.close(connection)

    def insert(
        self,
        request: WorkItemCreate,
        delivery_mode: str,
        delivery_status: str,
        preview_body: Optional[dict[str, Any]],
        github_issue_number: Optional[int],
        github_issue_url: Optional[str],
    ) -> WorkItem:
        connection = self.connect()
        try:
            cursor = connection.execute(
                """
                INSERT INTO work_items(
                    external_key, title, description, source, labels_json,
                    status,
                    delivery_mode, delivery_status, preview_body_json,
                    github_issue_number, github_issue_url, created_at_utc
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    request.external_key,
                    request.title,
                    request.description,
                    request.source,
                    json.dumps(request.labels),
                    request.status,
                    delivery_mode,
                    delivery_status,
                    json.dumps(preview_body) if preview_body is not None else None,
                    github_issue_number,
                    github_issue_url,
                    utc_now(),
                ),
            )
            connection.commit()
            row = connection.execute(
                "SELECT * FROM work_items WHERE id = ?", (cursor.lastrowid,)
            ).fetchone()
            return self.to_work_item(row)
        finally:
            self.close(connection)

    def list(
        self,
        source: Optional[str],
        work_status: Optional[str],
        delivery_status: Optional[str],
    ) -> list[WorkItem]:
        clauses: list[str] = []
        parameters: list[str] = []
        if source:
            clauses.append("source = ?")
            parameters.append(source)
        if work_status:
            clauses.append("status = ?")
            parameters.append(work_status)
        if delivery_status:
            clauses.append("delivery_status = ?")
            parameters.append(delivery_status)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        connection = self.connect()
        try:
            rows = connection.execute(
                f"SELECT * FROM work_items {where} ORDER BY id", parameters
            ).fetchall()
            return [self.to_work_item(row) for row in rows]
        finally:
            self.close(connection)

    def get(self, work_item_id: int) -> Optional[WorkItem]:
        connection = self.connect()
        try:
            row = connection.execute(
                "SELECT * FROM work_items WHERE id = ?", (work_item_id,)
            ).fetchone()
            return self.to_work_item(row) if row else None
        finally:
            self.close(connection)

    @staticmethod
    def to_work_item(row: sqlite3.Row) -> WorkItem:
        return WorkItem(
            id=row["id"],
            external_key=row["external_key"],
            title=row["title"],
            description=row["description"],
            source=row["source"],
            status=row["status"],
            labels=json.loads(row["labels_json"]),
            delivery_mode=row["delivery_mode"],
            delivery_status=row["delivery_status"],
            preview_body=(
                json.loads(row["preview_body_json"])
                if row["preview_body_json"]
                else None
            ),
            github_issue_number=row["github_issue_number"],
            github_issue_url=row["github_issue_url"],
            created_at=datetime.fromisoformat(
                row["created_at_utc"].replace("Z", "+00:00")
            ),
        )


class GitHubIssuePublisher:
    def __init__(
        self,
        token: Optional[str],
        repository: Optional[str],
        client: Optional[httpx.Client] = None,
    ) -> None:
        self.token = token
        self.repository = repository
        self.client = client or httpx.Client(timeout=10)

    @property
    def local_mode(self) -> bool:
        return not self.token and not self.repository

    def payload(self, request: WorkItemCreate) -> dict[str, Any]:
        trace = (
            f"\n\n---\nExternal key: `{request.external_key}`"
            f"\nSource: `{request.source}`"
        )
        return {
            "title": request.title,
            "body": f"{request.description}{trace}",
            "labels": request.labels,
        }

    def publish(
        self, request: WorkItemCreate
    ) -> tuple[str, str, Optional[dict[str, Any]], Optional[int], Optional[str]]:
        payload = self.payload(request)
        if self.local_mode:
            return "local", "preview", payload, None, None
        if not self.token or not self.repository:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "GitHub mode requires both GITHUB_TOKEN and "
                    "GITHUB_REPOSITORY"
                ),
            )
        if not REPOSITORY_PATTERN.fullmatch(self.repository):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="GITHUB_REPOSITORY must use owner/repository format",
            )

        url = f"https://api.github.com/repos/{self.repository}/issues"
        try:
            response = self.client.post(
                url,
                headers={
                    "Accept": "application/vnd.github+json",
                    "Authorization": f"Bearer {self.token}",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                json=payload,
            )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"GitHub API request failed: {exc.__class__.__name__}",
            ) from exc
        if response.status_code < 200 or response.status_code >= 300:
            message = "request rejected"
            try:
                error_body = response.json()
                if isinstance(error_body, dict) and isinstance(
                    error_body.get("message"), str
                ):
                    message = error_body["message"]
            except json.JSONDecodeError:
                pass
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"GitHub API returned HTTP {response.status_code}: {message}",
            )
        try:
            body = response.json()
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="GitHub API returned an invalid JSON response",
            ) from exc
        issue_number = body.get("number") if isinstance(body, dict) else None
        issue_url = body.get("html_url") if isinstance(body, dict) else None
        if not isinstance(issue_number, int) or not isinstance(issue_url, str):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="GitHub API response omitted issue number or URL",
            )
        return "github", "created", None, issue_number, issue_url


class WorkIntakeService:
    def __init__(
        self, repository: WorkItemRepository, publisher: GitHubIssuePublisher
    ) -> None:
        self.repository = repository
        self.publisher = publisher
        self._creation_lock = threading.Lock()

    def create(self, request: WorkItemCreate) -> WorkItemResult:
        with self._creation_lock:
            existing = self.repository.get_by_external_key(request.external_key)
            if existing:
                return WorkItemResult(
                    work_item=existing, idempotent_replay=True
                )
            (
                delivery_mode,
                delivery_status,
                preview_body,
                issue_number,
                issue_url,
            ) = self.publisher.publish(request)
            try:
                item = self.repository.insert(
                    request,
                    delivery_mode,
                    delivery_status,
                    preview_body,
                    issue_number,
                    issue_url,
                )
            except sqlite3.IntegrityError:
                replay = self.repository.get_by_external_key(request.external_key)
                if replay is None:
                    raise
                return WorkItemResult(
                    work_item=replay, idempotent_replay=True
                )
            return WorkItemResult(work_item=item, idempotent_replay=False)


def normalize_jira_webhook(payload: dict[str, Any]) -> JiraNormalization:
    issue = payload.get("issue")
    if not isinstance(issue, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Jira webhook must contain an issue object",
        )
    key = issue.get("key")
    fields = issue.get("fields")
    if not isinstance(key, str) or not key.strip() or not isinstance(fields, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Jira issue key and fields are required",
        )
    summary = fields.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Jira issue summary is required",
        )
    raw_description = fields.get("description")
    if isinstance(raw_description, str):
        description = raw_description
    elif raw_description is None:
        description = ""
    else:
        description = json.dumps(raw_description, ensure_ascii=False, sort_keys=True)
    raw_labels = fields.get("labels", [])
    labels = (
        [label for label in raw_labels if isinstance(label, str)]
        if isinstance(raw_labels, list)
        else []
    )
    event_type = payload.get("webhookEvent", "jira:issue_updated")
    if not isinstance(event_type, str):
        event_type = "jira:issue_updated"
    raw_status = fields.get("status")
    jira_status = "open"
    if isinstance(raw_status, dict) and isinstance(raw_status.get("name"), str):
        jira_status = re.sub(
            r"[^a-z0-9]+", "_", raw_status["name"].strip().lower()
        ).strip("_") or "open"
    return JiraNormalization(
        event_type=event_type,
        work_item=WorkItemCreate(
            external_key=f"jira:{key.strip()}",
            title=summary,
            description=description,
            source="jira",
            status=jira_status,
            labels=labels,
        ),
    )


def create_app(
    database_path: Optional[str] = None,
    github_token: Optional[str] = None,
    github_repository: Optional[str] = None,
    github_client: Optional[httpx.Client] = None,
) -> FastAPI:
    resolved_database = database_path or os.getenv(
        "WORK_INTAKE_DATABASE",
        str(Path(__file__).resolve().parents[1] / "work_items.sqlite3"),
    )
    resolved_token = (
        github_token if github_token is not None else os.getenv("GITHUB_TOKEN")
    )
    resolved_repository = (
        github_repository
        if github_repository is not None
        else os.getenv("GITHUB_REPOSITORY")
    )
    repository = WorkItemRepository(resolved_database)
    service = WorkIntakeService(
        repository,
        GitHubIssuePublisher(
            resolved_token, resolved_repository, client=github_client
        ),
    )
    api = FastAPI(title="Local Work Intake API", version="0.1.0")
    api.state.repository = repository
    api.state.service = service
    api.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @api.get("/", response_class=FileResponse)
    def index() -> FileResponse:
        return FileResponse(Path(__file__).parent / "static" / "index.html")

    @api.get("/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "mode": "local" if service.publisher.local_mode else "github",
        }

    @api.post(
        "/work-items",
        response_model=WorkItemResult,
        status_code=status.HTTP_201_CREATED,
    )
    def create_work_item(request: WorkItemCreate) -> WorkItemResult:
        return service.create(request)

    @api.post(
        "/github/issues",
        response_model=WorkItemResult,
        status_code=status.HTTP_201_CREATED,
    )
    def create_github_issue(request: WorkItemCreate) -> WorkItemResult:
        return service.create(request)

    @api.get("/work-items", response_model=list[WorkItem])
    def list_work_items(
        source: Optional[str] = None,
        work_status: Optional[str] = Query(default=None, alias="status"),
        delivery_status: Optional[str] = Query(
            default=None, pattern="^(preview|created)$"
        ),
    ) -> list[WorkItem]:
        return repository.list(source, work_status, delivery_status)

    @api.get("/work-items/{work_item_id}", response_model=WorkItem)
    def get_work_item(work_item_id: int) -> WorkItem:
        item = repository.get(work_item_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="work item not found",
            )
        return item

    @api.post("/webhooks/jira/normalize", response_model=JiraNormalization)
    def jira_webhook(payload: dict[str, Any]) -> JiraNormalization:
        return normalize_jira_webhook(payload)

    @api.post("/webhooks/jira", response_model=JiraNormalization)
    def jira_webhook_compatibility(payload: dict[str, Any]) -> JiraNormalization:
        return normalize_jira_webhook(payload)

    return api


app = create_app()
