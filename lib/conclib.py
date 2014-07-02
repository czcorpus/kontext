#!/usr/bin/env python
# Copyright (c) 2003-2009  Pavel Rychly
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; version 2
# dated June, 1991.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

import os
import sys
import time

import manatee
import settings
from butils import *
from translation import ugettext as _
from pyconc import PyConc
from kwiclib import tokens2strclass
from strings import import_string

try:
    import fcntl
except ImportError:
    try:
        import msvcrt
    except ImportError:
        # no locking available, dummy defs
        flck_sh_lock = flck_ex_lock = flck_unlock = lambda f: None
    else:
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
        fcntl.lockf(file, fcntl.LOCK_SH, 1, 0, 0)

    def flck_ex_lock(file):
        fcntl.lockf(file, fcntl.LOCK_EX, 1, 0, 0)

    def flck_unlock(file):
        fcntl.lockf(file, fcntl.LOCK_UN, 1, 0, 0)


def pos_ctxs(min_hitlen, max_hitlen, max_ctx=3):
    ctxs = [{'n': _('%iL') % -c, 'ctx': '%i<0' % c} for c in range(-
                                                                   max_ctx, 0)]
    if max_hitlen == 1:
        ctxs.append({'n': _('Node'), 'ctx': '0~0>0'})
    else:
        ctxs.extend([{'n': 'Node %i' % c, 'ctx': '%i<0' % c}
                    for c in range(1, max_hitlen + 1)])
    ctxs.extend([{'n': _('%iR') % c, 'ctx': '%i>0' % c}
                for c in range(1, max_ctx + 1)])
    return ctxs


def load_map(cache_dir):
    import cPickle
    try:
        f = open(cache_dir + '00CONCS.map', 'rb')
    except IOError:
        return {}
    try:
        flck_sh_lock(f)
        ret = cPickle.load(f)
        flck_unlock(f)
    except cPickle.UnpicklingError:
        os.rename(cache_dir + '00CONCS.map',
                  cache_dir + '00CONCS-broken-%d.map' % os.getpid())
        return {}
    return ret


def get_cached_conc_sizes(corp, q=[], cache_dir='cache', cachefile=None):
    import struct

    ans = {'finished': None, 'concsize': None, 'fullsize': None, 'relconcsize': None}

    if not cachefile:  # AJAX call
        q = tuple(q)
        subchash = getattr(corp, 'subchash', None)
        cache_dir = cache_dir + '/' + corp.corpname + '/'
        saved = load_map(cache_dir)
        cache_val = saved.get((subchash, q))
        if cache_val:
            cachefile = os.path.join(cache_dir, cache_val[0] + '.conc')

    if cachefile:
        cache = open(cachefile, 'rb')
        flck_sh_lock(cache)
        cache.seek(15)
        finished = str(ord(cache.read(1)))
        (fullsize,) = struct.unpack('q', cache.read(8))
        cache.seek(32)
        (concsize,) = struct.unpack('i', cache.read(4))
        flck_unlock(cache)

        if fullsize > 0:
            relconcsize = 1000000.0 * fullsize / corp.search_size()
        else:
            relconcsize = 1000000.0 * concsize / corp.search_size()

        ans['finished'] = finished
        ans['concsize'] = concsize
        ans['fullsize'] = fullsize
        ans['relconcsize'] = relconcsize

    return ans


def uniqname(key, used):
    name = '#'.join([''.join([c for c in w if c.isalnum()]) for w in key])
    name = name[1:15].encode("UTF-8")  # UTF-8 because os.path manipulations
    if not name:
        name = 'noalnums'
    if name in used:
        used = [w[len(name):] for w in used if w.startswith(name)]
        i = 0
        while str(i) in used:
            i += 1
        name += str(i)
    return name


def add_to_map(cache_dir, pid_dir, subchash, key, size):
    import cPickle
    kmap = pidfile = None
    try:
        f = open(cache_dir + '00CONCS.map', 'r+b')
    except IOError:
        f = open(cache_dir + '00CONCS.map', 'wb')
        kmap = {}
    flck_ex_lock(f)
    if kmap is None:
        kmap = cPickle.load(f)
    if (subchash, key) in kmap:
        ret, storedsize = kmap[subchash, key]
        if storedsize < size:
            kmap[subchash, key] = (ret, size)
            f.seek(0)
            cPickle.dump(kmap, f)
    else:
        ret = uniqname(key, [r for (r, s) in kmap.values()])
        kmap[subchash, key] = (ret, size)
        f.seek(0)
        cPickle.dump(kmap, f)
        pidfile = open(pid_dir + ret + ".pid", "w")
        pidfile.write(str(os.getpid()) + "\n")
        pidfile.flush()
    f.close()  # also automatically flck_unlock (f)
    if not pidfile:
        pidfile = pid_dir + ret + ".pid"
    return cache_dir + ret + ".conc", pidfile


def del_from_map(cache_dir, subchash, key):
    import cPickle
    try:
        f = open(cache_dir + '00CONCS.map', 'r+b')
    except IOError:
        return
    flck_ex_lock(f)
    kmap = cPickle.load(f)
    try:
        del kmap[subchash, key]
        f.seek(0)
        cPickle.dump(kmap, f)
    except KeyError:
        pass
    f.close()  # also automatically flck_unlock (f)


def wait_for_conc(corp, q, cachefile, pidfile, minsize):
    pidfile = os.path.realpath(pidfile)
    sleeptime = 1
    while True:
        if sleeptime % 5 == 0 and not is_conc_alive(pidfile):
            return
        try:
            sizes = get_cached_conc_sizes(corp, q, None, cachefile)
            if minsize == -1:
                if sizes["finished"] == 1:  # whole conc
                    return
            elif sizes["concsize"] >= minsize:
                return
        except:
            pass
        time.sleep(sleeptime * 0.1)
        sleeptime += 1


def is_conc_alive(pidfile):
    try:
        pid = open(pidfile).readline()[:-1]
        link = os.readlink("/proc/%s/fd/1" % pid)
        if link != pidfile:
            return False
    except:
        return False
    return True


def contains_shuffle_seq(q_ops):
    """
    Tests whether the provided query sequence contains a subsequence
    of 'shuffle' operation (e.g. on ['foo', 'bar', 'f', 'f', 'something'] returns True)
    """
    prev_shuffle = False
    for item in q_ops:
        if item == 'f':
            if prev_shuffle:
                return True
            else:
                prev_shuffle = True
        else:
            prev_shuffle = False
    return False


def get_cached_conc(corp, subchash, q, cache_dir, pid_dir, minsize):
    q = tuple(q)
    try:
        if not os.path.isdir(pid_dir):
            os.makedirs(pid_dir)
        if not os.path.isdir(cache_dir):
            os.makedirs(cache_dir)
        elif (os.stat(cache_dir + '00CONCS.map').st_mtime
              < os.stat(corp.get_conf('PATH') + 'word.text').st_mtime):
            os.remove(cache_dir + '00CONCS.map')
            for f in os.listdir(cache_dir):
                os.remove(cache_dir + f)
    except OSError:
        pass

    saved = load_map(cache_dir)
    if contains_shuffle_seq(q):
        srch_from = 1
    else:
        srch_from = len(q)

    for i in range(srch_from, 0, -1):
        cache_val = saved.get((subchash, q[:i]))
        if cache_val:
            cachefile = os.path.join(cache_dir, cache_val[0] + '.conc')
            pidfile = os.path.realpath(pid_dir + cache_val[0] + ".pid")
            wait_for_conc(corp, q, cachefile, pidfile, minsize)
            if not os.path.exists(cachefile):  # broken cache
                del_from_map(cache_dir, subchash, q)
                try:
                    os.remove(pidfile)
                except OSError:
                    pass
                continue
            conccorp = corp
            for qq in reversed(q[:i]):  # find the right main corp, if aligned
                if qq.startswith('x-'):
                    conccorp = manatee.Corpus(qq[2:])
                    break
            conc = PyConc(conccorp, 'l', cachefile, orig_corp=corp)
            if not is_conc_alive(pidfile) and not conc.finished():
                # unfinished and dead concordance
                del_from_map(cache_dir, subchash, q)
                try:
                    os.remove(cachefile)
                except OSError:
                    pass
                try:
                    os.remove(pidfile)
                except OSError:
                    pass
                continue
            return i, conc
    return 0, None


def compute_conc(corp, q, cache_dir, subchash, samplesize, fullsize, pid_dir):
    q = tuple(q)
    if q[0][0] == "R":  # online sample
        if fullsize == -1:  # need to compute original conc first
            q_copy = list(q)
            q_copy[0] = q[0][1:]
            q_copy = tuple(q_copy)
            conc = None
            cachefile, pidfile = add_to_map(cache_dir, pid_dir, subchash,
                                            q_copy, 0)
            if type(pidfile) != file:  # computation got started meanwhile
                wait_for_conc(corp, q, cachefile, pidfile, -1)
                fullsize = PyConc(corp, 'l', cachefile).fullsize()
            else:
                conc = PyConc(corp, q[0][1], q[0][2:], samplesize)
                conc.sync()
                conc.save(cachefile)
                # update size in map file
                add_to_map(cache_dir, pid_dir, subchash, q_copy, conc.size())
                fullsize = conc.fullsize()
                os.remove(pidfile.name)
                pidfile.close()
        return PyConc(corp, q[0][1], q[0][2:], samplesize, fullsize)
    else:
        return PyConc(corp, q[0][0], q[0][1:], samplesize)


def get_conc(corp, minsize=None, q=[], fromp=0, pagesize=0, async=0, save=0,
            cache_dir='cache', samplesize=0, debug=False):
    if not q:
        return None
    q = tuple(q)
    if not minsize:
        if len(q) > 1:  # subsequent concordance processing by its methods
                       # needs whole concordance
            minsize = -1
        else:
            minsize = fromp * pagesize
    cache_dir = cache_dir + '/' + corp.corpname + '/'
    pid_dir = cache_dir + "run/"
    subchash = getattr(corp, 'subchash', None)
    conc = None
    fullsize = -1
    # try to locate concordance in cache
    if save:
        toprocess, conc = get_cached_conc(
            corp, subchash, q, cache_dir, pid_dir,
                                          minsize)
        if toprocess == len(q):
            save = 0
        if not conc and q[0][0] == "R":  # online sample
            q_copy = list(q)
            q_copy[0] = q[0][1:]
            q_copy = tuple(q_copy)
            t, c = get_cached_conc(corp, subchash, q_copy, cache_dir,
                                    pid_dir, -1)
            if c:
                fullsize = c.fullsize()
    else:
        async = 0
    # cache miss or not used
    if not conc:
        toprocess = 1

        if async and len(q) == 1:  # asynchronous processing

            r, w = os.pipe()
            r, w = os.fdopen(r, 'r'), os.fdopen(w, 'w')
            if os.fork() == 0:  # child
                r.close()  # child writes
                title = "bonito concordance;corp:%s;action:%s;params:%s;" \
                        % (corp.get_conffile(), q[0][0], q[0][1:])
                setproctitle(title.encode("utf-8"))
                # close stdin/stdout/stderr so that the webserver closes
                # connection to client when parent ends
                os.close(0)
                os.close(1)
                os.close(2)
                # PID file will have fd 1
                pidfile = None
                try:
                    cachefile, pidfile = add_to_map(cache_dir, pid_dir,
                                                     subchash, q, 0)
                    if type(pidfile) != file:
                        # conc got started meanwhile by another process
                        w.write(cachefile + "\n" + pidfile)
                        w.close()
                        os._exit(0)
                    w.write(cachefile + "\n" + pidfile.name)
                    w.close()
                    conc = compute_conc(corp, q, cache_dir, subchash, samplesize,
                                        fullsize, pid_dir)
                    sleeptime = 0.1
                    time.sleep(sleeptime)
                    conc.save(cachefile, False, True)  # partial
                    while not conc.finished():
                        conc.save(
                            cachefile, False, True, True)  # partial + append
                        time.sleep(sleeptime)
                        sleeptime += 0.1
                    tmp_cachefile = cachefile + ".tmp"
                    conc.save(tmp_cachefile)  # whole
                    os.rename(tmp_cachefile, cachefile)
                    # update size in map file
                    add_to_map(cache_dir, pid_dir, subchash, q, conc.size())
                    os.remove(pidfile.name)
                    pidfile.close()
                    os._exit(0)
                except:
                    if not w.closed:
                        w.write("error\nerror")
                        w.close()
                    import traceback
                    if type(pidfile) == file:
                        traceback.print_exc(None, pidfile)
                        pidfile.close()
                    if debug:
                        err_log = open(pid_dir + "/debug.log", "a")
                        err_log.write(time.strftime("%x %X\n"))
                        traceback.print_exc(None, err_log)
                        err_log.close()
                    os._exit(0)
            else:  # parent
                w.close()  # parent reads
                cachefile, pidfile = r.read().split("\n")
                r.close()
                wait_for_conc(corp, q, cachefile, pidfile, minsize)
                if not os.path.exists(cachefile):
                    try:
                        msg = open(pidfile).read().split("\n")[-2]
                    except:
                        msg = "Failed to process request."
                    raise RuntimeError(unicode(msg, "utf-8"))
                conc = PyConc(corp, 'l', cachefile)
        else:  # synchronous processing
            conc = compute_conc(corp, q, cache_dir, subchash, samplesize,
                                fullsize, pid_dir)
            conc.sync()  # wait for the computation to finish
            if save:
                os.close(0)  # PID file will have fd 1
                cachefile, pidfile = add_to_map(cache_dir, pid_dir, subchash,
                                                 q[:1], conc.size())
                conc.save(cachefile)
                # update size in map file
                add_to_map(cache_dir, pid_dir, subchash, q[:1], conc.size())
                os.remove(pidfile.name)
                pidfile.close()
    # process subsequent concordance actions (e.g. sample)
    for act in range(toprocess, len(q)):
        command = q[act][0]
        getattr(conc, 'command_' + command)(q[act][1:])
        if command in 'gae':  # user specific/volatile actions, cannot save
            save = 0
        if save:
            cachefile, pidfile = add_to_map(cache_dir, pid_dir, subchash,
                                             q[:act + 1], conc.size())
            if type(pidfile) != file:
                wait_for_conc(corp, q[:act + 1], cachefile, pidfile, -1)
            else:
                conc.save(cachefile)
                os.remove(pidfile.name)
                pidfile.close()
    return conc


def conc_is_sorted(q):
    """
    """
    ans = True
    for item in q:
        if item[0] in ('r', 'f'):
            ans = False
        elif item[0] in ('s', ):
            ans = True
    return ans


def get_conc_desc(q=[], cache_dir='cache', corpname='', subchash=None, translate=True):
    if translate:
        _t = lambda s: _(s)
    else:
        _t = lambda s: s
    desctext = {'q': _t('Query'),
                'a': _t('Query'),
                'r': _t('Random sample'),
                's': _t('Sort'),
                'f': _t('Shuffle'),
                'n': _t('Negative filter'),
                'N': _t('Negative filter (excluding KWIC)'),
                'p': _t('Positive filter'),
                'P': _t('Positive filter (excluding KWIC)'),
                'w': _t('Word sketch item'),
                't': _t('Word sketch texttype item'),
                'e': _t('GDEX'),
                'x': _t('Switch KWIC'),
                }
    forms = {'q': ('first_form', 'cql'),
             'a': ('first_form', 'cql'),
             'r': ('reduce_form', 'rlines'),
             's': ('sort', ''),
             'n': ('first_form', ''),
             'p': ('first_form', ''),
             'f': ('', ''),
             'w': ('', ''),
             't': ('', ''),
             }
    desc = []
    saved = load_map(cache_dir + '/' + corpname + '/')
    q = tuple(q)

    for i in range(len(q)):
        size = saved.get((subchash, q[:i + 1]), ('', ''))[1]
        opid = q[i][0]
        args = q[i][1:]
        url1p = [('q', qi) for qi in q[:i]]
        url2 = [('q', qi) for qi in q[:i + 1]]
        op = desctext.get(opid)
        formname = forms.get(opid, ('', ''))
        if formname[1]:
            url1p.append((formname[1], args))

        if opid == 's' and args[0] != '*' and i > 0:
            sortopt = {'-1<0': 'left context',
                       '0<0~': 'node',
                       '1>0~': 'right context'}
            sortattrs = args.split()
            if len(sortattrs) > 2:
                op = 'Multilevel Sort'
            args = '%s in %s' % (sortattrs[0].split('/')[0],
                                 sortopt.get(sortattrs[1][:4], sortattrs[1]))
            url1p.append(('skey', {'-1': 'lc', '0<': 'kw', '1>': 'rc'}
                           .get(sortattrs[1][:2], '')))
        elif opid == 'f':
            size = ''
            args = _('enabled')
        if op:
            if formname[0]:
                url1 = '%s?%s' % (formname[0], url1p)
            else:
                url1 = ''
            desc.append((op, args, url1, url2, size))
    return desc





def get_full_ref(corp, pos):
    data = {}
    refs = [(n == '#' and ('#', str(pos)) or
             (n, corp.get_attr(n).pos2str(pos)))
            for n in corp.get_conf('FULLREF').split(',') if n != settings.get('corpora', 'speech_segment_struct_attr')]
    data['Refs'] = [{'name': n == '#' and _('Token number')
                             or corp.get_conf(n + '.LABEL') or n,
                     'val': v}
                    for n, v in refs]
    for n, v in refs:
        data[n.replace('.', '_')] = v
    return data


def get_detail_context(corp, pos, hitlen=1,
                        detail_left_ctx=40, detail_right_ctx=40,
                        addattrs=[], structs='', detail_ctx_incr=60):
    data = {}
    corpus_encoding = corp.get_conf('ENCODING')
    wrapdetail = corp.get_conf('WRAPDETAIL')
    if wrapdetail:
        data['wrapdetail'] = '<%s>' % wrapdetail
        if not wrapdetail in structs.split(','):
            data['deletewrap'] = True
        structs = wrapdetail + ',' + structs
    else:
        data['wrapdetail'] = ''
    try:
        maxdetail = int(corp.get_conf('MAXDETAIL'))
        if maxdetail == 0:
            maxdetail = int(corp.get_conf('MAXCONTEXT'))
            if maxdetail == 0:
                maxdetail = sys.maxint
    except:
        maxdetail = 0
    if maxdetail:
        if detail_left_ctx > maxdetail:
            detail_left_ctx = maxdetail
        if detail_right_ctx > maxdetail:
            detail_right_ctx = maxdetail
    if detail_left_ctx > pos:
        detail_left_ctx = pos
    attrs = ','.join(['word'] + addattrs)
    cr = manatee.CorpRegion(corp, attrs, structs)
    region_left = tokens2strclass(cr.region(pos - detail_left_ctx, pos))
    region_kwic = tokens2strclass(cr.region(pos, pos + hitlen))
    region_right = tokens2strclass(cr.region(pos + hitlen,
                                              pos + hitlen + detail_right_ctx))
    for seg in region_left + region_kwic + region_right:
        seg['str'] = import_string(seg['str'].replace('===NONE===', ''), from_encoding=corpus_encoding)
    for seg in region_kwic:
        if not seg['class']:
            seg['class'] = 'coll'
    data['content'] = region_left + region_kwic + region_right
    refbase = 'pos=%i;' % pos
    if hitlen != 1:
        refbase += 'hitlen=%i;' % hitlen
    data['leftlink'] = refbase + ('detail_left_ctx=%i;detail_right_ctx=%i'
                                  % (detail_left_ctx + detail_ctx_incr,
                                     detail_right_ctx))
    data['rightlink'] = refbase + ('detail_left_ctx=%i;detail_right_ctx=%i'
                                   % (detail_left_ctx,
                                      detail_right_ctx + detail_ctx_incr))
    data['righttoleft'] = corp.get_conf('RIGHTTOLEFT')
    data['pos'] = pos
    data['maxdetail'] = maxdetail
    return data


def fcs_scan(corpname, scan_query, max_ter, start):
    """
    aux function for federated content search: operation=scan
    """
    if not scan_query:
        raise Exception(7, '', 'Mandatory parameter not supplied')
    query = scan_query.replace('+', ' ')  # convert URL spaces
    exact_match = False
    if 'exact' in query.lower() and not '=' in query:  # lemma ExacT "dog"
        pos = query.lower().index('exact')  # first occurence of EXACT
        query = query[:pos] + '=' + query[pos+5:]  # 1st exact > =
        exact_match = True
    corp = manatee.Corpus(corpname)
    attrs = corp.get_conf('ATTRLIST').split(',')  # list of available attrs
    try:
        if '=' in query:
            attr, value = query.split('=')
            attr = attr.strip()
            value = value.strip()
        else:  # must be in format attr = value
            raise Exception
        if '"' in attr:
            raise Exception
        if '"' in value:
            if value[0] == '"' and value[-1] == '"':
                value = value[1:-1].strip()
            else:
                raise Exception
    except Exception, e:
        raise Exception(10, scan_query, 'Query syntax error')
    if not attr in attrs:
        raise Exception(16, attr, 'Unsupported index')
    import corplib
    if exact_match:
        wlpattern = '^' + value + '$'
    else:
        wlpattern = '.*' + value + '.*'
    wl = corplib.wordlist(corp, wlattr=attr, wlpat=wlpattern, wlsort='f')
    return [(d['str'], d['freq']) for d in wl][start:][:max_ter]

