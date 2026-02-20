"""
Supabase ingestion client for SafeStay AI CV metadata.

Responsibilities:
- Maintain a rolling in-memory count of entry events per room per hour
- Batch-write cv_events rows to Supabase on a configurable interval
- Call the `score-risk` edge function after each ingestion batch
  to trigger risk score recalculation

TODO: Implement the Ingestor class
"""

from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from detector import DetectionResult

# TODO: from supabase import create_client, Client
# TODO: from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, INGEST_INTERVAL_SECONDS


class Ingestor:
    """
    Accumulates detection results and writes cv_events to Supabase.

    Usage:
        ingestor = Ingestor()
        ingestor.record(detection_result)
        # call ingestor.flush() on a timer or after N records
    """

    def __init__(self) -> None:
        # TODO: self.client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        # Rolling deque of (timestamp, room_id) for entry events in the last hour
        self._entry_log: dict[str, deque[datetime]] = defaultdict(deque)
        self._pending: list["DetectionResult"] = []

    def record(self, result: "DetectionResult") -> None:
        """
        Buffer a detection result.
        Updates the rolling entry count for the room.

        TODO:
            1. If result.entry_event, push result.timestamp to self._entry_log[room_id]
            2. Evict timestamps older than 60 minutes from the deque
            3. Append result to self._pending
        """
        # TODO: implement
        pass

    def flush(self) -> None:
        """
        Write buffered cv_events to Supabase and trigger risk rescoring.

        TODO:
            1. For each result in self._pending, build an insert payload:
                 {
                   "room_id": result.room_id,
                   "person_count": result.person_count,
                   "entry_count": len(self._entry_log[result.room_id]),
                   "timestamp": result.timestamp.isoformat(),
                 }
            2. Batch-insert into cv_events table
            3. Invoke the score-risk edge function for each unique room_id
            4. Clear self._pending
        """
        # TODO: implement
        pass

    def _entries_in_last_hour(self, room_id: str) -> int:
        """Returns the number of entry events in the last 60 minutes for a room."""
        cutoff = datetime.utcnow() - timedelta(minutes=60)
        return sum(1 for t in self._entry_log[room_id] if t >= cutoff)
