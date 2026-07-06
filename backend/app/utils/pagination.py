"""Helpers for server-side pagination and sorting.

Keeps list endpoints fast and consistent as data grows (800 -> 8,000+ rows).
"""

from typing import Iterable


def apply_sort(query, model, sort_by, order, sortable: Iterable[str]):
    """Order a query by an allowlisted column. Falls back to caller's ordering.

    sortable is a whitelist of column names to prevent arbitrary/invalid sorts.
    """
    if sort_by and sort_by in set(sortable):
        column = getattr(model, sort_by)
        return query.order_by(column.desc() if order == "desc" else column.asc())
    return query


def paginate(query, skip: int, limit: int):
    """Return (items, total) for the given query window.

    total counts all matching rows (ordering stripped for a cheaper count).
    """
    total = query.order_by(None).count()
    items = query.offset(skip).limit(limit).all()
    return items, total
