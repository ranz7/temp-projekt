"""Minimizing Coins - correct.

The table over every sum up to x is the intended C++ solution; in CPython it is a
hundred million steps. Three cheaper routes cover everything the constraints allow,
and the table stays only as the one that always works.
"""

import sys
from heapq import heappop, heappush


def solve(count: int, target: int, values: list[int]) -> int:
    coins = sorted({value for value in values[:count] if value <= target})

    if target == 0:
        return 0
    if not coins:
        return -1

    answer = by_residue(target, coins)
    if answer is not None:
        return answer

    answer = by_layers(target, coins)
    if answer is not None:
        return answer

    return by_table(target, coins)


# How much work each route may do before it is judged the wrong one for this input.
RESIDUE_BUDGET = 300_000
LAYER_BUDGET = 60_000_000


def by_residue(target: int, coins: list[int]) -> int | None:
    """Shortest path over the remainders modulo the largest coin.

    Pay for a coin with the value it wastes against the largest one, `big - coin`,
    and a multiset costs `a * big - sum`. Topping the rest up with `big` coins, the
    number of coins is `(target + cost) / big`, so the cheapest path is the fewest
    coins - as long as its own sum fits inside the target, which is checked.
    """
    big = coins[-1]

    if big * len(coins) > RESIDUE_BUDGET:
        return None

    unreached = (1 << 62, 0)
    # (cost, coins used) per remainder; fewest coins breaks a tie, so the sum the
    # winning path needs is as small as it can be.
    best = [unreached] * big
    best[0] = (0, 0)
    queue = [(0, 0, 0)]

    while queue:
        cost, used, remainder = heappop(queue)

        if (cost, used) > best[remainder]:
            continue

        for coin in coins:
            step = (cost + big - coin, used + 1)
            moved = remainder + coin

            if moved >= big:
                moved -= big

            if step < best[moved]:
                best[moved] = step
                heappush(queue, (step[0], step[1], moved))

    cost, used = best[target % big]

    if (cost, used) == unreached:
        return -1

    total = (target + cost) // big

    # The path's own coins have to fit: `used * big - cost` is what they sum to.
    return total if used <= total else None


def by_layers(target: int, coins: list[int]) -> int | None:
    """Breadth-first over the sums reachable with one more coin, as one big integer.

    Bit `s` of `reached` says a sum of `s` is payable with the coins counted so far.
    Cheap exactly when the answer is small, which is what large coins force.
    """
    mask = (1 << (target + 1)) - 1
    words = (target + 63) // 64
    limit = max(1, LAYER_BUDGET // (len(coins) * words))
    reached = 1
    layers = 0

    while layers < limit:
        layers += 1
        grown = reached

        for coin in coins:
            grown |= reached << coin

        grown &= mask

        if grown == reached:
            return -1
        if (grown >> target) & 1:
            return layers

        reached = grown

    return None


def by_table(target: int, coins: list[int]) -> int:
    """The fewest coins for every sum up to the target, built from the sums below."""
    unreachable = target + 1
    best = [0] + [unreachable] * target

    for coin in coins:
        for total in range(coin, target + 1):
            candidate = best[total - coin] + 1
            if candidate < best[total]:
                best[total] = candidate

    return best[target] if best[target] <= target else -1


def main() -> None:
    data = sys.stdin.buffer.read().split()
    print(solve(int(data[0]), int(data[1]), [int(value) for value in data[2:]]))


main()
