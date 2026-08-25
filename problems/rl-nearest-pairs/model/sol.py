def solve(data: str) -> str:
    nums = list(map(int, data.split()))
    pairs = nums[0]
    indexed = sorted((value, i+1) for i, value in enumerate(nums[1:1+2*pairs]))
    out = []
    for i in range(0, len(indexed), 2):
        out.append(f"{indexed[i][1]} {indexed[i+1][1]}")
    return "\n".join(out)


if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
