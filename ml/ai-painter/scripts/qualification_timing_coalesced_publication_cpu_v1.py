"""Host-CPU timing-publication adapter, independent of model/GPU operations.

All event accounting and resource callbacks remain in the original observer.
Only diagnostic persistence is coalesced. The original authenticated publisher
still validates paths, bindings, budgets, atomic replacement and errors whenever
a snapshot is actually written. No timer, thread, GPU call or execution entry.
The concrete observer supplies the authenticated original publisher via MRO.
"""
PUBLICATION_INTERVAL_SECONDS = 2.0


class CoalescedTimingPublication:
    """Same snapshot schema; completion/error boundaries force persistence."""

    def __init__(self, context, calls, started, authentication_finished):
        self._initialize_publication_state()
        super().__init__(context, calls, started, authentication_finished)

    def _initialize_publication_state(self):
        self._last_successful_publication = None
        self._deferred_publication_depth = 0

    def _persist_current_snapshot(self):
        # Do not replace or wrap the original IO authority with caller data.
        result = super().publish()
        # Failed writes never advance the successful-publication clock.
        self._last_successful_publication = self._clock()
        return result

    def publish(self):
        if self._deferred_publication_depth:
            return None
        now = self._clock()
        last = self._last_successful_publication
        if last is None or now - last >= PUBLICATION_INTERVAL_SECONDS:
            return self._persist_current_snapshot()
        return None

    def complete_sample(self):
        # Suppress the parent's ordinary request, then persist exactly once at
        # this forced boundary. Its counters and validations are not rewritten.
        self._deferred_publication_depth += 1
        try:
            result = super().complete_sample()
        finally:
            self._deferred_publication_depth -= 1
        self._persist_current_snapshot()
        return result

    def finish(self, primary=None):
        self._deferred_publication_depth += 1
        try:
            result = super().finish(primary)
        finally:
            self._deferred_publication_depth -= 1
        try:
            self._persist_current_snapshot()
        except BaseException as secondary:
            if primary is None:
                raise
            # Original failure wins; existing secondary-observation semantics
            # are reused. No automatic retry or new error protocol.
            self.secondary(primary, secondary)
        return result
