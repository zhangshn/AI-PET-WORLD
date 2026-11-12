"""Attempt every independent state restoration without hiding a primary error."""
from collections.abc import Callable, Iterable


def restore_state_callbacks(
    callbacks: Iterable[tuple[str, Callable[[], None]]],
    *,
    primary: BaseException | None = None,
) -> None:
    failures: list[tuple[str, BaseException]] = []
    for step, restore in callbacks:
        try:
            restore()
        except BaseException as error:
            failures.append((step, error))
    if not failures:
        return

    reported = primary if primary is not None else failures[0][1]
    details = []
    for step, error in failures:
        try:
            message = str(error)[:512]
        except BaseException:
            message = "<exception message unavailable>"
        details.append({"step": step, "errorType": type(error).__name__, "message": message})
        try:
            BaseException.add_note(reported, f"State restoration failed [{step}]: {type(error).__name__}: {message}")
        except BaseException:
            pass  # Diagnostic attachment must not replace the original failure.
    try:
        previous = getattr(reported, "state_restoration_errors", None)
        reported.state_restoration_errors = (previous if isinstance(previous, list) else []) + details
    except BaseException:
        pass  # Notes above also retain the secondary failures when attributes are restricted.
    if primary is None:
        raise reported


def state_restoration_evidence(error: BaseException) -> dict[str, list[dict[str, str]]]:
    """Add only locally captured, JSON-safe details to an existing failure record."""
    try:
        details = getattr(error, "state_restoration_errors", None)
    except BaseException:
        return {}
    if not isinstance(details, list) or not details:
        return {}
    keys = ("step", "errorType", "message")
    if not all(isinstance(row, dict) and all(isinstance(row.get(key), str) for key in keys) for row in details):
        return {}
    return {"stateRestorationErrors": [{key: row[key] for key in keys} for row in details]}
