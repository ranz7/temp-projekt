"""Optimal Neighbour Pairing - correct.

Sorting the weights and pairing neighbours gives the smallest possible total of
in-pair differences.
"""

import sys


def main() -> None:
    data = sys.stdin.buffer.read().split()
    pair_count = int(data[0])
    weights = [int(value) for value in data[1 : 1 + 2 * pair_count]]
    ordered = sorted(range(1, 2 * pair_count + 1), key=lambda index: weights[index - 1])
    print("\n".join(f"{ordered[i]} {ordered[i + 1]}" for i in range(0, len(ordered), 2)))


main()
