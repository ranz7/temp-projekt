"""
The worker health endpoint.

`GET /health` answers 200 for as long as the worker process lives, which is all a
container healthcheck needs. It is a standard-library HTTP server on purpose: a
worker should not carry a web framework just to say "still here".
"""

from __future__ import annotations

import logging
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

logger = logging.getLogger(__name__)


class _HealthHandler(BaseHTTPRequestHandler):
    server_version = "oj-checker"

    def do_GET(self) -> None:  # noqa: N802 - the name comes from the standard library
        path = self.path.split("?", 1)[0].rstrip("/") or "/"

        if path != "/health":
            self.send_error(404, "not found")
            return

        body = b'{"status":"ok"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args: object) -> None:
        """Healthchecks run every few seconds; they do not belong in the log."""
        return None


class HealthServer:
    """Serves `/health` on a background thread."""

    def __init__(self, port: int, host: str = "0.0.0.0") -> None:
        self._server = ThreadingHTTPServer((host, port), _HealthHandler)
        self._server.daemon_threads = True
        self._thread = threading.Thread(
            target=self._server.serve_forever, name="health", daemon=True
        )

    @property
    def port(self) -> int:
        return int(self._server.server_address[1])

    def start(self) -> None:
        self._thread.start()
        logger.info("Health endpoint listening on port %s.", self.port)

    def stop(self) -> None:
        self._server.shutdown()
        self._server.server_close()
