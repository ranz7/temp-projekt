"""
Redis wake-up listener.

A stream entry is a nudge and never the source of truth: the worker claims from the
app whether or not one arrives. When Redis is missing, unreachable or broken, the
listener quietly degrades into a plain sleep, so a Redis outage only makes judging a
little slower.
"""

from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

# How long a failing connection is left alone before the next attempt.
RECONNECT_BACKOFF_SECONDS = 5.0


class WakeUpListener:
    """Blocks until a submission is announced, or until the timeout runs out."""

    def __init__(
        self,
        url: str,
        stream: str,
        *,
        client_factory: Any | None = None,
        monotonic: Any = time.monotonic,
        sleep: Any = time.sleep,
    ) -> None:
        self.url = url
        self.stream = stream
        self._client_factory = client_factory or self._default_client_factory
        self._monotonic = monotonic
        self._sleep = sleep
        self._client: Any | None = None
        self._last_id = "$"
        self._retry_after = 0.0
        self._announced_outage = False

    def _default_client_factory(self) -> Any:
        import redis  # imported lazily so the workers start without the package

        return redis.Redis.from_url(self.url, socket_timeout=None, socket_connect_timeout=2)

    def _connect(self) -> Any | None:
        if self._client is not None:
            return self._client
        if self._monotonic() < self._retry_after:
            return None

        try:
            client = self._client_factory()
            client.ping()
        except Exception as error:  # any client, any failure mode
            self._retry_after = self._monotonic() + RECONNECT_BACKOFF_SECONDS

            if not self._announced_outage:
                logger.warning(
                    "Redis wake-ups are unavailable (%s); polling for work instead.", error
                )
                self._announced_outage = True
            return None

        self._client = client
        self._announced_outage = False
        logger.info("Listening for wake-ups on the %s stream.", self.stream)
        return client

    def wait(self, timeout_seconds: float) -> bool:
        """Wait for a nudge. Returns whether one arrived; the caller claims either way."""
        client = self._connect()

        if client is None:
            self._sleep(timeout_seconds)
            return False

        try:
            entries = client.xread(
                {self.stream: self._last_id}, count=1, block=max(1, int(timeout_seconds * 1000))
            )
        except Exception as error:
            logger.warning("The wake-up stream failed (%s); polling for work instead.", error)
            self.close()
            self._retry_after = self._monotonic() + RECONNECT_BACKOFF_SECONDS
            self._announced_outage = True
            self._sleep(timeout_seconds)
            return False

        if not entries:
            return False

        self._last_id = _last_entry_id(entries) or self._last_id
        return True

    def close(self) -> None:
        client, self._client = self._client, None

        if client is None:
            return
        try:
            client.close()
        except Exception:
            pass


def _last_entry_id(entries: Any) -> str | None:
    """Pull the newest entry id out of an XREAD answer, whatever its exact shape."""
    try:
        _stream_name, stream_entries = entries[-1]
        entry_id = stream_entries[-1][0]
    except (IndexError, TypeError, ValueError):
        return None

    if isinstance(entry_id, bytes):
        return entry_id.decode("utf-8", "replace")
    return str(entry_id)


class SleepOnlyListener:
    """The listener used when a worker is configured without Redis at all."""

    def __init__(self, sleep: Any = time.sleep) -> None:
        self._sleep = sleep

    def wait(self, timeout_seconds: float) -> bool:
        self._sleep(timeout_seconds)
        return False

    def close(self) -> None:
        return None

