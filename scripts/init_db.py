#!/usr/bin/env python3
"""
Create the schema, build the marts and load the workbook — in one command.

    python scripts/init_db.py                      # profilkes_2025.xlsx, local DSN
    python scripts/init_db.py other_workbook.xlsx
    DATABASE_URL=postgresql://user:pass@host/db python scripts/init_db.py

Re-running is safe: `db/01_schema.sql` and `db/02_views.sql` are additive
(CREATE ... IF NOT EXISTS / CREATE OR REPLACE) and the loader upserts on the
natural key. The loader reconciles the workbook against the database and exits
non-zero without committing anything if a check fails.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parent))

from load_profilkes import (  # noqa: E402
    DEFAULT_DSN,
    PROVINCE_BPS,
    PROVINCE_NAME,
    DISTRICT_BPS,
    load,
    upper,
)

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_WORKBOOK = ROOT / "profilkes_2025.xlsx"
SQL_FILES = ("db/01_schema.sql", "db/02_views.sql", "db/03_public_views.sql")


def apply_sql(conn: psycopg.Connection, path: Path) -> None:
    """Run one .sql file. The files are plain SQL, no psql meta-commands."""
    conn.execute(path.read_text())
    print(f"  applied {path.relative_to(ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("workbook", type=Path, nargs="?", default=DEFAULT_WORKBOOK)
    parser.add_argument("--dsn", default=os.environ.get("DATABASE_URL", DEFAULT_DSN))
    parser.add_argument("--province", default=PROVINCE_NAME)
    parser.add_argument("--province-bps", default=PROVINCE_BPS)
    parser.add_argument("--district-bps", default=DISTRICT_BPS)
    parser.add_argument(
        "--skip-load",
        action="store_true",
        help="only apply the schema and the views, do not load the workbook",
    )
    args = parser.parse_args()

    if not args.skip_load and not args.workbook.exists():
        raise SystemExit(f"workbook not found: {args.workbook}")

    print(f"Database : {args.dsn}")
    try:
        with psycopg.connect(args.dsn, autocommit=True) as conn:
            print("\nSchema")
            for name in SQL_FILES:
                apply_sql(conn, ROOT / name)
    except psycopg.Error as error:
        raise SystemExit(
            f"\nCannot reach the database ({error}).\n"
            "Start it first:  docker compose up -d db"
        ) from error

    if args.skip_load:
        print("\nSchema ready (workbook not loaded).")
        return

    print()
    load(
        args.workbook,
        args.dsn,
        upper(args.province),
        args.province_bps,
        args.district_bps,
    )


if __name__ == "__main__":
    main()
