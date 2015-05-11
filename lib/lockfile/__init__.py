# This is the MIT license: http://www.opensource.org/licenses/mit-license.php
#
# Copyright (c) 2007 Skip Montanaro.
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to
# deal in the Software without restriction, including without limitation the
# rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
# sell copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
# FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
# IN THE SOFTWARE.
"""
lockfile.py - Platform-independent advisory file locks.

Requires Python 2.5 unless you apply 2.4.diff
Locking is done on a per-thread basis instead of a per-process basis.
"""

from __future__ import absolute_import

import socket
import os
import threading
import warnings
import functools

# Work with PEP8 and non-PEP8 versions of threading module.
if not hasattr(threading, "current_thread"):
    threading.current_thread = threading.currentThread
if not hasattr(threading.Thread, "get_name"):
    threading.Thread.get_name = threading.Thread.getName

__all__ = ['Error', 'LockError', 'LockTimeout', 'AlreadyLocked',
           'LockFailed', 'UnlockError', 'NotLocked', 'NotMyLock',
           'LinkLockFile', 'MkdirLockFile', 'SQLiteLockFile',
           'LockBase', 'locked']


class Error(Exception):
    """
    Base class for other exceptions.
    """
    pass


class LockError(Error):
    """
    Base class for error arising from attempts to acquire the lock.
    """
    pass


class LockTimeout(LockError):
    """Raised when lock creation fails within a user-defined period of time.
    """
    pass


class AlreadyLocked(LockError):
    """Some other thread/process is locking the file.
    """
    pass


class LockFailed(LockError):
    """Lock file creation failed for some other reason.
    """
    pass


class UnlockError(Error):
    """
    Base class for errors arising from attempts to release the lock.
    """
    pass


class NotLocked(UnlockError):
    """Raised when an attempt is made to unlock an unlocked file.
    """
    pass


class NotMyLock(UnlockError):
    """Raised when an attempt is made to unlock a file someone else locked.

    """
    pass


class LockBase:
    """Base class for platform-specific lock classes."""
    def __init__(self, path, threaded=True, timeout=None):
        """
        """
        self.path = path
        self.lock_file = os.path.abspath(path) + ".lock"
        self.hostname = socket.gethostname()
        self.pid = os.getpid()
        if threaded:
            t = threading.current_thread()
            # Thread objects in Python 2.4 and earlier do not have ident
            # attrs.  Worm around that.
            ident = getattr(t, "ident", hash(t))
            self.tname = "-%x" % (ident & 0xffffffff)
        else:
            self.tname = ""
        dirname = os.path.dirname(self.lock_file)

        # unique name is mostly about the current process, but must
        # also contain the path -- otherwise, two adjacent locked
        # files conflict (one file gets locked, creating lock-file and
        # unique file, the other one gets locked, creating lock-file
        # and overwriting the already existing lock-file, then one
        # gets unlocked, deleting both lock-file and unique file,
        # finally the last lock errors out upon releasing.
        self.unique_name = os.path.join(dirname,
                                        "%s%s.%s%s" % (self.hostname,
                                                       self.tname,
                                                       self.pid,
                                                       hash(self.path)))
        self.timeout = timeout

    def acquire(self, timeout=None):
        """
        Acquire the lock.

        * If timeout is omitted (or None), wait forever trying to lock the
          file.

        * If timeout > 0, try to acquire the lock for that many seconds.  If
          the lock period expires and the file is still locked, raise
          LockTimeout.

        * If timeout <= 0, raise AlreadyLocked immediately if the file is
          already locked.
        """
        raise NotImplemented("implement in subclass")

    def release(self):
        """
        Release the lock.

        If the file is not locked, raise NotLocked.
        """
        raise NotImplemented("implement in subclass")

    def is_locked(self):
        """
        Tell whether or not the file is locked.
        """
        raise NotImplemented("implement in subclass")

    def i_am_locking(self):
        """
        Return True if this object is locking the file.
        """
        raise NotImplemented("implement in subclass")

    def break_lock(self):
        """
        Remove a lock.  Useful if a locking thread failed to unlock.
        """
        raise NotImplemented("implement in subclass")

    def __enter__(self):
        """
        Context manager support.
        """
        self.acquire()
        return self

    def __exit__(self, *_exc):
        """
        Context manager support.
        """
        self.release()

    def __repr__(self):
        return "<%s: %r -- %r>" % (self.__class__.__name__, self.unique_name,
                                   self.path)


def _fl_helper(cls, mod, *args, **kwds):
    warnings.warn("Import from %s module instead of lockfile package" % mod,
                  DeprecationWarning, stacklevel=2)
    # This is a bit funky, but it's only for awhile.  The way the unit tests
    # are constructed this function winds up as an unbound method, so it
    # actually takes three args, not two.  We want to toss out self.
    if not isinstance(args[0], str):
        # We are testing, avoid the first arg
        args = args[1:]
    if len(args) == 1 and not kwds:
        kwds["threaded"] = True
    return cls(*args, **kwds)


def LinkFileLock(*args, **kwds):
    """Factory function provided for backwards compatibility.

    Do not use in new code.  Instead, import LinkLockFile from the
    lockfile.linklockfile module.
    """
    from . import linklockfile
    return _fl_helper(linklockfile.LinkLockFile, "lockfile.linklockfile",
                      *args, **kwds)


def MkdirFileLock(*args, **kwds):
    """Factory function provided for backwards compatibility.

    Do not use in new code.  Instead, import MkdirLockFile from the
    lockfile.mkdirlockfile module.
    """
    from . import mkdirlockfile
    return _fl_helper(mkdirlockfile.MkdirLockFile, "lockfile.mkdirlockfile",
                      *args, **kwds)


def locked(path, timeout=None):
    """Decorator which enables locks for decorated function.

    Arguments:
     - path: path for lockfile.
     - timeout (optional): Timeout for acquiring lock.

     Usage:
         @locked('/var/run/myname', timeout=0)
         def myname(...):
             ...
    """
    def decor(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            lock = FileLock(path, timeout=timeout)
            lock.acquire()
            try:
                return func(*args, **kwargs)
            finally:
                lock.release()
        return wrapper
    return decor

if hasattr(os, "link"):
    from . import linklockfile as _llf
    LockFile = _llf.LinkLockFile
else:
    from . import mkdirlockfile as _mlf
    LockFile = _mlf.MkdirLockFile

FileLock = LockFile
