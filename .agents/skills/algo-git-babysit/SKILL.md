---
name: algo-git-babysit
description: Drive an open PR to merge-ready — watch CI, fix red runs, answer and resolve review comments. Use after algo-git-pr, when the user says "babysit the PR", or under /loop on an open PR.
allowed-tools: Bash(git:*), Bash(gh:*), Bash(bun:*), Bash(bun run:*), Read, Edit, Write, Grep, Glob
---

PR from `$ARGUMENTS` or the current branch (`gh pr view`). Runs as a self-paced `/loop`: one pass of steps 1-5 per wakeup, then `ScheduleWakeup` with this same skill as the prompt. A single pass is not babysitting - the loop lives across turns and has exactly two endings: `state: MERGED` at step 5, or the user stopping it. Fix red yourself — a failing test, lint, typecheck, or build is the loop's job, not a question for the user.

**Backoff** — `delaySeconds` climbs a minute at a time for the first four quiet passes, then doubles: 60, 120, 180, 240, 480, 960, 1920, then a 3600 ceiling. The slow start is deliberate - the minutes right after a push are when CI lands and when a reviewer who was told about the PR looks at it, and a loop that jumps straight to eight minutes reports that news long after the human could have. Quiet means the pass found nothing new and did nothing. A pass that acts drops the next delay back to 60 — a fix pushed, a reply posted, a check turning red, a fresh comment, a review landing, the PR becoming mergeable or not.
The ladder is the delay for a loop that nothing else wakes, and it is where a pass with a run still in flight belongs: waiting on CI, the loop is back at the short rungs and each pass tells the human the run is still going.
The one departure is a watcher already armed on the exact event, such as `gh pr checks <pr> --watch` in the background, which wakes the loop the moment the run lands: then the ladder is redundant and `delaySeconds` becomes a 1200-1800 fallback in case the watcher dies.
Whichever applies, the pass report names the delay and the reason for it in the same breath, so the human reads the cadence as a choice rather than a mystery.

**Pass report** — every pass ends in its own chat block, standing alone rather than folded into a calling skill's report, because that block is the human's only sign the loop is alive.
Line one is the banner `babysit pass <n> · PR #<number> · checks <state> · next in <delay>`.
Then the three sweep lines from step 2, then one line per thing the pass changed.
A pass whose banner never reached the chat reads to the human as a loop that never started, whatever the loop actually did.

1. **CI** — `gh pr checks`; red → pull the failing log, fix, `algo-git-commit`, push. Tests, lint, typecheck, build: fix them. **Preview deployment is not yours** — a red deploy/preview/Dokploy check is infra, so report it in one line and keep going on everything else; never patch app code to appease it.
2. **Feedback** — CI is half the job. Three surfaces carry it, and a pass reads all three every time, bots included: PR-level comments (`gh pr view --json comments` — where a human types prose at the whole PR, and the surface a green-CI pass most often skips), unresolved inline threads (`gh api graphql`, `pullRequest.reviewThreads`), review verdicts (`gh pr view --json reviews`, `CHANGES_REQUESTED` blocks ready). Read each item's full body, not its count — the loop's own evidence comment is the one item that is never new.

   ```bash
   gh pr view "$PR" --json comments --jq '.comments[] | "COMMENT \(.author.login) \(.createdAt)\n\(.body)"'
   gh pr view "$PR" --json reviews --jq '.reviews[] | "REVIEW \(.author.login) \(.state)\n\(.body)"'
   gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:50){nodes{isResolved path line comments(first:10){nodes{author{login} body}}}}}}}' -F o=OWNER -F r=REPO -F n="$PR" --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved==false)'
   ```

   Each item lands in one of three: trivial and objectively true → fix, reply one line, resolve the thread via `resolveReviewThread`; changes product behaviour → `patch-spec` or surface it and stop; anything else → reply your position and leave it for the human. A human comment asking for work is work — act on it in this pass, never bank it for a later one. The pass report quotes the newest comment, review and thread it read, or says `no comments / no reviews / no threads`; a report without those three lines means the sweep did not happen and the pass is not done.
3. **Conflicts** — `resolving-merge-conflicts`, on every pass where the PR is not mergeable.
4. **Ready** — green checks (preview aside) + zero unresolved threads + no outstanding `CHANGES_REQUESTED` → report `ready to merge: <url>`, one line. Merge is the human's click; keep looping. Green is the state the loop exists to hold, so a green pass schedules the next wakeup exactly like a red one: `main` moves under an untouched PR and turns it conflicted, a reviewer arrives hours later, a check gets re-run. The loop is the standing offer to catch all three before the human does.
5. **Merged** — `gh pr view --json state` says MERGED → `git checkout main && git pull`, delete the local branch, report the fresh `main` SHA in one line, stop the loop.
