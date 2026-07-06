"""10-point grading scale (Indian B.Tech convention).

Maps a percentage to a letter grade and grade point:

    >= 90  O   10
    >= 80  A+   9
    >= 70  A    8
    >= 60  B+   7
    >= 55  B    6
    >= 50  C    5
    >= 40  P    4   (pass)
    <  40  F    0   (fail)
"""

from typing import Optional

PASS_PERCENTAGE = 40.0

# Ordered high -> low; first threshold met wins.
_GRADE_TABLE = [
    (90, "O", 10),
    (80, "A+", 9),
    (70, "A", 8),
    (60, "B+", 7),
    (55, "B", 6),
    (50, "C", 5),
    (40, "P", 4),
    (0, "F", 0),
]


def grade_for(percentage: Optional[float]):
    """Return (letter_grade, grade_point) for a percentage, or (None, None)."""
    if percentage is None:
        return None, None
    for threshold, letter, point in _GRADE_TABLE:
        if percentage >= threshold:
            return letter, point
    return "F", 0
