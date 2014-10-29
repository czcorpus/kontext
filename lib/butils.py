import re
import inspect

try:
    import fcntl
except ImportError:
    try:
        import msvcrt
    except ImportError:
        # no locking available, dummy defs
        def flck_no_op(file):
            pass
        flck_sh_lock = flck_ex_lock = flck_unlock = flck_no_op
    else:
        # XXX substitute with win32file
        # see e.g. http://code.activestate.com/recipes/65203/
        # Windows: msvcrt.locking
        def flck_sh_lock(file):
            file.seek(0)
            msvcrt.locking(file.fileno(), msvcrt.LK_LOCK, 1)
        flck_ex_lock = flck_sh_lock

        def flck_unlock(file):
            file.seek(0)
            msvcrt.locking(file.fileno(), msvcrt.LK_UNLCK, 1)
else:
    # UNIX: fcntl.lockf
    def flck_sh_lock(file):
        fcntl.lockf(file, fcntl.LOCK_SH, 0, 0, 0)

    def flck_ex_lock(file):
        fcntl.lockf(file, fcntl.LOCK_EX, 0, 0, 0)

    def flck_unlock(file):
        fcntl.lockf(file, fcntl.LOCK_UN, 0, 0, 0)

try:
    from setproctitle import setproctitle
except ImportError:
    setproctitle = lambda x: None


class CQLDetectWithin(object):
    """
    """
    def split_by_parentheses(self, s):
        if s is None:
            return [None]
        return [v1 for v2 in [re.split(r'(\])', x) for x in re.split(r'(\[)', s)] for v1 in v2]

    def parse_lex_elems(self, s):
        i = 0
        ans = []
        curr_piece = ''
        state = 0   # 1 = opened ", 2 = opened '
        while i < len(s):
            if s[i] == '\\':
                curr_piece += s[i+1]
                i += 2
                continue
            if s[i] == '"':
                if state == 0:
                    ans.extend(re.split(r'\s+', curr_piece))
                    curr_piece = ''
                    state = 1
                elif state == 1:
                    ans.append(None)  # use None instead of quoted text
                    curr_piece = ''
                    state = 0
                else:
                    raise Exception('syntax error')
            elif s[i] == '\'':
                if state == 0:
                    ans.extend(re.split(r'\s+', curr_piece))
                    curr_piece = ''
                    state = 2
                elif state == 2:
                    ans.append(None)  # use None instead of quoted text
                    curr_piece = ''
                    state = 0
                else:
                    raise Exception('syntax error')
            else:
                curr_piece += s[i]
            i += 1
        if len(curr_piece) > 0:
            ans.extend(re.split(r'\s+', curr_piece))
        return ans

    def empty_tag_next(self, struct, start_pos):
        return start_pos < len(struct) - 1 and re.match(r'\s*/>', struct[start_pos])

    def contains_within(self, s):
        struct = self.parse(s)
        last_p = None

        for i in range(len(struct)):
            item = struct[i]
            if item is None:
                continue
            if item in (']', '['):
                last_p = item
            elif 'within' in item:
                if i + 1 < len(struct) - 1 and re.match(r'\w+:',  struct[i + 1]):
                    return False
                elif i + 1 < len(struct) - 1 and re.match(r'<.+', struct[i + 1]):
                    return not self.empty_tag_next(struct, i + 2)
                elif last_p in (']', None):
                    return True
        return False

    def parse(self, s):
        result = []
        ans = self.parse_lex_elems(s)
        for item in ans:
            x = self.split_by_parentheses(item)
            result.extend(x)
        result = [x for x in result if x != '']
        return result


class FixedDict(object):
    """
    This class allows creating objects with predefined attributes
    (defined via static properties). Any attempt to set attribute
    not present as a static property raises AttributeError.
    """
    def __setattr__(self, key, value):
        if not key in dict(inspect.getmembers(self.__class__)):
            raise AttributeError('No such attribute: %s' % key)
        else:
            self.__dict__[key] = value

    def __init__(self):
        for item in inspect.getmembers(self.__class__):
            if not item[0].startswith('__'):
                self.__dict__[item[0]] = item[1]

    def __iter__(self):
        for k, v in self.__dict__.items():
            yield k, v