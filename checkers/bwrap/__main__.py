"""
Judging one submission from the command line: `python -m bwrap <request.json>`.

The request is the JSON the judge is normally handed - `submissionId`, `problemSlug`,
`packageDirectory`, `language`, `sourceCode` - read from a file or from standard input
when the file is `-`. The report is printed as JSON. This exists so a machine can be
checked by hand; the checker service calls `bwrap.run_judge` directly.
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

from .judge import problem_packages_path, run_judge, scratch_root
from .package import PackageError
from .report import JudgeCancelled, JudgeRequest, ReportError
from .spawn import bwrap_path, resolve_sandbox_mode

logger = logging.getLogger("bwrap")

USAGE = "usage: python -m bwrap <request.json|->"


def _read_request(argument: str) -> JudgeRequest:
    raw = sys.stdin.read() if argument == "-" else Path(argument).read_text(encoding="utf-8")
    return JudgeRequest.from_payload(json.loads(raw))


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    arguments = list(sys.argv[1:] if argv is None else argv)

    if len(arguments) != 1:
        logger.error("%s", USAGE)
        return 2

    try:
        mode = resolve_sandbox_mode()
    except ValueError as error:
        logger.error("%s", error)
        return 2

    if mode == "none":
        logger.warning(
            "JUDGE_SANDBOX=none: submissions run with no sandbox at all. "
            "Only ever do this on a development machine, with code you wrote yourself."
        )
    elif bwrap_path() is None:
        logger.error(
            "bubblewrap is not installed and JUDGE_SANDBOX is not none, so no "
            "submission could be run safely. Install bubblewrap or set BWRAP_PATH."
        )
        return 2

    try:
        request = _read_request(arguments[0])
    except (OSError, ValueError, ReportError) as error:
        logger.error("The request cannot be read: %s", error)
        return 2

    try:
        result = run_judge(
            request, packages_path=problem_packages_path(), scratch_path=scratch_root()
        )
    except PackageError as error:
        logger.error("This machine cannot judge that problem: %s", error)
        return 1
    except JudgeCancelled as error:
        logger.error("Judging stopped: %s", error)
        return 1

    print(json.dumps(result.to_payload(), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
