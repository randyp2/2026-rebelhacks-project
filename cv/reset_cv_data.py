"""
Reset CV ingestion data in Supabase.

Deletes all rows from:
  - cv_risk_evidence
  - cv_frame_analysis
  - cv_video_summaries
  - cv_events

Environment variables:
  SUPABASE_URL
  SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from supabase import create_client


TABLES = (
    ("cv_risk_evidence", "id"),
    ("cv_frame_analysis", "id"),
    ("cv_video_summaries", "video_id"),
    ("cv_events", "id"),
)


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def count_rows(client, table: str) -> int:
    response = client.table(table).select("*", count="exact", head=True).execute()
    return int(response.count or 0)


def delete_all_rows(client, table: str, pk_column: str) -> None:
    # Supabase PostgREST delete needs a filter. "is not null" matches all real rows.
    client.table(table).delete().not_.is_(pk_column, "null").execute()


def main() -> None:
    load_dotenv()
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

    supabase_url = require_env("SUPABASE_URL")
    service_key = (
        os.getenv("SUPABASE_SERVICE_KEY", "").strip()
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    )
    if not service_key:
        raise RuntimeError(
            "Missing SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY"
        )

    client = create_client(supabase_url, service_key)

    print("CV data reset starting...")
    for table, _ in TABLES:
        print(f"  before {table}: {count_rows(client, table)}")

    for table, pk in TABLES:
        delete_all_rows(client, table, pk)

    print("CV data reset complete.")
    for table, _ in TABLES:
        print(f"  after  {table}: {count_rows(client, table)}")


if __name__ == "__main__":
    main()
