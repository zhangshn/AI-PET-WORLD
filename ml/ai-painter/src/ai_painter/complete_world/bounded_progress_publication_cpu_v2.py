"""Completion-route publication mode; existing finite v1 stays byte-for-byte.

This pure component grants no policy/package admission. Its caller authenticates
the exact completion capability before selecting a null execution deadline.
"""
import math
import os
from ai_painter.complete_world.bounded_progress_publication_cpu_v1 import (
    BoundedProgressPublisher as FinitePublisher, FRESHNESS_SECONDS, MAX_SNAPSHOT_BYTES,
    _identity, _regular, confirmed_windows_sharing)

COMPLETION_CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v1"
COMPLETION_V2_CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v2"
SAME_CALL_CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_same_call_v1"
EXECUTION_QUALIFIED = False
OPERATION_MAXIMUM_SECONDS = .250


class BoundedProgressPublisher(FinitePublisher):
    def __init__(self,*args,completion_capability=None,publication_protocol=None,**kwargs):
        super().__init__(*args,**kwargs)
        if publication_protocol is not None:
            if publication_protocol != "authenticated_completion_publication_v1" or completion_capability is not None:
                raise ValueError("unknown or conflicting publication protocol")
            # The worker authenticates the Run and policy before constructing us.
            # This pure protocol component never grants execution qualification.
            self.completion_enabled=True
            self.deadline_mode=None
            return
        if completion_capability not in (None,COMPLETION_CAPABILITY,COMPLETION_V2_CAPABILITY,SAME_CALL_CAPABILITY):
            raise ValueError("unknown publication completion capability")
        self.completion_enabled=completion_capability in (COMPLETION_CAPABILITY,COMPLETION_V2_CAPABILITY,SAME_CALL_CAPABILITY)
        self.deadline_mode=None

    def publish(self,raw,*,execution_deadline):
        mode="completion" if execution_deadline is None else "finite"
        if self.deadline_mode is None:self.deadline_mode=mode
        elif self.deadline_mode!=mode:self._fail(ValueError("original execution deadline mode changed"))
        if execution_deadline is not None:
            return super().publish(raw,execution_deadline=execution_deadline)
        if not self.completion_enabled:self._fail(ValueError("null deadline requires authenticated completion route selection"))
        if self.closed:raise RuntimeError("closed publisher cannot resume")
        if type(raw) is not bytes or not 0<len(raw)<=MAX_SNAPSHOT_BYTES:self._fail(ValueError("bounded snapshot bytes required"))
        now=self.clock()
        if (type(now) not in (int,float) or not math.isfinite(now)
                or self.last_call_clock is not None and now<self.last_call_clock):
            self._fail(ValueError("finite monotonic clock required"))
        self.last_call_clock=now
        if self.last_published_capture is not None and now>=self.last_published_capture+FRESHNESS_SECONDS:
            self._fail(TimeoutError("published progress freshness exhausted"))
        # Preserve the original capture freshness anchor. Only the supplied
        # atomic replacement helper has its250ms/five-attempt operation window;
        # staging, fsync and identity checks do not acquire a new250ms cutoff.
        deadline=(self.last_published_capture+FRESHNESS_SECONDS
            if self.last_published_capture is not None else now+FRESHNESS_SECONDS)
        try:
            if _identity(_regular(self.target,missing=True))!=self.target_identity:
                raise ValueError("published progress changed outside its writer")
            if self.pending is None:
                self.check_budget(len(raw))
                self.pending=self.target.with_name("progress.json.staged-"+os.urandom(8).hex())
                self.pending_capture=now
                self.pending_bytes=raw
                with self.pending.open("xb") as stream:
                    if stream.write(raw)!=len(raw):raise OSError("short progress snapshot write")
                    stream.flush();os.fsync(stream.fileno())
                self.pending_identity=_identity(_regular(self.pending))
            else:
                self.check_budget(0)
                if _identity(_regular(self.pending))!=self.pending_identity:raise ValueError("retained progress snapshot changed")
            if self.clock()>=deadline:raise TimeoutError("publication operation deadline exhausted")
            try:self.replace_snapshot(self.pending,self.target,deadline=deadline)
            except OSError as error:
                if self.first_error is None:self.first_error=error
                if (_identity(_regular(self.target))!=self.target_identity or _identity(_regular(self.pending))!=self.pending_identity):
                    self._fail(ValueError("publication identity changed during replacement failure"))
                if (self.last_published_capture is None or self.clock()>=deadline
                        or not confirmed_windows_sharing(error,self.pending,self.target)):self._fail(error)
                if (self.clock()>=deadline or _identity(_regular(self.target))!=self.target_identity
                        or _identity(_regular(self.pending))!=self.pending_identity):
                    self._fail(TimeoutError("sharing proof expired or publication identity changed"))
                return "deferred_confirmed_sharing"
            if self.pending.exists():raise ValueError("replacement did not consume staged snapshot")
            info=_regular(self.target)
            with self.target.open("rb") as stream:actual=stream.read(MAX_SNAPSHOT_BYTES+1)
            if actual!=self.pending_bytes or _identity(_regular(self.target))!=_identity(info):
                raise ValueError("published progress bytes or identity differ")
            if self.clock()>=deadline:raise TimeoutError("publication completed after permitted deadline")
            stale_input=self.pending_bytes!=raw
            self.last_published_capture=self.pending_capture
            self.target_identity=_identity(info)
            self.pending=self.pending_bytes=self.pending_identity=self.pending_capture=None
            self.first_error=None
            return "published_retained_snapshot" if stale_input else "published"
        except Exception as error:self._fail(error)
