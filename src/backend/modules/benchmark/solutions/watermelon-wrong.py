"""Watermelon (cf-4-A) - deliberately wrong.

Answers on the parity of the weight itself instead of the parity of the two
halves, so every even weight comes out as NO and every odd one as YES.
"""

import sys


def main() -> None:
    weight = int(sys.stdin.buffer.read().split()[0])
    print("YES" if weight % 2 == 1 else "NO")


main()
