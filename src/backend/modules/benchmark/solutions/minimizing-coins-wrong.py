"""Minimizing Coins - deliberately wrong.

Takes the largest coin that still fits, over and over. That is optimal only for
canonical coin systems, so most denomination sets come out too large or as an
unnecessary -1.
"""

import sys


def main() -> None:
    data = sys.stdin.buffer.read().split()
    count = int(data[0])
    target = int(data[1])
    coins = sorted((int(value) for value in data[2 : 2 + count]), reverse=True)
    used = 0
    left = target

    for coin in coins:
        used += left // coin
        left %= coin

    print(used if left == 0 else -1)


main()
