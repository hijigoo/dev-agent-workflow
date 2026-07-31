from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Optional

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator

UTC = timezone.utc

SEEDED_ROOMS = (
    ("atlas", "Atlas", 4, ("display", "whiteboard")),
    ("borealis", "Borealis", 8, ("display", "video", "whiteboard")),
    ("cascade", "Cascade", 12, ("display", "video", "whiteboard", "speakerphone")),
    ("denali", "Denali", 20, ("display", "video", "speakerphone")),
)


def utc_text(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def parse_utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


class Room(BaseModel):
    id: str
    name: str
    capacity: int
    equipment: list[str]


class ReservationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    room_id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=160)
    start: datetime
    end: datetime

    @field_validator("start", "end")
    @classmethod
    def timezone_required(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timezone-aware datetime required")
        return value


class Reservation(BaseModel):
    id: int
    room_id: str
    title: str
    start: datetime
    end: datetime
    status: str
    created_at: datetime


class QualityMetrics(BaseModel):
    total_reservations: int
    active_reservations: int
    cancelled_reservations: int
    conflict_rejections: int
    cancellation_rate: float
    average_duration_minutes: float


class AgentRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=500)


class AgentResponse(BaseModel):
    answer: str
    intent: str
    confidence: float
    stages: list[str]
    runtime_version: str
    pipeline_version: str


MINI_AGENT_RUNTIME_VERSION = "v1.0.0"
MINI_PIPELINE_VERSION = "v1.0.0"


def run_mini_agent(message: str) -> AgentResponse:
    normalized = " ".join(message.lower().split())
    if any(keyword in normalized for keyword in ("reserve", "reservation", "book", "예약")):
        intent = "reservation-help"
        confidence = 0.96
        answer = (
            "Choose a room, provide a timezone-aware start and end time, "
            "then confirm the reservation."
        )
    elif any(keyword in normalized for keyword in ("room", "meeting", "capacity", "회의실", "화상회의")):
        intent = "room-search"
        confidence = 0.93
        answer = (
            "Use capacity and equipment filters to find a room. "
            "Atlas is the smallest seeded room."
        )
    elif any(keyword in normalized for keyword in ("security", "cve", "alert")):
        intent = "security-triage"
        confidence = 0.9
        answer = (
            "Create an agent-ready security work item, reproduce the alert, "
            "apply the smallest fix, and run regression checks."
        )
    else:
        intent = "fallback"
        confidence = 0.55
        answer = (
            "I can demonstrate room search, reservation help, or security alert triage."
        )

    return AgentResponse(
        answer=answer,
        intent=intent,
        confidence=confidence,
        stages=["normalize", f"classify:{intent}", f"respond:{intent}"],
        runtime_version=MINI_AGENT_RUNTIME_VERSION,
        pipeline_version=MINI_PIPELINE_VERSION,
    )


class ReservationRepository:
    def __init__(self, database_path: str) -> None:
        self.database_path = database_path
        self._memory_connection: sqlite3.Connection | None = None
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
            connection.executescript(
                """
                PRAGMA foreign_keys = ON;
                CREATE TABLE IF NOT EXISTS rooms (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    capacity INTEGER NOT NULL CHECK (capacity > 0),
                    equipment_json TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS reservations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room_id TEXT NOT NULL REFERENCES rooms(id),
                    title TEXT NOT NULL,
                    start_utc TEXT NOT NULL,
                    end_utc TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')),
                    created_at_utc TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS reservations_room_time
                    ON reservations(room_id, start_utc, end_utc);
                CREATE TABLE IF NOT EXISTS counters (
                    name TEXT PRIMARY KEY,
                    value INTEGER NOT NULL
                );
                INSERT OR IGNORE INTO counters(name, value)
                    VALUES ('conflict_rejections', 0);
                """
            )
            connection.executemany(
                """
                INSERT OR IGNORE INTO rooms(id, name, capacity, equipment_json)
                VALUES (?, ?, ?, ?)
                """,
                [
                    (room_id, name, capacity, json.dumps(equipment))
                    for room_id, name, capacity, equipment in SEEDED_ROOMS
                ],
            )
            connection.commit()
        finally:
            self.close(connection)

    def list_rooms(
        self, min_capacity: int, equipment: tuple[str, ...], query: str | None
    ) -> list[Room]:
        connection = self.connect()
        try:
            rows = connection.execute(
                """
                SELECT id, name, capacity, equipment_json
                FROM rooms
                WHERE capacity >= ?
                  AND (? IS NULL OR lower(name) LIKE '%' || lower(?) || '%')
                ORDER BY capacity, name
                """,
                (min_capacity, query, query),
            ).fetchall()
            required = {item.lower() for item in equipment}
            rooms = [
                Room(
                    id=row["id"],
                    name=row["name"],
                    capacity=row["capacity"],
                    equipment=json.loads(row["equipment_json"]),
                )
                for row in rows
            ]
            return [
                room
                for room in rooms
                if required.issubset({item.lower() for item in room.equipment})
            ]
        finally:
            self.close(connection)

    def room_exists(self, room_id: str) -> bool:
        connection = self.connect()
        try:
            return (
                connection.execute(
                    "SELECT 1 FROM rooms WHERE id = ?", (room_id,)
                ).fetchone()
                is not None
            )
        finally:
            self.close(connection)

    def create_reservation(self, request: ReservationCreate) -> Reservation:
        start_utc = utc_text(request.start)
        end_utc = utc_text(request.end)
        connection = self.connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            conflict = connection.execute(
                """
                SELECT 1
                FROM reservations
                WHERE room_id = ?
                  AND status = 'active'
                  AND start_utc < ?
                  AND end_utc > ?
                LIMIT 1
                """,
                (request.room_id, end_utc, start_utc),
            ).fetchone()
            if conflict:
                connection.execute(
                    """
                    UPDATE counters SET value = value + 1
                    WHERE name = 'conflict_rejections'
                    """
                )
                connection.commit()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="room is already reserved during this interval",
                )
            created_at = utc_text(datetime.now(UTC))
            cursor = connection.execute(
                """
                INSERT INTO reservations(
                    room_id, title, start_utc, end_utc, status, created_at_utc
                ) VALUES (?, ?, ?, ?, 'active', ?)
                """,
                (request.room_id, request.title, start_utc, end_utc, created_at),
            )
            connection.commit()
            row = connection.execute(
                "SELECT * FROM reservations WHERE id = ?", (cursor.lastrowid,)
            ).fetchone()
            return self.to_reservation(row)
        finally:
            self.close(connection)

    def list_reservations(
        self, room_id: str | None, reservation_status: str | None
    ) -> list[Reservation]:
        clauses: list[str] = []
        parameters: list[str] = []
        if room_id:
            clauses.append("room_id = ?")
            parameters.append(room_id)
        if reservation_status:
            clauses.append("status = ?")
            parameters.append(reservation_status)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        connection = self.connect()
        try:
            rows = connection.execute(
                f"""
                SELECT * FROM reservations
                {where}
                ORDER BY start_utc, id
                """,
                parameters,
            ).fetchall()
            return [self.to_reservation(row) for row in rows]
        finally:
            self.close(connection)

    def cancel_reservation(self, reservation_id: int) -> Reservation | None:
        connection = self.connect()
        try:
            connection.execute(
                """
                UPDATE reservations
                SET status = 'cancelled'
                WHERE id = ? AND status = 'active'
                """,
                (reservation_id,),
            )
            row = connection.execute(
                "SELECT * FROM reservations WHERE id = ?", (reservation_id,)
            ).fetchone()
            connection.commit()
            return self.to_reservation(row) if row else None
        finally:
            self.close(connection)

    def quality_metrics(self) -> QualityMetrics:
        connection = self.connect()
        try:
            totals = connection.execute(
                """
                SELECT
                    count(*) AS total,
                    sum(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
                    sum(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
                    coalesce(avg(
                        (julianday(end_utc) - julianday(start_utc)) * 1440
                    ), 0) AS average_minutes
                FROM reservations
                """
            ).fetchone()
            conflicts = connection.execute(
                "SELECT value FROM counters WHERE name = 'conflict_rejections'"
            ).fetchone()["value"]
            total = totals["total"]
            cancelled = totals["cancelled"] or 0
            return QualityMetrics(
                total_reservations=total,
                active_reservations=totals["active"] or 0,
                cancelled_reservations=cancelled,
                conflict_rejections=conflicts,
                cancellation_rate=round(cancelled / total, 4) if total else 0,
                average_duration_minutes=round(totals["average_minutes"], 2),
            )
        finally:
            self.close(connection)

    @staticmethod
    def to_reservation(row: sqlite3.Row) -> Reservation:
        return Reservation(
            id=row["id"],
            room_id=row["room_id"],
            title=row["title"],
            start=parse_utc(row["start_utc"]),
            end=parse_utc(row["end_utc"]),
            status=row["status"],
            created_at=parse_utc(row["created_at_utc"]),
        )


def create_app(database_path: str | None = None) -> FastAPI:
    resolved_path = database_path or os.getenv(
        "MEETING_API_DATABASE",
        str(Path(__file__).resolve().parents[1] / "meeting_rooms.sqlite3"),
    )
    repository = ReservationRepository(resolved_path)
    api = FastAPI(title="Meeting Operations API", version="0.1.0")
    api.state.repository = repository
    api.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @api.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @api.get("/agent/about")
    def agent_about() -> dict[str, str]:
        return {
            "name": "Mini Agent",
            "runtime_version": MINI_AGENT_RUNTIME_VERSION,
            "pipeline_version": MINI_PIPELINE_VERSION,
            "mode": "deterministic-local",
        }

    @api.post("/agent/respond", response_model=AgentResponse)
    def agent_respond(request: AgentRequest) -> AgentResponse:
        return run_mini_agent(request.message)

    @api.get("/rooms", response_model=list[Room])
    def list_rooms(
        min_capacity: Annotated[int, Query(ge=1)] = 1,
        equipment: Annotated[Optional[list[str]], Query()] = None,
        required_equipment: Annotated[Optional[list[str]], Query()] = None,
        q: Annotated[Optional[str], Query(min_length=1)] = None,
    ) -> list[Room]:
        normalized_equipment = tuple(
            item.strip()
            for value in ((equipment or []) + (required_equipment or []))
            for item in value.split(",")
            if item.strip()
        )
        return repository.list_rooms(min_capacity, normalized_equipment, q)

    @api.post(
        "/reservations",
        response_model=Reservation,
        status_code=status.HTTP_201_CREATED,
    )
    def create_reservation(request: ReservationCreate) -> Reservation:
        if request.end <= request.start:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="end must be after start",
            )
        if not repository.room_exists(request.room_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="room not found"
            )
        return repository.create_reservation(request)

    @api.get("/reservations", response_model=list[Reservation])
    def list_reservations(
        room_id: Optional[str] = None,
        reservation_status: Annotated[
            Optional[str], Query(alias="status", pattern="^(active|cancelled)$")
        ] = None,
    ) -> list[Reservation]:
        return repository.list_reservations(room_id, reservation_status)

    @api.delete("/reservations/{reservation_id}", response_model=Reservation)
    def cancel_reservation(reservation_id: int) -> Reservation:
        reservation = repository.cancel_reservation(reservation_id)
        if reservation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="reservation not found",
            )
        return reservation

    @api.post(
        "/reservations/{reservation_id}/cancel", response_model=Reservation
    )
    def cancel_reservation_action(reservation_id: int) -> Reservation:
        return cancel_reservation(reservation_id)

    @api.get("/metrics/quality", response_model=QualityMetrics)
    def quality_metrics() -> QualityMetrics:
        return repository.quality_metrics()

    @api.get("/quality-metrics", response_model=QualityMetrics)
    def quality_metrics_compatibility() -> QualityMetrics:
        return repository.quality_metrics()

    return api


app = create_app()
