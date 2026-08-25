"""
The HTTP client for OIOIOI.

Ported from the reference adapter (`sprawdzarka/oioioi_client.py`). One submit, then
the submission report is polled. Failures are split into the two kinds that matter:
OIOIOI is unreachable, which means the job goes back to the queue, and OIOIOI refused
the submission, which is a real answer about this submission.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Callable
from uuid import uuid4

UrlOpen = Callable[..., Any]

# A submission OIOIOI has not finished with yet.
STILL_RUNNING = frozenset({"", "?", "QUE", None})

# Statuses that end the wait without a complete report.
EARLY_FAILURE = frozenset({"CE", "SE", "INI_ERR", "ERR"})


class OioioiError(RuntimeError):
    """OIOIOI could not be used for this submission."""


class OioioiUnavailable(OioioiError):
    """OIOIOI is unreachable or not configured, so the job waits for it."""


class OioioiHttpError(OioioiError):
    """OIOIOI answered, and said no."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(f"HTTP {status}: {message}")
        self.status = status
        self.message = message


class OioioiSubmitUncertain(OioioiUnavailable):
    """The submit may or may not have arrived, so it is never sent again blindly."""


def parse_score(value: object) -> int | None:
    """OIOIOI reports numbers as numbers or as text; both mean the same thing."""
    if value is None or value == "" or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value

    text = str(value).strip()

    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        try:
            return int(float(text))
        except ValueError:
            return None


def parse_submit_id(body: bytes | str) -> int:
    text = body.decode("utf-8") if isinstance(body, bytes) else body
    text = text.strip()

    if not text:
        raise OioioiError("the submit answer was empty")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        parsed = text
    try:
        return int(parsed)
    except (TypeError, ValueError) as error:
        raise OioioiError(f"the submit answer was not a submission id: {text[:200]!r}") from error


def is_still_running(status: str | None) -> bool:
    return status in STILL_RUNNING


def is_early_failure(status: str | None) -> bool:
    """A compile error or a system error ends the wait without a full report."""
    return status in EARLY_FAILURE


def report_is_complete(report: dict | None) -> bool:
    return bool(report) and report.get("complete") is True


class OioioiClient:
    """Talks to one OIOIOI contest."""

    def __init__(
        self,
        url: str,
        token: str,
        contest_id: str,
        *,
        timeout_seconds: float = 10.0,
        urlopen: UrlOpen | None = None,
    ) -> None:
        if not url or not token or not contest_id:
            raise OioioiUnavailable(
                "OIOIOI_URL, OIOIOI_TOKEN and OIOIOI_CONTEST_ID are all required"
            )
        self.url = url.rstrip("/")
        self.token = token
        self.contest_id = contest_id
        self.timeout_seconds = timeout_seconds
        self._urlopen = urlopen or urllib.request.urlopen

    def submit(self, short_name: str, code: str) -> int:
        """Send the source once. A lost answer is never retried on its own."""
        boundary = "----OioioiForm" + uuid4().hex
        payload = (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="file"; filename="main.cpp"\r\n'
            "Content-Type: text/x-c++src\r\n"
            "\r\n"
            f"{code}"
            "\r\n"
            f"--{boundary}--\r\n"
        ).encode("utf-8")
        request = urllib.request.Request(
            f"{self.url}/api/c/{self.contest_id}/submit/{short_name}",
            data=payload,
            method="POST",
            headers={
                "Authorization": f"Token {self.token}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
        )

        try:
            with self._urlopen(request, timeout=self.timeout_seconds) as response:
                body = response.read()
                status = int(getattr(response, "status", 200) or 200)

                if status != 200:
                    raise OioioiHttpError(status, body.decode("utf-8", "replace"))
                return parse_submit_id(body)
        except OioioiError:
            raise
        except urllib.error.HTTPError as error:
            raise self._http_error(error) from error
        except TimeoutError as error:
            raise OioioiSubmitUncertain("OIOIOI did not answer the submit in time") from error
        except urllib.error.URLError as error:
            reason = str(getattr(error, "reason", error))

            if "timed out" in reason.lower() or "timeout" in reason.lower():
                raise OioioiSubmitUncertain(
                    "OIOIOI did not answer the submit in time"
                ) from error
            raise OioioiUnavailable(f"OIOIOI could not be reached: {reason}") from error
        except OSError as error:
            raise OioioiUnavailable(f"OIOIOI could not be reached: {error}") from error

    def _json_get(self, path: str, label: str) -> dict:
        request = urllib.request.Request(
            f"{self.url}{path}",
            method="GET",
            headers={
                "Authorization": f"Token {self.token}",
                "Accept": "application/json",
            },
        )

        try:
            with self._urlopen(request, timeout=self.timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            raise self._http_error(error) from error
        except (TimeoutError, urllib.error.URLError, OSError) as error:
            raise OioioiUnavailable(f"{label} could not be read: {error}") from error
        except json.JSONDecodeError as error:
            raise OioioiError(f"{label} was not JSON") from error

    def get_submission_report(self, oioioi_id: int) -> dict:
        return self._json_get(
            f"/api/c/{self.contest_id}/submission_report/{int(oioioi_id)}/",
            "the submission report",
        )

    def list_submissions(self, short_name: str) -> dict:
        return self._json_get(
            f"/api/c/{self.contest_id}/problem_submission_list/{short_name}/",
            "the submission list",
        )

    def _http_error(self, error: urllib.error.HTTPError) -> OioioiError:
        raw = error.read().decode("utf-8", "replace")
        status = int(getattr(error, "code", 0) or getattr(error, "status", 0) or 0)
        message = raw

        try:
            parsed = json.loads(raw)

            if isinstance(parsed, dict):
                message = json.dumps(parsed, ensure_ascii=False)
        except json.JSONDecodeError:
            pass

        # A rate limit or a broken OIOIOI is an outage, not an answer about this code.
        if status == 429 or status >= 500:
            return OioioiUnavailable(f"OIOIOI answered HTTP {status}: {message}")
        return OioioiHttpError(status, message or f"HTTP {status}")
