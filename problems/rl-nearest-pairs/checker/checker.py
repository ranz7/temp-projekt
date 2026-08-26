#!/usr/bin/env python3
from __future__ import annotations
import sys


def fail(message: str) -> None:
    print("0")
    print(message, file=sys.stderr)
    raise SystemExit(0)


def main() -> None:
    if len(sys.argv) != 4:
        fail("expected: checker.py input expected actual")
    values = list(map(int, open(sys.argv[1], encoding="utf-8").read().split()))
    pair_count = values[0]
    weights = values[1:1 + 2 * pair_count]
    tokens = open(sys.argv[3], encoding="utf-8").read().split()
    if len(tokens) != 2 * pair_count:
        fail("wrong number of indices")
    try:
        ids = list(map(int, tokens))
    except ValueError:
        fail("indices must be integers")
    if sorted(ids) != list(range(1, 2 * pair_count + 1)):
        fail("every index must appear exactly once")
    actual_cost = 0
    for i in range(0, len(ids), 2):
        actual_cost += abs(weights[ids[i]-1] - weights[ids[i+1]-1])
    ordered = sorted(weights)
    optimum = sum(abs(ordered[i] - ordered[i+1]) for i in range(0, len(ordered), 2))
    if actual_cost != optimum:
        fail(f"pairing cost {actual_cost}, optimum {optimum}")
    print("1")


if __name__ == "__main__":
    main()
