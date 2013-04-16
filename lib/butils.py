import re

try:
    import fcntl
except ImportError:
    try:
        import msvcrt
    except ImportError:
        # no locking available, dummy defs
        def flck_no_op (file):
            pass
        flck_sh_lock = flck_ex_lock = flck_unlock = flck_no_op
    else:
        # XXX substitute with win32file
        # see e.g. http://code.activestate.com/recipes/65203/
        # Windows: msvcrt.locking
        def flck_sh_lock (file):
            file.seek (0)
            msvcrt.locking (file.fileno(), msvcrt.LK_LOCK, 1)
        flck_ex_lock = flck_sh_lock
        def flck_unlock (file):
            file.seek (0)
            msvcrt.locking (file.fileno(), msvcrt.LK_UNLCK, 1)
else:
    # UNIX: fcntl.lockf
    def flck_sh_lock (file):
        fcntl.lockf (file, fcntl.LOCK_SH, 0, 0, 0)
    def flck_ex_lock (file):
        fcntl.lockf (file, fcntl.LOCK_EX, 0, 0, 0)
    def flck_unlock (file):
        fcntl.lockf (file, fcntl.LOCK_UN, 0, 0, 0)

escape_regexp = re.compile(r'[][.*+{}?()|\\"$^]')

def escape(s):
    """ Escape CQL attribute value to protect it against RE evaluation """
    return escape_regexp.sub(r'\\\g<0>', s)

try:
    from setproctitle import setproctitle
except ImportError:
    setproctitle = lambda x: None
