#!/usr/bin/env python3
"""Utility to generate mock data and test database for E2E tests."""

import sqlite3
from faker import Faker
import random
from pathlib import Path

faker = Faker()


def seed_everything(seed: int = 0) -> None:
    """Seed Faker and random for reproducible data."""
    random.seed(seed)
    faker.seed_instance(seed)


def create_database(db_path: str = "tests/e2e/test_data.sqlite", seed: int | None = 0) -> None:
    """Create SQLite database and populate with fake users.

    The optional ``seed`` parameter ensures deterministic data generation.
    """
    if seed is not None:
        seed_everything(seed)
    path = Path(db_path)
    if path.exists():
        path.unlink()

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute(
        "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, password TEXT, display_name TEXT)"
    )

    users = [
        (i, faker.email(), "password123", faker.name())
        for i in range(1, 6)
    ]
    cur.executemany("INSERT INTO users VALUES (?, ?, ?, ?)", users)
    conn.commit()
    conn.close()
    print(f"Mock database created at {db_path}")


def cleanup(db_path: str = "tests/e2e/test_data.sqlite"):
    """Remove the test database."""
    path = Path(db_path)
    if path.exists():
        path.unlink()
        print(f"Removed {db_path}")


if __name__ == "__main__":
    create_database(seed=0)
