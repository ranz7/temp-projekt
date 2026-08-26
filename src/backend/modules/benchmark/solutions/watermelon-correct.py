"""Watermelon (cf-4-A) - correct.

A weight can be split into two positive even parts exactly when it is even and
greater than two.
"""

import sys


def main() -> None:
    weight = int(sys.stdin.buffer.read().split()[0])
    print("YES" if weight > 2 and weight % 2 == 0 else "NO")


main()
