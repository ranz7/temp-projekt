// Combo - deliberately wrong.
//
// Finds every button but the last one properly, then assumes the sequence ends
// with the first button that is still available instead of testing for it. The
// grader reports a wrong guess; nothing crashes and no press is wasted.

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
    secret += rest[0];
  }

  return secret;
}
