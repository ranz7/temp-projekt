// Combo - correct.
//
// The first button never occurs again, which is what lets one press separate
// three candidates at once: two presses find the first button, then every
// further button costs a single press, and the last one costs at most two more.

#include <string>

#include "combo.h"

std::string guess_sequence(int N) {
  std::string secret;

  if (press("AB") > 0) {
    secret = press("A") > 0 ? "A" : "B";
  } else {
    secret = press("X") > 0 ? "X" : "Y";
  }

  std::string rest;
  for (char button : {'A', 'B', 'X', 'Y'}) {
    if (button != secret[0]) {
      rest += button;
    }
  }

  for (int known = 1; known < N - 1; ++known) {
    const std::string query = secret + rest[0] + secret + rest[1] + rest[0] + secret + rest[1] +
                              rest[1] + secret + rest[1] + rest[2];
    const int found = press(query);

    if (found == known + 2) {
      secret += rest[1];
    } else if (found == known + 1) {
      secret += rest[0];
    } else {
      secret += rest[2];
    }
  }

  if (N > 1) {
    if (press(secret + rest[0]) == N) {
      secret += rest[0];
    } else if (press(secret + rest[1]) == N) {
      secret += rest[1];
    } else {
      secret += rest[2];
    }
  }

  return secret;
}
