"""
Redirects stderr to a specified stream even for called C-modules
original author: Eli Bendersky (http://eli.thegreenplace.net/2015/redirecting-all-kinds-of-stdout-in-python)
"""

from contextlib import contextmanager
import ctypes
import io
import os
import sys
import tempfile
from .errors import CalcBackendInitError

libc = ctypes.CDLL('')
c_stderr = ctypes.c_void_p.in_dll(libc, 'stderr')


@contextmanager
def stderr_redirector(stream):
    """
    This is for Celery backend as it makes it quite complicated to obtain
    stderr output in a normal way
    """
    original_stderr_fd = 2

    def _redirect_stderr(to_fd):
        libc.fflush(c_stderr)
        sys.stderr.close()
        os.dup2(to_fd, original_stderr_fd)
        sys.stderr = os.fdopen(original_stderr_fd, 'wb')

    saved_stderr_fd = os.dup(original_stderr_fd)
    try:
        # Create a temporary file and redirect stderr to it
        tfile = tempfile.TemporaryFile(mode='w+b')
        _redirect_stderr(tfile.fileno())
        # Yield to caller, then redirect stderr back to the saved fd
        yield
        _redirect_stderr(saved_stderr_fd)
        # Copy contents of temporary file to the given stream
        tfile.flush()
        tfile.seek(0, io.SEEK_SET)
        stream.write(tfile.read().decode('utf-8'))
    finally:
        tfile.close()
        os.close(saved_stderr_fd)


@contextmanager
def dummy_redirector(stream):
    yield stream


def get_stderr_redirector(conf):
    app_type = conf.get('calc_backend', 'type')
    if app_type == 'celery':
        return stderr_redirector
    elif app_type == 'rq':
        return dummy_redirector
    raise CalcBackendInitError('No such calc backend: {}'.format(app_type))
