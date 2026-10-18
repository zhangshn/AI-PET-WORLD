"""Inactive CPU-validated publication candidate; not a training execution route.

The caller supplies the existing finite atomic replacement and output accounting.
Only independently confirmed Windows sharing occupancy may defer publication.
No model, GPU, runner, lifecycle registry, or process-control dependency exists.
"""
from __future__ import annotations

import ctypes
from ctypes import wintypes
import math
import os
from pathlib import Path
import re
import stat
import time

FRESHNESS_SECONDS = 120
MAX_SNAPSHOT_BYTES = 64 * 1024
EXECUTION_QUALIFIED = False


def _regular(path, *, missing=False):
    path = Path(path)
    if not path.is_absolute():
        raise ValueError("physical absolute publication path required")
    leaf = None
    for index, node in enumerate((path, *path.parents)):
        try:
            info = node.lstat()
        except FileNotFoundError:
            if index == 0 and missing:
                continue
            raise
        if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
            raise ValueError("publication path redirection prohibited")
        if index == 0:
            if not stat.S_ISREG(info.st_mode):
                raise ValueError("publication leaf must be regular")
            leaf = info
        elif not stat.S_ISDIR(info.st_mode):
            raise ValueError("publication parent must be directory")
    return leaf


def _identity(info):
    return None if info is None else (info.st_dev, info.st_ino, info.st_size,
        info.st_mtime_ns, info.st_ctime_ns, getattr(info, "st_file_attributes", 0))


def _windows_occupancy(path):
    """Read-only handle probes, not a diagnosis of a historical lock holder.

    DELETE access with all sharing checks access rights without deleting anything.
    A second exclusive probe distinguishes an open reader from an ordinary ACL
    denial even when Windows MoveFileEx reports the generic access-denied code.
    Every acquired handle closes before the next probe and before returning.
    """
    before = _regular(path)
    if getattr(before, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_READONLY:
        return False
    api = ctypes.WinDLL("kernel32", use_last_error=True)
    api.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
        wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
    api.CreateFileW.restype = wintypes.HANDLE
    api.CloseHandle.argtypes = [wintypes.HANDLE]
    api.CloseHandle.restype = wintypes.BOOL
    invalid = ctypes.c_void_p(-1).value

    def probe(sharing):
        handle = api.CreateFileW(str(path), 0x00010000 | 0x80, sharing,
            None, 3, 0x00200000, None)  # DELETE | READ_ATTRIBUTES; no-follow open.
        if handle == invalid:
            return ctypes.get_last_error()
        if not api.CloseHandle(handle):
            raise ctypes.WinError(ctypes.get_last_error())
        return 0

    shared_error = probe(1 | 2 | 4)
    if shared_error == 32:
        occupied = True
    elif shared_error == 0:
        exclusive_error = probe(0)
        if exclusive_error not in (0, 32):
            raise ctypes.WinError(exclusive_error)
        occupied = exclusive_error == 32
    else:
        raise ctypes.WinError(shared_error)
    if _identity(_regular(path)) != _identity(before):
        raise ValueError("publication identity changed during sharing proof")
    return occupied


def confirmed_windows_sharing(error, pending, target):
    if os.name != "nt" or not isinstance(error, OSError):
        return False
    code = getattr(error, "winerror", None)
    if code not in (5, 32, 33):
        return False
    before = tuple(_identity(_regular(p)) for p in (pending, target))
    if any(value[-1] & stat.FILE_ATTRIBUTE_READONLY for value in before):
        return False
    # Never infer that generic WinError 5 means a sharing conflict.
    # Probe BOTH ends even if one is occupied: its sharing conflict must not
    # hide an ACL/access error on the other file.
    occupancies = tuple(_windows_occupancy(p) for p in (pending, target))
    occupied = code in (32, 33) or any(occupancies)
    if tuple(_identity(_regular(p)) for p in (pending, target)) != before:
        raise ValueError("publication path identity changed during classification")
    return occupied


class BoundedProgressPublisher:
    """One retained pending snapshot; no training retry or new time allowance.

    Unpublished bytes never overwrite the previous successful snapshot. A deferred
    snapshot keeps its original capture clock; late publication cannot reset its
    age. The 120-second limit is anchored to the last *published data capture*,
    not the first failure, a retry, or the time old pending bytes finally publish.
    Initial publication and any unconfirmed/other error remain fatal.
    """
    def __init__(self, target, *, replace_snapshot, check_budget, clock=time.monotonic):
        self.target = Path(target)
        if self.target.name != "progress.json":
            raise ValueError("exact progress.json target required")
        _regular(self.target, missing=True)
        self.replace_snapshot = replace_snapshot
        self.check_budget = check_budget
        self.clock = clock
        self.last_published_capture = None
        self.pending = None
        self.pending_bytes = None
        self.pending_identity = None
        self.pending_capture = None
        self.target_identity = _identity(_regular(self.target, missing=True))
        self.first_error = None
        self.closed = False
        self.execution_deadline = None
        self.last_call_clock = None

    def _fail(self, error):
        self.closed = True
        if self.first_error is not None and self.first_error is not error:
            raise self.first_error from error
        raise error

    def publish(self, raw, *, execution_deadline):
        if self.closed:
            raise RuntimeError("closed publisher cannot resume")
        if type(raw) is not bytes or not 0 < len(raw) <= MAX_SNAPSHOT_BYTES:
            self._fail(ValueError("bounded snapshot bytes required"))
        now = self.clock()
        if (type(execution_deadline) not in (int, float) or not math.isfinite(execution_deadline)
                or type(now) not in (int, float) or not math.isfinite(now)
                or self.last_call_clock is not None and now < self.last_call_clock):
            self._fail(ValueError("finite monotonic clock and deadline required"))
        if self.execution_deadline is None:
            self.execution_deadline = execution_deadline
        elif execution_deadline != self.execution_deadline:
            self._fail(ValueError("original execution deadline changed"))
        self.last_call_clock = now
        if now >= execution_deadline:
            self._fail(TimeoutError("original execution deadline exhausted"))
        if self.last_published_capture is not None and now >= self.last_published_capture + FRESHNESS_SECONDS:
            self._fail(TimeoutError("published progress freshness exhausted"))
        try:
            if _identity(_regular(self.target, missing=True)) != self.target_identity:
                raise ValueError("published progress changed outside its writer")
            if self.pending is None:
                self.check_budget(len(raw))
                self.pending = self.target.with_name("progress.json.staged-" + os.urandom(8).hex())
                self.pending_capture = now
                self.pending_bytes = raw
                with self.pending.open("xb") as stream:
                    if stream.write(raw) != len(raw):
                        raise OSError("short progress snapshot write")
                    stream.flush()
                    os.fsync(stream.fileno())
                self.pending_identity = _identity(_regular(self.pending))
            else:
                self.check_budget(0)  # Other evidence may have consumed the same budget.
                if _identity(_regular(self.pending)) != self.pending_identity:
                    raise ValueError("retained progress snapshot changed")
            deadline = execution_deadline
            if self.last_published_capture is not None:
                deadline = min(deadline, self.last_published_capture + FRESHNESS_SECONDS)
            try:
                self.replace_snapshot(self.pending, self.target, deadline=deadline)
            except OSError as error:
                if self.first_error is None:
                    self.first_error = error
                if (_identity(_regular(self.target)) != self.target_identity
                        or _identity(_regular(self.pending)) != self.pending_identity):
                    self._fail(ValueError("publication identity changed during replacement failure"))
                if (self.last_published_capture is None or self.clock() >= deadline
                        or not confirmed_windows_sharing(error, self.pending, self.target)):
                    self._fail(error)
                if (self.clock() >= deadline or _identity(_regular(self.target)) != self.target_identity
                        or _identity(_regular(self.pending)) != self.pending_identity):
                    self._fail(TimeoutError("sharing proof expired or publication identity changed"))
                return "deferred_confirmed_sharing"
            # Replacement returning is not enough: verify exact bytes and identity.
            if self.pending.exists():
                raise ValueError("replacement did not consume staged snapshot")
            info = _regular(self.target)
            with self.target.open("rb") as stream:
                actual = stream.read(MAX_SNAPSHOT_BYTES + 1)
            if actual != self.pending_bytes or _identity(_regular(self.target)) != _identity(info):
                raise ValueError("published progress bytes or identity differ")
            if self.clock() >= deadline:
                raise TimeoutError("publication completed after permitted deadline")
            stale_input = self.pending_bytes != raw
            self.last_published_capture = self.pending_capture
            self.target_identity = _identity(info)
            self.pending = self.pending_bytes = self.pending_identity = self.pending_capture = None
            self.first_error = None
            return "published_retained_snapshot" if stale_input else "published"
        except Exception as error:
            self._fail(error)
