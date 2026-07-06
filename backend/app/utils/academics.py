"""B.Tech academic mapping helpers.

Real B.Tech structure: 4 years x 2 terms = 8 semesters.
    Year 1 -> Monsoon = Sem 1, Winter = Sem 2
    Year 2 -> Monsoon = Sem 3, Winter = Sem 4
    Year 3 -> Monsoon = Sem 5, Winter = Sem 6
    Year 4 -> Monsoon = Sem 7, Winter = Sem 8
"""

from typing import Optional

MONSOON = "Monsoon"
WINTER = "Winter"


def semester_number(btech_year: int, term: str) -> int:
    """(btech_year, term) -> semester number 1..8."""
    offset = 1 if term == MONSOON else 2
    return (btech_year - 1) * 2 + offset


def btech_year_of(sem: int) -> int:
    """Semester number -> B.Tech year 1..4."""
    return (sem + 1) // 2


def term_of(sem: int) -> str:
    """Semester number -> term (odd = Monsoon, even = Winter)."""
    return MONSOON if sem % 2 == 1 else WINTER


def resolve_semester(
    semester_number_in: Optional[int],
    btech_year: Optional[int],
    term: Optional[str],
) -> Optional[int]:
    """Resolve a semester number from either an explicit value or year+term."""
    if semester_number_in is not None:
        return semester_number_in
    if btech_year is not None and term:
        return semester_number(btech_year, term)
    return None
