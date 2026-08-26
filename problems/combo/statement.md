# Combo

There is a secret sequence $S$ of $N$ buttons chosen from `A`, `B`, `X`, and `Y`.
Determine the entire sequence by asking how much of its prefix appears inside strings that you construct.
The first button of $S$ is guaranteed not to appear anywhere else in $S$.

## Implementation

Implement the following function:

```cpp
std::string guess_sequence(int N);
```

The grader calls this function once and provides the length $N$ of the secret sequence.
Your function must return exactly $S$.
Do not implement `main`.

## Interaction

Your function may call:

```cpp
int press(std::string p);
```

The string $p$ may contain only `A`, `B`, `X`, and `Y`, and its length must not exceed $4N$.
The function returns the length of the longest prefix of $S$ that occurs as a contiguous substring of $p$.

You may call `press` at most $8000$ times.
Exceeding the call limit, passing an invalid string, or returning a sequence other than $S$ results in a wrong answer.

## Constraints

$$1 \le N \le 2000$$

$$S_i \in \{\text{A}, \text{B}, \text{X}, \text{Y}\}$$

The first character of $S$ does not occur at any other position in $S$.

## Example

Suppose the secret sequence is $S = \text{ABXYY}$.

Calling `press("AB")` returns $2$, because `AB`, a prefix of length $2$, occurs in the query and no longer prefix can fit in it.
Calling `press("YABX")` returns $3$, because `ABX`, a prefix of length $3$, occurs contiguously in the query, while `ABXY` does not.

The required return value from `guess_sequence(5)` is `"ABXYY"`.
