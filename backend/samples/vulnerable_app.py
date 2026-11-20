import os
import pickle
import sqlite3
import subprocess
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel

app = FastAPI(title="Vulnerable Target Backend")

JWT_SECRET = "super_secret_admin_key_12345"
DB_PATH = "app_users.db"


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'user',
            api_token TEXT
        )
    """)
    cursor.execute(
        "INSERT OR IGNORE INTO users (id, username, password, role, api_token) "
        "VALUES (1, 'admin', 'admin123', 'admin', 'tok_live_99887766')"
    )
    conn.commit()
    conn.close()


init_db()


class UserAuth(BaseModel):
    username: str
    password: str


@app.post("/register")
def register(user: UserAuth):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, password, role) VALUES (?, ?, 'user')",
            (user.username, user.password),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists")
    finally:
        conn.close()
    return {"message": f"User {user.username} registered successfully"}


@app.post("/login")
def login(user: UserAuth):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    query = f"SELECT id, username, role FROM users WHERE username = '{user.username}' AND password = '{user.password}'"
    cursor.execute(query)
    account = cursor.fetchone()
    conn.close()

    if account:
        return {
            "status": "authenticated",
            "user_id": account[0],
            "role": account[2],
            "session_token": f"session_{account[1]}_{JWT_SECRET}",
        }
    raise HTTPException(status_code=401, detail="Invalid credentials")


@app.get("/users/{user_id}")
def get_user_profile(user_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password, role, api_token FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": row[0],
        "username": row[1],
        "password": row[2],
        "role": row[3],
        "api_token": row[4],
    }


@app.delete("/admin/delete-user/{user_id}")
def delete_user(user_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"status": f"User {user_id} deleted by unauthenticated caller"}


@app.get("/diagnostics/ping")
def ping_host(host: str):
    output = subprocess.check_output(f"ping -c 1 {host}", shell=True, text=True)
    return {"result": output}


@app.post("/session/import")
async def import_session(request: Request):
    raw_data = await request.body()
    session_obj = pickle.loads(raw_data)
    return {"loaded_session": str(session_obj)}
