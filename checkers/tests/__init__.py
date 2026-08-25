"""
Unit tests for both checker workers.

The workers log what they are doing; a test run only wants the result, so the log is
turned down here rather than in every test.
"""

import logging

logging.disable(logging.CRITICAL)
