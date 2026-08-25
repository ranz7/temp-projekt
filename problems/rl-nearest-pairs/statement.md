# Optimal Neighbour Pairing

You are given $2n$ items with distinct integer weights.
Pair every item exactly once so that the sum of the absolute weight differences within the pairs is as small as possible.
Any optimal pairing is accepted.

## Input

The first line contains one integer $n$, the number of pairs to create.
The second line contains $2n$ distinct integers $w_1, w_2, \ldots, w_{2n}$, the item weights.

## Output

Print $n$ lines.
Each line must contain two 1-based indices of items forming one pair.
Every index from $1$ through $2n$ must appear exactly once, and the total pairing cost must be minimal.

## Constraints

$$1 \le n \le 19$$

$$-300 \le w_i \le 297$$

All weights are distinct.

## Example

Input:

```text
3
10 1 8 3 4 20
```

Output:

```text
2 4
5 3
1 6
```

The pairs have weight differences $2$, $4$, and $10$, for a total cost of $16$, which is minimal.
