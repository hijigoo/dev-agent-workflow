"""Intentionally vulnerable CodeQL training sample. Do not deploy or merge."""

import sqlite3

from flask import Flask, request

app = Flask(__name__)


@app.get("/codeql-demo/users")
def find_user():
    username = request.args["username"]
    query = f"SELECT username FROM users WHERE username = '{username}'"

    with sqlite3.connect("codeql-demo.sqlite3") as connection:
        rows = connection.execute(query).fetchall()

    return {"users": rows}
