# Minimizing Coins

You have an unlimited supply of coins in $n$ distinct denominations.
Find the minimum number of coins needed to produce the sum $x$ exactly.

## Input

The first line contains two integers $n$ and $x$: the number of denominations and the target sum.
The second line contains $n$ distinct integers $c_1, c_2, \ldots, c_n$: the coin values.

## Output

Print the minimum number of coins needed to produce $x$.
If the sum cannot be produced, print $-1$.

## Constraints

$$1 \le n \le 100$$

$$1 \le x \le 10^6$$

$$1 \le c_i \le 10^6$$

## Example

Input:

```text
3 11
1 5 7
```

Output:

```text
3
```

The sum $11$ can be produced as $5 + 5 + 1$, using three coins.
It cannot be produced with fewer coins.
