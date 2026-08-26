"""
The checker's own HTTP service, exercised over a real socket.

Every test here runs against a server bound to a free loopback port, with a stubbed
judge in place of the sandbox, so the suite needs no compiler and no bubblewrap.
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
import threading
import time
import unittest
import uuid
from http.client import HTTPConnection
from pathlib import Path
from typing import Any, Callable

CHECKERS_ROOT = Path(__file__).resolve().parents[1]

if str(CHECKERS_ROOT) not in sys.path:
    sys.path.insert(0, str(CHECKERS_ROOT))

from common.config import CheckerConfig  # noqa: E402
from common.contract import (  # noqa: E402
    ACCEPTED,
    CONTRACT_VERSION,
    INTERNAL_ERROR,
    PASSED,
    FinalReport,
    JudgeRequest,
    TestReport,
)
from common.jobs import JobRegistry  # noqa: E402
from common.service import create_server  # noqa: E402

SERVICE_KEY = "a-shared-key"


def new_uuid() -> str:
    return str(uuid.uuid4())


def accepted_report() -> FinalReport:
    return FinalReport(
        status=ACCEPTED,
        score=20,
        max_score=20,
        compile_message=None,
        max_cpu_ms=12,
        max_memory_kb=4096,
        tests=[
            TestReport(
                ordinal=1,
                visibility="public",
                verdict=PASSED,
                passed=True,
                points_awarded=0,
                message=None,
                actual_output="YES\n",
                time_ms=10,
                memory_kb=4096,
            )
        ],
    )


class Answer:
    """One HTTP answer, read whole."""

    def __init__(self, status: int, body: bytes) -> None:
        self.status = status
        self.raw = body

    @property
    def payload(self) -> dict[str, Any]:
        return json.loads(self.raw.decode("utf-8"))


class ServiceTestCase(unittest.TestCase):
    """A running service, its stub judge and the calls made against it."""

    def start_service(
        self,
        judge: Callable[..., FinalReport],
        *,
        capacity: int = 2,
        service_key: str | None = SERVICE_KEY,
        packages: list[str] | None = None,
    ) -> None:
        root = Path(tempfile.mkdtemp(prefix="checker-test-"))
        self.addCleanup(shutil.rmtree, root, True)
        self.packages_path = root / "problems"
        self.scratch_path = root / "scratch"

        for package in packages or []:
            (self.packages_path / package / "tests").mkdir(parents=True)
            (self.packages_path / package / "problem.json").write_text("{}", encoding="utf-8")
        self.packages_path.mkdir(parents=True, exist_ok=True)

        self.config = CheckerConfig(
            service_key=service_key,
            problem_packages_path=self.packages_path,
            scratch_path=self.scratch_path,
            bind="127.0.0.1",
            port=0,
            capacity=capacity,
            result_ttl_seconds=900.0,
            shutdown_grace_seconds=5.0,
            judge_entry_point="unused.in:tests",
            version="test-version",
        )
        self.registry = JobRegistry(
            judge,
            packages_path=self.packages_path,
            scratch_root=self.scratch_path,
            capacity=capacity,
            result_ttl_seconds=900.0,
        )
        self.server = create_server(self.config, self.registry)
        self.port = self.server.server_address[1]
        thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(thread.join, 5)
        self.addCleanup(self.registry.shutdown, 5)
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    # -- calls ------------------------------------------------------------------

    def call(
        self,
        method: str,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        key: str | None = SERVICE_KEY,
    ) -> Answer:
        connection = HTTPConnection("127.0.0.1", self.port, timeout=5)
        headers = {"Content-Type": "application/json"}

        if key is not None:
            headers["X-Service-Key"] = key

        connection.request(
            method,
            path,
            body=None if body is None else json.dumps(body),
            headers=headers,
        )
        response = connection.getresponse()
        answer = Answer(response.status, response.read())
        connection.close()
        return answer

    def judge_request_body(self, submission_id: str, **overrides: Any) -> dict[str, Any]:
        body = {
            "contractVersion": CONTRACT_VERSION,
            "submissionId": submission_id,
            "problemSlug": "combo",
            "packageDirectory": "combo",
            "language": "cpp",
            "sourceCode": "int main() {}\n",
        }
        body.update(overrides)
        return body

    def wait_for_result(self, job_id: str, seconds: float = 5.0) -> dict[str, Any]:
        deadline = time.monotonic() + seconds

        while time.monotonic() < deadline:
            answer = self.call("GET", f"/judge/{job_id}")
            self.assertEqual(answer.status, 200)

            if answer.payload["status"] == "done":
                return answer.payload
            time.sleep(0.02)

        self.fail(f"job {job_id} did not finish within {seconds} seconds")


class HealthTests(ServiceTestCase):
    def test_health_answers_without_a_key(self) -> None:
        self.start_service(lambda *_a, **_k: accepted_report(), packages=["combo", "cf-4-A"])

        answer = self.call("GET", "/health", key=None)

        self.assertEqual(answer.status, 200)
        self.assertEqual(
            answer.payload,
            {
                "contractVersion": CONTRACT_VERSION,
                "ok": True,
                "busy": 0,
                "capacity": 2,
                "problems": ["cf-4-A", "combo"],
                "version": "test-version",
            },
        )

    def test_health_still_answers_when_no_key_is_configured(self) -> None:
        self.start_service(lambda *_a, **_k: accepted_report(), service_key=None)

        self.assertEqual(self.call("GET", "/health", key=None).status, 200)
        self.assertEqual(
            self.call("POST", "/judge", body=self.judge_request_body(new_uuid())).status,
            401,
        )


class AuthenticationTests(ServiceTestCase):
    def setUp(self) -> None:
        self.calls: list[JudgeRequest] = []

        def judge(request: JudgeRequest, **_kwargs: Any) -> FinalReport:
            self.calls.append(request)
            return accepted_report()

        self.start_service(judge)

    def test_a_call_without_a_key_is_refused_and_judges_nothing(self) -> None:
        answer = self.call("POST", "/judge", body=self.judge_request_body(new_uuid()), key=None)

        self.assertEqual(answer.status, 401)
        self.assertEqual(answer.payload["contractVersion"], CONTRACT_VERSION)
        self.assertEqual(self.calls, [])

    def test_a_wrong_key_is_refused_and_judges_nothing(self) -> None:
        answer = self.call(
            "POST", "/judge", body=self.judge_request_body(new_uuid()), key="not-the-key"
        )

        self.assertEqual(answer.status, 401)
        self.assertEqual(self.calls, [])

    def test_reading_a_result_needs_the_key_too(self) -> None:
        self.assertEqual(self.call("GET", "/judge/anything", key=None).status, 401)


class ContractVersionTests(ServiceTestCase):
    def setUp(self) -> None:
        self.calls: list[JudgeRequest] = []

        def judge(request: JudgeRequest, **_kwargs: Any) -> FinalReport:
            self.calls.append(request)
            return accepted_report()

        self.start_service(judge)

    def test_another_contract_version_is_refused(self) -> None:
        answer = self.call(
            "POST",
            "/judge",
            body=self.judge_request_body(new_uuid(), contractVersion=1),
        )

        self.assertEqual(answer.status, 400)
        self.assertIn("contract version", answer.payload["error"])
        self.assertEqual(self.calls, [])

    def test_a_request_missing_a_field_is_refused(self) -> None:
        body = self.judge_request_body(new_uuid())
        del body["packageDirectory"]

        self.assertEqual(self.call("POST", "/judge", body=body).status, 400)
        self.assertEqual(self.calls, [])

    def test_a_package_directory_cannot_point_elsewhere(self) -> None:
        body = self.judge_request_body(new_uuid(), packageDirectory="../secrets")

        self.assertEqual(self.call("POST", "/judge", body=body).status, 400)
        self.assertEqual(self.calls, [])


class JudgingTests(ServiceTestCase):
    def test_a_submission_is_judged_and_its_result_read_back(self) -> None:
        seen: list[tuple[JudgeRequest, Path, Path]] = []

        def judge(
            request: JudgeRequest, *, packages_path: Path, scratch_path: Path
        ) -> FinalReport:
            seen.append((request, scratch_path, packages_path))
            self.assertTrue(scratch_path.is_dir())
            return accepted_report()

        self.start_service(judge)
        submission_id = new_uuid()

        started = self.call("POST", "/judge", body=self.judge_request_body(submission_id))

        self.assertEqual(started.status, 202)
        self.assertEqual(started.payload["contractVersion"], CONTRACT_VERSION)
        job_id = started.payload["jobId"]

        finished = self.wait_for_result(job_id)
        result = finished["result"]

        self.assertEqual(result["status"], ACCEPTED)
        self.assertEqual(result["score"], 20)
        self.assertEqual(result["maxScore"], 20)
        self.assertIsNone(result["compileMessage"])
        self.assertEqual(result["maxCpuMs"], 12)
        self.assertEqual(result["maxMemoryKb"], 4096)

        row = result["tests"][0]

        self.assertEqual(row["ordinal"], 1)
        self.assertEqual(row["visibility"], "public")
        self.assertEqual(row["verdict"], PASSED)
        self.assertTrue(row["passed"])
        self.assertNotIn("problemTestId", row)

        request, scratch, packages_path = seen[0]

        self.assertEqual(request.submission_id, submission_id)
        self.assertEqual(request.package_directory, "combo")
        self.assertEqual(packages_path, self.packages_path)
        self.assertFalse(scratch.exists(), "the job's scratch directory is deleted")

    def test_an_unknown_job_is_not_found(self) -> None:
        self.start_service(lambda *_a, **_k: accepted_report())

        answer = self.call("GET", "/judge/2b0f1c")

        self.assertEqual(answer.status, 404)
        self.assertEqual(answer.payload["contractVersion"], CONTRACT_VERSION)


class RepeatedSubmissionTests(ServiceTestCase):
    def test_the_same_submission_twice_is_judged_once(self) -> None:
        release = threading.Event()
        started = threading.Event()
        calls: list[JudgeRequest] = []

        def judge(request: JudgeRequest, **_kwargs: Any) -> FinalReport:
            calls.append(request)
            started.set()
            release.wait(5)
            return accepted_report()

        self.start_service(judge)
        self.addCleanup(release.set)
        submission_id = new_uuid()

        first = self.call("POST", "/judge", body=self.judge_request_body(submission_id))
        self.assertTrue(started.wait(5))
        second = self.call("POST", "/judge", body=self.judge_request_body(submission_id))

        self.assertEqual(first.status, 202)
        self.assertEqual(second.status, 202)
        self.assertEqual(first.payload["jobId"], second.payload["jobId"])
        self.assertEqual(len(calls), 1)

        running = self.call("GET", f"/judge/{first.payload['jobId']}")

        self.assertEqual(running.status, 200)
        self.assertEqual(running.payload, {"contractVersion": CONTRACT_VERSION, "status": "running"})

        release.set()
        self.wait_for_result(first.payload["jobId"])


class CapacityTests(ServiceTestCase):
    def test_a_full_checker_refuses_more_work(self) -> None:
        release = threading.Event()
        started = threading.Event()

        def judge(_request: JudgeRequest, **_kwargs: Any) -> FinalReport:
            started.set()
            release.wait(5)
            return accepted_report()

        self.start_service(judge, capacity=1)
        self.addCleanup(release.set)

        first = self.call("POST", "/judge", body=self.judge_request_body(new_uuid()))
        self.assertTrue(started.wait(5))
        second = self.call("POST", "/judge", body=self.judge_request_body(new_uuid()))

        self.assertEqual(first.status, 202)
        self.assertEqual(second.status, 503)
        self.assertIn("takes no more", second.payload["error"])

        health = self.call("GET", "/health", key=None)

        self.assertEqual(health.payload["busy"], 1)
        self.assertEqual(health.payload["capacity"], 1)

        release.set()
        self.wait_for_result(first.payload["jobId"])


class BrokenJudgeTests(ServiceTestCase):
    def test_a_judge_that_raises_becomes_an_internal_error(self) -> None:
        def judge(_request: JudgeRequest, **_kwargs: Any) -> FinalReport:
            raise RuntimeError("the sandbox fell over")

        self.start_service(judge)

        started = self.call("POST", "/judge", body=self.judge_request_body(new_uuid()))
        finished = self.wait_for_result(started.payload["jobId"])

        self.assertEqual(finished["result"]["status"], INTERNAL_ERROR)
        self.assertIn("the sandbox fell over", finished["result"]["compileMessage"])
        self.assertEqual(finished["result"]["tests"], [])

        self.assertEqual(self.call("GET", "/health", key=None).status, 200)
        self.assertEqual(self.call("GET", "/health", key=None).payload["busy"], 0)

    def test_the_service_keeps_judging_after_a_crash(self) -> None:
        answers = [RuntimeError("first one exploded"), accepted_report()]

        def judge(_request: JudgeRequest, **_kwargs: Any) -> FinalReport:
            answer = answers.pop(0)

            if isinstance(answer, Exception):
                raise answer
            return answer

        self.start_service(judge)

        broken = self.call("POST", "/judge", body=self.judge_request_body(new_uuid()))
        self.wait_for_result(broken.payload["jobId"])

        good = self.call("POST", "/judge", body=self.judge_request_body(new_uuid()))
        finished = self.wait_for_result(good.payload["jobId"])

        self.assertEqual(finished["result"]["status"], ACCEPTED)


if __name__ == "__main__":
    unittest.main()
