"""Optimal Neighbour Pairing - deliberately wrong.

Pairs the items in the order they were given instead of by weight, so the
pairing is valid but almost never the cheapest one.
"""

import sys


def main() -> None:
    data = sys.stdin.buffer.read().split()
    pair_count = int(data[0])
    indices = list(range(1, 2 * pair_count + 1))
    print("\n".join(f"{indices[i]} {indices[i + 1]}" for i in range(0, len(indices), 2)))


main()
