# The C++ checker: a thin HTTP client that hands a submission to OIOIOI and
# translates its answer back. It compiles nothing and runs nothing, so it needs
# no sandbox and no extra privilege at all - it runs as an unprivileged user.

FROM python:3.13-slim-trixie

RUN pip install --no-cache-dir "redis==8.1.0"

WORKDIR /app
COPY checkers/common ./common
COPY checkers/cpp ./cpp
COPY checkers/pyproject.toml ./pyproject.toml

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV CHECKER_HEALTH_PORT=8080
ENV CHECKER_SCRATCH_PATH=/scratch
ENV PROBLEM_PACKAGES_PATH=/problems

RUN addgroup --system --gid 1001 checker \
 && adduser --system --uid 1001 --ingroup checker checker \
 && mkdir -p /scratch \
 && chown checker:checker /scratch
VOLUME ["/scratch"]

USER checker

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=5s --start-period=15s --retries=3 \
  CMD python3 -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ['CHECKER_HEALTH_PORT'] + '/health', timeout=3)" || exit 1

# No shell in front of it: Python is PID 1 and handles SIGTERM itself.
ENTRYPOINT ["python3", "-m", "cpp"]
