#!/usr/bin/env bash
# Bisection script to find which test creates unwanted files/state
# Usage: ./find-polluter.sh <file_or_dir_to_check> <test_pattern>
# Example: ./find-polluter.sh '.git' 'src/**/*.test.ts'

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 <file_to_check> <test_pattern>"
  echo "Example: $0 '.git' 'src/**/*.test.ts'"
  exit 1
fi

POLLUTION_CHECK="$1"
TEST_PATTERN="$2"

echo "🔍 Searching for test that creates: $POLLUTION_CHECK"
echo "Test pattern: $TEST_PATTERN"
echo ""

# Get list of test files
TOTAL=$(find . -path "$TEST_PATTERN" | wc -l | tr -d ' ')

echo "Found $TOTAL test files"
echo ""

COUNT=0

run_scoped_test() {
  local test_file="$1" package_dir relative_file package_prefix
  package_dir=$(dirname "$test_file")
  while [ "$package_dir" != "." ] && [ "$package_dir" != "/" ] && [ ! -f "$package_dir/package.json" ]; do
    package_dir=$(dirname "$package_dir")
  done
  if [ ! -f "$package_dir/package.json" ]; then
    echo "No package.json found for $test_file" >&2
    return 2
  fi

  relative_file=${test_file#./}
  package_prefix=${package_dir#./}
  if [ "$package_prefix" != "." ]; then
    relative_file=${relative_file#"$package_prefix"/}
  fi
  (cd "$package_dir" && bun run test -- "$relative_file")
}

while IFS= read -r TEST_FILE; do
  COUNT=$((COUNT + 1))

  # Skip if pollution already exists
  if [ -e "$POLLUTION_CHECK" ]; then
    echo "⚠️  Pollution already exists before test $COUNT/$TOTAL"
    echo "   Skipping: $TEST_FILE"
    continue
  fi

  echo "[$COUNT/$TOTAL] Testing: $TEST_FILE"

  # Run the test
  run_scoped_test "$TEST_FILE" > /dev/null 2>&1 || true

  # Check if pollution appeared
  if [ -e "$POLLUTION_CHECK" ]; then
    echo ""
    echo "🎯 FOUND POLLUTER!"
    echo "   Test: $TEST_FILE"
    echo "   Created: $POLLUTION_CHECK"
    echo ""
    echo "Pollution details:"
    ls -la "$POLLUTION_CHECK"
    echo ""
    echo "To investigate:"
    echo "  Run this package's Bun test script for: $TEST_FILE"
    echo "  cat $TEST_FILE         # Review test code"
    exit 1
  fi
done < <(find . -path "$TEST_PATTERN" | sort)

echo ""
echo "✅ No polluter found - all tests clean!"
exit 0
