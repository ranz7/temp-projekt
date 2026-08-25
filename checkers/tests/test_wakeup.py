"""
The Redis wake-up listener.

A nudge only ever saves a second of waiting, so every failure has to end in the
worker polling instead of the worker stopping.
"""

from __future__ import annotations

import unittest

from common.wakeup import SleepOnlyListener, WakeUpListener, _last_entry_id


class FakeRedis:
    def __init__(self, entries=None, fail_on_read: Exception | None = None) -> None:
        self.entries = entries if entries is not None else []
        self.fail_on_read = fail_on_read
        self.reads = 0
        self.closed = False

    def ping(self) -> bool:
        return True

    def xread(self, streams, count=None, block=None):
        self.reads += 1

        if self.fail_on_read is not None:
            raise self.fail_on_read
        return self.entries

    def close(self) -> None:
        self.closed = True


class WakeUpListenerTests(unittest.TestCase):
    def _listener(self, factory, slept: list[float], clock: list[float]) -> WakeUpListener:
        return WakeUpListener(
            "redis://cache:6379",
            "oj.submissions",
            client_factory=factory,
            monotonic=lambda: clock[0],
            sleep=slept.append,
        )

    def test_a_nudge_is_reported(self) -> None:
        slept: list[float] = []
        redis = FakeRedis([(b"oj.submissions", [(b"1-0", {b"submissionId": b"abc"})])])
        listener = self._listener(lambda: redis, slept, [0.0])

        self.assertTrue(listener.wait(1.0))
        self.assertEqual(slept, [])

    def test_no_nudge_is_not_an_error(self) -> None:
        slept: list[float] = []
        listener = self._listener(lambda: FakeRedis([]), slept, [0.0])

        self.assertFalse(listener.wait(1.0))

    def test_a_redis_that_is_not_there_becomes_plain_polling(self) -> None:
        slept: list[float] = []

        def broken():
            raise ConnectionError("connection refused")

        listener = self._listener(broken, slept, [0.0])

        self.assertFalse(listener.wait(1.0))
        self.assertEqual(slept, [1.0])
        # The next turn does not hammer a Redis that is down.
        self.assertFalse(listener.wait(1.0))
        self.assertEqual(slept, [1.0, 1.0])

    def test_a_redis_that_breaks_mid_read_becomes_plain_polling(self) -> None:
        slept: list[float] = []
        redis = FakeRedis(fail_on_read=RuntimeError("connection reset"))
        listener = self._listener(lambda: redis, slept, [0.0])

        self.assertFalse(listener.wait(0.5))
        self.assertEqual(slept, [0.5])
        self.assertTrue(redis.closed)

    def test_the_newest_entry_id_is_remembered(self) -> None:
        entries = [(b"oj.submissions", [(b"1-0", {}), (b"2-0", {})])]

        self.assertEqual(_last_entry_id(entries), "2-0")
        self.assertIsNone(_last_entry_id([]))


class SleepOnlyListenerTests(unittest.TestCase):
    def test_it_only_waits(self) -> None:
        slept: list[float] = []
        listener = SleepOnlyListener(sleep=slept.append)

        self.assertFalse(listener.wait(0.25))
        self.assertEqual(slept, [0.25])
        listener.close()


if __name__ == "__main__":
    unittest.main()
