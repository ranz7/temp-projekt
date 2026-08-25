"""
Lease heartbeats.

While a job is being judged a background thread extends its lease every
`CHECKER_HEARTBEAT_SECONDS`, so the app's sweeper does not decide the worker died.
A failing heartbeat is logged and retried; only the app can end the claim.
"""

from __future__ import annotations

import logging
import threading

logger = logging.getLogger(__name__)


class Heartbeat:
    """Beats for one claim, from `start()` until `stop()`."""

    def __init__(self, client, submission_id: str, claim_id: str, interval_seconds: float) -> None:
        self._client = client
        self._submission_id = submission_id
        self._claim_id = claim_id
        self._interval_seconds = max(0.1, float(interval_seconds))
        self._stop = threading.Event()
        self._thread = threading.Thread(
            target=self._run, name=f"heartbeat-{submission_id[:8]}", daemon=True
        )

    def _run(self) -> None:
        while not self._stop.wait(self._interval_seconds):
            try:
                self._client.heartbeat(self._submission_id, self._claim_id)
            except Exception as error:
                logger.warning(
                    "Heartbeat for submission %s failed: %s", self._submission_id, error
                )

    def start(self) -> Heartbeat:
        self._thread.start()
        return self

    def stop(self) -> None:
        self._stop.set()

        if self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def __enter__(self) -> Heartbeat:
        return self.start()

    def __exit__(self, *_exception: object) -> None:
        self.stop()
