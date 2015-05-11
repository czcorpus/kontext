# Copyright (c) 2003-2014  Pavel Rychly, Vojtech Kovar, Milos Jakubicek, Milos Husak, Vit Baisa
# Copyright (c) 2014 Institute of the Czech National Corpus
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
import logging
from multiprocessing import Process, Pipe
import cPickle
import math

import manatee
import settings
from butils import flck_sh_lock, flck_unlock, setproctitle
from translation import ugettext as _
from pyconc import PyConc
from kwiclib import tokens2strclass
from l10n import import_string
import plugins

cache_factory = plugins.conc_cache


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


def get_cached_conc_sizes(corp, q=None, cachefile=None):
    """
    arguments:
    corp -- manatee.Corpus instance
    q -- a list containing preprocessed query
    cachefile -- if not provided then the path is determined automatically
    using CACHE_ROOT_DIR and corpus name, corpus name and the query

    returns:
    a dictionary {
        finished : 0/1,
        concsize : int,
        fullsize : int,
        relconcsize : float (concordance size recalculated to a million corpus)
    }
    """
    import struct

    if q is None:
        q = []
    ans = {'finished': False, 'concsize': None, 'fullsize': None, 'relconcsize': None}
    if not cachefile:  # AJAX call
        q = tuple(q)
        subchash = getattr(corp, 'subchash', None)
        cache_map = cache_factory.get_mapping(corp)
        cachefile = cache_map.cache_file_path(subchash, q)

    if cachefile and os.path.isfile(cachefile):
        cache = open(cachefile, 'rb')
        flck_sh_lock(cache)
        cache.seek(15)
        finished = bool(ord(cache.read(1)))
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


def _wait_for_conc(corp, q, subchash, cachefile, cache_map, pidfile, minsize):
    """
    Called by webserver process (i.e. not by the background worker).
    Waits in a loop until a minimal acceptable cached concordance occurs
    (i.e. in general this does not wait for the complete concordance -
    the fact depends on the 'minisize' parameter; if -1 then only whole conc. is
    accepted).

    arguments:
    corp -- a manatee.Corpus instance
    q -- a query tuple
    subchash -- a subcorpus name transformed into a cache key entry
    cachefile -- concordance cache file path
    cache_map -- a CacheMapping instance
    pidfile -- a running worker information file path
    minsize -- what intermediate concordance size we will wait for (-1 => whole conc.)
    """
    if type(pidfile) is tuple:  # TODO: this is just a temporary fix (a cause should be found)
        logging.getLogger(__name__).warning('Incorrect pidfile argument format. Params: q=%s, cachefile=%s, pidfile=%s' %
                                            (q, cachefile, pidfile[0]))
        pidfile = pidfile[0]
    pidfile = os.path.realpath(pidfile)
    hard_limit = 3000  # num iterations (time = hard_limit / 10)
    i = 1
    while _is_conc_alive(pidfile) and i < hard_limit:
        try:
            sizes = get_cached_conc_sizes(corp, q, cachefile)
            if minsize == -1:
                if sizes['finished'] == 1:  # whole conc
                    break
            elif sizes['concsize'] >= minsize:
                break
        except Exception as e:
            logging.getLogger(__name__).warning('Concordance calculation error (ignored): %s' % e)
        time.sleep(i * 0.1)
        i += 1
    if not os.path.isfile(cachefile):
        if i >= hard_limit:
            logging.getLogger(__name__).warning('Hardcoded limit %01.2f sec. for intermediate concordance exceeded.'
                                                % (hard_limit / 10.))
        cache_map.del_full_entry((subchash, q))
        raise Exception('Failed to calculate the concordance. Missing cache file: %s' % cachefile)


def _is_conc_alive(pidfile):
    if os.path.exists(pidfile):
        with open(pidfile, 'r') as f:
            data = cPickle.load(f)
            # TODO: still not bullet-proof solution
            err = data.get('error', None)
            if isinstance(err, Exception):
                raise err
            elif err:
                raise Exception(str(data['error']))
            elif math.ceil(data['last_check'] + data['curr_wait']) < math.floor(time.time()):
                return False
        return True
    else:
        return False


def _contains_shuffle_seq(q_ops):
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


def _get_cached_conc(corp, subchash, q, pid_dir, minsize):
    """
    Loads a concordance from cache
    """
    start_time = time.time()
    q = tuple(q)
    if not os.path.isdir(pid_dir):
        os.makedirs(pid_dir)

    cache_map = cache_factory.get_mapping(corp)
    cache_map.refresh_map()
    if _contains_shuffle_seq(q):
        srch_from = 1
    else:
        srch_from = len(q)

    ans = (0, None)
    for i in range(srch_from, 0, -1):
        cachefile = cache_map.cache_file_path(subchash, q[:i])
        if cachefile:
            pidfile = os.path.realpath(pid_dir + cache_map[(subchash, q[:i])][0] + '.pid')
            _wait_for_conc(corp=corp, q=q, subchash=subchash, cachefile=cachefile,
                           cache_map=cache_map, pidfile=pidfile, minsize=minsize)
            if not os.path.exists(cachefile):  # broken cache
                del cache_map[(subchash, q)]
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
            if not _is_conc_alive(pidfile) and not conc.finished():
                # unfinished and dead concordance
                del cache_map[(subchash, q)]
                try:
                    os.remove(cachefile)
                except OSError:
                    pass
                try:
                    os.remove(pidfile)
                except OSError:
                    pass
                continue
            ans = (i, conc)
            break
    logging.getLogger(__name__).debug('get_cached_conc(%s, [%s]) -> %s, %01.4f'
                                      % (corp.corpname, ','.join(q), 'hit' if ans[1] else 'miss',
                                         time.time() - start_time))
    return ans


def _compute_conc(corp, q, subchash, samplesize, fullsize, pid_dir):
    start_time = time.time()
    q = tuple(q)
    if q[0][0] == 'R':  # online sample
        if fullsize == -1:  # need to compute original conc first
            q_copy = list(q)
            q_copy[0] = q[0][1:]
            q_copy = tuple(q_copy)
            cache_map = cache_factory.get_mapping(corp)
            cachefile, pidfile, in_progress = cache_map.add_to_map(pid_dir, subchash, q_copy, 0)
            if in_progress:  # computation got started meanwhile
                _wait_for_conc(corp=corp, q=q, subchash=subchash, cachefile=cachefile, cache_map=cache_map,
                               pidfile=pidfile, minsize=-1)
                fullsize = PyConc(corp, 'l', cachefile).fullsize()
            else:
                conc = PyConc(corp, q[0][1], q[0][2:], samplesize)
                conc.sync()
                conc.save(cachefile)
                # update size in map file
                cache_map.add_to_map(pid_dir, subchash, q_copy, conc.size())
                fullsize = conc.fullsize()
                os.remove(pidfile)
        ans_conc = PyConc(corp, q[0][1], q[0][2:], samplesize, fullsize)
    else:
        ans_conc = PyConc(corp, q[0][0], q[0][1:], samplesize)
    logging.getLogger(__name__).debug('compute_conc(%s, [%s]) -> %01.4f' % (corp.corpname, ','.join(q),
                                                                            time.time() - start_time))
    return ans_conc


def _update_pidfile(file_path, **kwargs):
    with open(file_path, 'r') as pf:
        data = cPickle.load(pf)
    data.update(kwargs)
    with open(file_path, 'w') as pf:
        cPickle.dump(data, pf)


class BackgroundCalc(object):
    """
    This class wraps background calculation of a concordance (see _get_async_conc() function
    below).
    """

    def __init__(self, sending_pipe, corpus, pid_dir, subchash, q):
        """
        arguments:
        sending_pipe -- a multiprocessing.Pipe instance used to send data from this process to its parent
        corpus -- a manatee.Corpus instance
        pid_dir -- a directory where "pidfile" (= file containing information about background calculation) will be
                   temporarily stored
        subchash -- an identifier of current subcorpus (None if no subcorpus is in use)
        q -- a tuple/list containing current query
        """
        self._pipe = sending_pipe
        self._corpus = corpus
        self._pid_dir = pid_dir
        self._subchash = subchash
        self._q = q

    def __call__(self, samplesize, fullsize):
        sleeptime = None
        try:
            cache_map = cache_factory.get_mapping(self._corpus)
            cachefile, pidfile, in_progress = cache_map.add_to_map(self._pid_dir, self._subchash,
                                                                   self._q, 0)

            if not in_progress:
                self._pipe.send(cachefile + '\n' + pidfile)
                # The conc object bellow is asynchronous; i.e. you obtain it immediately but it may
                # not be ready yet (this is checked by the 'finished()' method).
                conc = _compute_conc(self._corpus, self._q, self._subchash, samplesize,
                                     fullsize, self._pid_dir)
                sleeptime = 0.1
                time.sleep(sleeptime)
                conc.save(cachefile, False, True)  # partial
                while not conc.finished():
                    conc.save(cachefile, False, True, True)  # partial + append
                    time.sleep(sleeptime)
                    sleeptime += 0.1
                    _update_pidfile(pidfile, last_check=int(time.time()), curr_wait=sleeptime)
                tmp_cachefile = cachefile + '.tmp'
                conc.save(tmp_cachefile)  # whole
                os.rename(tmp_cachefile, cachefile)
                # update size in map file
                cache_map.add_to_map(self._pid_dir, self._subchash, self._q, conc.size())
                os.remove(pidfile)
        except Exception as e:
            # Please note that there is no need to clean any mess (pidfile of failed calculation,
            # unfinished cached concordance etc.) here as this is performed by _get_cached_conc()
            # function in case it detects a problem.
            import traceback
            logging.getLogger(__name__).error('Background calculation error: %s' % e)
            logging.getLogger(__name__).error(''.join(traceback.format_exception(*sys.exc_info())))
            _update_pidfile(pidfile, last_check=int(time.time()), curr_wait=sleeptime, error=str(e))


def _get_async_conc(corp, q, save, pid_dir, subchash, samplesize, fullsize, minsize):
    """
    Note: 'save' argument is present because of bonito-open-3.45.11 compatibility but it is currently not used
    """
    parent_conn, child_conn = Pipe(duplex=False)
    calc = BackgroundCalc(sending_pipe=child_conn, corpus=corp, pid_dir=pid_dir, subchash=subchash, q=q)
    proc = Process(target=calc, args=(samplesize, fullsize))
    proc.start()

    cachefile, pidfile = parent_conn.recv().split('\n')
    try:
        _wait_for_conc(corp=corp, q=q, subchash=subchash, cachefile=cachefile,
                       cache_map=cache_factory.get_mapping(corp), pidfile=pidfile, minsize=minsize)
        if not os.path.exists(cachefile):
            raise RuntimeError('Concordance cache file [%s] not created. PID file: %s' % (cachefile, pidfile))
    except Exception as e:
        if os.path.exists(pidfile):
            os.remove(pidfile)
        raise e
    return PyConc(corp, 'l', cachefile)


def _get_sync_conc(corp, q, save, subchash, samplesize, fullsize, pid_dir):
    conc = _compute_conc(corp, q, subchash, samplesize, fullsize, pid_dir)
    conc.sync()  # wait for the computation to finish
    if save:
        os.close(0)  # PID file will have fd 1
        cache_map = cache_factory.get_mapping(corp)
        cachefile, pidfile, in_progress = cache_map.add_to_map(pid_dir, subchash, q[:1], conc.size())
        conc.save(cachefile)
        # update size in map file
        cache_map.add_to_map(pid_dir, subchash, q[:1], conc.size())
        os.remove(pidfile)
    return conc


def get_conc(corp, minsize=None, q=None, fromp=0, pagesize=0, async=0, save=0, samplesize=0):
    if not q:
        return None
    q = tuple(q)
    if not minsize:
        if len(q) > 1:  # subsequent concordance processing by its methods
                       # needs whole concordance
            minsize = -1
        else:
            minsize = fromp * pagesize
    pid_dir = settings.get('corpora', 'calc_pid_dir')
    subchash = getattr(corp, 'subchash', None)
    conc = None
    fullsize = -1
    # try to locate concordance in cache
    if save:
        toprocess, conc = _get_cached_conc(corp, subchash, q, pid_dir, minsize)
        if toprocess == len(q):
            save = 0
        if not conc and q[0][0] == 'R':  # online sample
            q_copy = list(q)
            q_copy[0] = q[0][1:]
            q_copy = tuple(q_copy)
            t, c = _get_cached_conc(corp, subchash, q_copy, pid_dir, -1)
            if c:
                fullsize = c.fullsize()
    else:
        async = 0
    # cache miss or not used
    if not conc:
        toprocess = 1
        if async and len(q) == 1:  # asynchronous processing
            conc = _get_async_conc(corp=corp, q=q, save=save, pid_dir=pid_dir, subchash=subchash,
                                   samplesize=samplesize, fullsize=fullsize, minsize=minsize)

        else:
            conc = _get_sync_conc(corp=corp, q=q, save=save, pid_dir=pid_dir, subchash=subchash,
                                  samplesize=samplesize, fullsize=fullsize)
    # process subsequent concordance actions (e.g. sample)
    for act in range(toprocess, len(q)):
        command = q[act][0]
        getattr(conc, 'command_' + command)(q[act][1:])
        if command in 'gae':  # user specific/volatile actions, cannot save
            save = 0
        if save:
            cache_map = cache_factory.get_mapping(corp)
            cachefile, pidfile, in_progress = cache_map.add_to_map(pid_dir, subchash, q[:act + 1], conc.size())
            if in_progress:
                _wait_for_conc(corp=corp, q=q[:act + 1], subchash=subchash, cachefile=cachefile,
                               cache_map=cache_map, pidfile=pidfile, minsize=-1)
            else:
                conc.save(cachefile)
                os.remove(pidfile)
    return conc


def conc_is_sorted(q):
    ans = True
    for item in q:
        if item[0] in ('r', 'f'):
            ans = False
        elif item[0] in ('s', ):
            ans = True
    return ans


def get_conc_desc(corpus, q=None, subchash=None, translate=True):
    """
    arguments:
    corpus -- an extended version (corpname attribute must be present) of
              manatee.Corpus object as provided by corplib.CorpusManager.get_Corpus
    q -- tuple/list of query elements
    subchash -- hashed subcorpus name as provided by corplib.CorpusManager.get_Corpus
    translate -- if True then all the messages are translated according to the current
                 thread's locale information
    """
    if q is None:
        q = []
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
    cache_map = cache_factory.get_mapping(corpus)
    q = tuple(q)

    for i in range(len(q)):
        cache_val = cache_map[(subchash, q[:i + 1])]
        if cache_val:
            size = cache_val[1]
        else:
            size = None
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
            url1p.append(('skey', {'-1': 'lc', '0<': 'kw', '1>': 'rc'}.get(sortattrs[1][:2], '')))
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
    corpus_encoding = corp.get_conf('ENCODING')
    data = {}
    refs = [(n == '#' and ('#', str(pos)) or
             (n, corp.get_attr(n).pos2str(pos)))
            for n in corp.get_conf('FULLREF').split(',') if n != settings.get('corpora', 'speech_segment_struct_attr')]
    data['Refs'] = [{'name': n == '#' and _('Token number') or corp.get_conf(n + '.LABEL') or n,
                     'val': import_string(v, corpus_encoding)} for n, v in refs]
    for n, v in refs:
        data[n.replace('.', '_')] = import_string(v, corpus_encoding)
    return data


def get_detail_context(corp, pos, hitlen=1, detail_left_ctx=40, detail_right_ctx=40,
                       addattrs=None, structs='', detail_ctx_incr=60):
    data = {}
    if addattrs is None:
        addattrs = []
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
    data['leftlink'] = refbase + ('detail_left_ctx=%i&detail_right_ctx=%i'
                                  % (detail_left_ctx + detail_ctx_incr,
                                     detail_right_ctx))
    data['rightlink'] = refbase + ('detail_left_ctx=%i&detail_right_ctx=%i'
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
    except Exception:
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
