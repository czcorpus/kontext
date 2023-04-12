"""
Redirects stderr to a specified stream even for called C-modules
original author: Eli Bendersky (http://eli.thegreenplace.net/2015/redirecting-all-kinds-of-stdout-in-python)
"""

import ctypes
from contextlib import contextmanager

from bgcalc.adapter.errors import BgCalcAdapterError

libc = ctypes.CDLL('')
c_stderr = ctypes.c_void_p.in_dll(libc, 'stderr')


@contextmanager
def dummy_redirector(stream):
    yield stream


def get_stderr_redirector(conf):
    app_type = conf.get('calc_backend', 'type')
    if app_type == 'rq':
        return dummy_redirector
    raise BgCalcAdapterError('No such calc backend: {}'.format(app_type))
