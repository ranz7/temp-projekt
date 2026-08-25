"""Minimizing Coins - correct.

Unbounded knapsack: the fewest coins for every sum up to the target, built from
the sums below it.
"""

import sys


def main() -> None:
    data = sys.stdin.buffer.read().split()
    count = int(data[0])
    target = int(data[1])
    coins = sorted({int(value) for value in data[2 : 2 + count]})
    unreachable = target + 1
    best = [0] + [unreachable] * target

    for coin in coins:
        if coin > target:
            break
        for total in range(coin, target + 1):
            candidate = best[total - coin] + 1
            if candidate < best[total]:
                best[total] = candidate

    print(best[target] if best[target] <= target else -1)


main()
