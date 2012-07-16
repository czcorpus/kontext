#!/usr/bin/env python
# Copyright (c) 2003-2010  Pavel Rychly


import manatee
from urllib import urlencode
import os, re
from sys import stderr
            
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
        fcntl.lockf (file, fcntl.LOCK_SH, 1, 0, 0)
    def flck_ex_lock (file):
        fcntl.lockf (file, fcntl.LOCK_EX, 1, 0, 0)
    def flck_unlock (file):
        fcntl.lockf (file, fcntl.LOCK_UN, 1, 0, 0)


def printkwic (conc, froml=0, tol=5, leftctx='15#', rightctx='15#',
               attrs='word', refs='#', maxcontext=0):
    def strip_tags (tokens):
        return ''.join ([tokens[i] for i in range(0, len(tokens), 2)])
    kl = manatee.KWICLines (conc, leftctx, rightctx, attrs, 'word', 'p', refs, maxcontext)
    for line in range (froml, tol):
        kl.nextline (line)
        print '%s %s <%s> %s' % (kl.get_refs(), strip_tags (kl.get_left()),
                                 strip_tags (kl.get_kwic()),
                                 strip_tags (kl.get_right()))


def pos_ctxs (min_hitlen, max_hitlen, max_ctx=3):
    ctxs = [{'n':'%iL' % -c, 'ctx':'%i<0' % c} for c in range (-max_ctx, 0)]
    if max_hitlen == 1:
        ctxs.append ({'n':'Node', 'ctx': '0~0>0'})
    else:
        ctxs.extend ([{'n':'Node %i' % c, 'ctx':'%i<0' % c}
                      for c in range (1,max_hitlen+1)])
    ctxs.extend ([{'n':'%iR' % c, 'ctx':'%i>0' % c}
                  for c in range (1, max_ctx+1)])
    return ctxs


def add_block_items (items, attr='class', val='even', block_size=3):
    for i in [i for i in range (len (items)) if (i / block_size) % 2]:
        items[i][attr] = val
    return items
        
def kwicpage (conc, fromp=1, leftctx='40#', rightctx='40#', attrs='word',
              ctxattrs='word', refs='#', structs='p', pagesize=20,
              labelmap={}, righttoleft=False, alignlist=[], copy_icon=0,
              tbl_template='none'):
    refs = refs.replace('.MAP_OUP', '') # to be removed ...
    try:
        fromp = int(fromp)
        if fromp < 1:
            fromp = 1
    except:
        fromp = 1
    out = {'Lines': 
           kwiclines (conc, (fromp -1) * pagesize, fromp * pagesize,
                      leftctx, rightctx, attrs, ctxattrs, refs, structs,
                      labelmap, righttoleft, alignlist)}
    if copy_icon:
        from tbl_settings import tbl_refs, tbl_structs
        sen_refs = tbl_refs.get(tbl_template, '') + ',#'
        sen_refs = sen_refs.replace('.MAP_OUP', '') # to be removed ...
        sen_structs = tbl_structs.get(tbl_template, '') or 'g'
        sen_lines = kwiclines(conc, (fromp -1) * pagesize, fromp * pagesize,
                             '-1:s', '1:s', refs=sen_refs, structs=sen_structs)
        for old, new in zip(out['Lines'], sen_lines):
            old['Sen_Left'] = new['Left']
            old['Sen_Right'] = new['Right']
            old['Tbl_refs'] = new['Tbl_refs']
    if labelmap:
        out['GroupNumbers'] = format_labelmap (labelmap)
    if fromp > 1:
        out['prevlink'] = 'fromp=%i' % (fromp - 1)
        out['firstlink'] = 'fromp=1'
    if conc.size() > pagesize:
        out['fromp'] = fromp
        out['numofpages'] = numofpages = (conc.size()-1)/pagesize + 1
        if numofpages < 30:
            out['Page'] = [{'page':x} for x in range (1, numofpages+1)]
        if fromp < numofpages:
            out['nextlink'] = 'fromp=%i' % (fromp +1)
            out['lastlink'] = 'fromp=%i' % numofpages
    out['concsize'] = conc.size()
    #arf = conc.compute_ARF()
    #out['concarf'] = '%.2f' % arf
    return out

    
def kwiclines (conc, fromline, toline, leftctx='40#', rightctx='40#',
               attrs='word', ctxattrs='word', refs='#', structs='p',
               labelmap={}, righttoleft=False, alignlist=[],
               align_attrname='align', aattrs='word', astructs=''):
    def non1hitlen (hitlen):
        if hitlen == 1:
            return ''
        else:
            return ';hitlen=%i' % hitlen

    def tokens2strclass (tokens):
        return [{'str': tokens[i], 'class': tokens[i+1].strip ('{}')}
                for i in range(0, len(tokens), 2)]

    lines = []
    if righttoleft:
        rightlabel, leftlabel = 'Left', 'Right'
        structs += ',ltr'
        #from unicodedata import bidirectional
        def isengword (strclass):
            #return bidirectional(word[0]) in ('L', 'LRE', 'LRO')
            return 'ltr' in strclass['class'].split()
    else:
        leftlabel, rightlabel = 'Left', 'Right'

    if alignlist:
        alignlist = [(c, c.get_struct(align_attrname),
                  manatee.CorpRegion (c, aattrs, astructs)) for c in alignlist]
        align_struct = conc.corp.get_struct(align_attrname)

    kl = manatee.KWICLines (conc, leftctx, rightctx, attrs, ctxattrs,
                            structs, refs)
    labelmap = labelmap.copy()
    labelmap['_'] = '_'
    maxleftsize = 0
    for line in range (fromline, toline):
        if not kl.nextline (line):
            break
        linegroup = str (kl.get_linegroup() or '_')
        linegroup = labelmap.get (linegroup, '#' + linegroup)
        leftwords = tokens2strclass (kl.get_left())
        rightwords = tokens2strclass (kl.get_right())
        kwicwords = tokens2strclass (kl.get_kwic())
        if alignlist:
            n = align_struct.num_at_pos (kl.get_pos())
            if n < 0:
                aligned_texts = []
            else:
                aligned_texts = [
                    {'name': c.corpname,
                     'Words': tokens2strclass (cr.region (a.beg(n), a.end(n)))}
                    for (c, a, cr) in alignlist]
        else:
            aligned_texts = []

        if righttoleft:
            # change order for "English" context of "English" keywords
            if isengword(kwicwords[0]):
                # preceding words
                nprev = len(leftwords) -1
                while nprev >= 0 and isengword (leftwords[nprev]):
                    nprev -= 1
                if nprev == -1:
                    # move whole context
                    moveleft = leftwords
                    leftwords = []
                else:
                    moveleft = leftwords[nprev+1:]
                    del leftwords[nprev+1:]

                # following words
                nfollow = 0
                while (nfollow < len(rightwords)
                       and isengword (rightwords[nfollow])):
                    nfollow += 1
                moveright = rightwords[:nfollow]
                del rightwords[:nfollow]
                
                leftwords = leftwords + moveright
                rightwords = moveleft + rightwords

        leftsize = 0
        for w in leftwords:
            if not w['class'] == 'strc':
                leftsize += len(w['str']) + 1
        if leftsize > maxleftsize:
            maxleftsize = leftsize
                
        lines.append ({'toknum': kl.get_pos(),
                       'hitlen': non1hitlen (kl.get_kwiclen()),
                       'ref': kl.get_refs(),
                       'Tbl_refs': list(kl.get_ref_list()),
                       leftlabel: leftwords,
                       'Kwic': kwicwords,
                       rightlabel: rightwords,
                       'linegroup': linegroup,
                       'leftspace': ' ' * (maxleftsize - leftsize),
                       'Align': aligned_texts,
                       })
    return lines


def strkwiclines (conc, fromline, toline=None, leftctx='40#', rightctx='40#'):
    def tokens2str (tokens):
        return ''.join ([tokens[i] for i in range(0, len(tokens), 2)])
    toline = toline or fromline +1
    kl = manatee.KWICLines (conc, leftctx, rightctx, 'word', 'word','','')
    return [{'left': tokens2str (kl.get_left()),
             'kwic': tokens2str (kl.get_kwic()),
             'right': tokens2str (kl.get_right())}
            for line in range (fromline, toline) if kl.nextline (line)]


class PyConc (manatee.Concordance):
    selected_grps = []

    def __init__ (self, corp, action, params):
        self.corp = corp
        if action == 'q':
            # query
            manatee.Concordance.__init__ (self, corp, params, 0)
        elif action == 'a':
            # query with a default attribute
            default_attr, query = params.split (',', 1)
            corp.set_default_attr (default_attr)
            manatee.Concordance.__init__ (self, corp, query, 0)
        elif action == 'l':
            # load from a file
            manatee.Concordance.__init__ (self, corp, params)
        elif action == 's':
            # stored in _conc_dir
            manatee.Concordance.__init__ (self, corp,
                                          os.path.join (self.corp._conc_dir,
                                                        corp.corpname, 
                                                        params + '.conc'))
        elif action == 'w':
            # word sketch
            import wmap
            if params[0] == ',':
                # seek list
                slist = wmap.IntVector (map (int, params[1:].split(',')))
                ws = wmap.WMap (corp.get_conf('WSBASE'), 2)
                fs = ws.selected_poss (slist)
            elif params[0] == '-':
                # gramrel level
                ws = wmap.WMap (corp.get_conf('WSBASE'), 1, int (params[1:]))
                fs = ws.poss()
            else:
                # only one seek
                ws = wmap.WMap (corp.get_conf('WSBASE'), 2, int (params))
                fs = ws.poss()
            fs.thisown = False
            manatee.Concordance.__init__ (self, corp, fs)
        elif action == 't':
            # text type wordsketch -- will be replaced with filtered sketches
            import wmap
            suff, seek = params.split()
            ws = wmap.WMap (corp.get_conf('WSBASE') + suff, 2, int (seek))
            manatee.Concordance.__init__ (self, corp, ws.poss())
        else:
            raise RuntimeError(_('Unknown action'))

    def command_g (self, options):
        # sort according to linegroups
        annot = get_stored_conc (self.corp, options, self.corp._conc_dir)
        self.set_linegroup_from_conc (annot)
        lmap = annot.labelmap
        lmap[0] = None
        ids = manatee.IntVector(map (int, lmap.keys()))
        strs = manatee.StrVector(map (lngrp_sortstr, lmap.values()))
        self.linegroup_sort (ids, strs)

    def command_e (self, options):
        # sort first k lines using GDEX
        try: import gdex
        except ImportError: import gdex_old as gdex
        args = options.split(' ',1)
        if len(args) == 2:
            conf = args[1]
        else:
            conf = ''
        conf = self.corp.cm.gdexdict.get(conf, '')
        cnt = int(args[0]) or 100
        best = gdex.GDEX(self.corp, conf)
        best.entryConc (self)
        best_lines = manatee.IntVector([i for s,i
                                        in best.best_k(cnt, cnt)])
        self.set_sorted_view (best_lines)

    def command_s (self, options):
        if options[0] == '*':
            # old GDEX, used command_e, should be deleted in mid 2011
            self.command_e(options[1:])
        else:
            self.sort (options)

    def command_a (self, options):
        annotname, options = options.split(' ', 1)
        annot = get_stored_conc (self.corp, annotname, self.corp._conc_dir)
        self.set_linegroup_from_conc (annot)
        if options[0] == '-':
            self.delete_linegroups (options[1:], True)
        else:
            self.delete_linegroups (options, False)

    def command_d (self, options):
        self.delete_lines (options)

    def command_f (self, options):
        self.shuffle()
        
    def command_r (self, options):
        self.reduce_lines (options)
        
    def command_x (self, options):
        self.swap_kwic_coll (int(options))
        
    def command_n (self, options):
        self.pn_filter (options, 0)

    def command_p (self, options):
        self.pn_filter (options, 1)

    def pn_filter (self, options, ispositive):
        lctx, rctx, rank, query = options.split (None, 3)
        collnum = self.numofcolls() +1
        self.set_collocation (collnum, query +';', lctx, rctx, int(rank))
        self.delete_pnfilter (collnum, ispositive)

    def xfreq_dist (self, crit, limit=1, sortkey='f', normwidth=300, ml='',
                                                        ftt_include_empty=''):
        # ml = determines how the bar appears (multilevel x text type)
        # import math
        normheight=15
        def compute_corrections (freqs, norms):
            from operator import add
            sumn = float (reduce (add, norms))
            if sumn == 0:
                return float (normwidth) / max (freqs), 0
            else:
                sumf = float (reduce (add, freqs))
                corr = min (sumf / max (freqs), sumn / max (norms))
                return normwidth / sumf * corr, normwidth / sumn * corr
            
        words = manatee.StrVector()
        freqs = manatee.IntVector()
        norms = manatee.IntVector()
        self.freq_dist (crit, limit, words, freqs, norms)
        if not len (freqs):
            return {}

        attrs = crit.split()
        def label (attr):
            if '/' in attr:
                attr = attr [:attr.index('/')]
            return self.corp.get_conf (attr + '.LABEL') or attr
        head = [{'n': label (attrs[x]), 's': x/2}
                for x in range(0, len(attrs), 2)]
        head.append ({'n': 'Freq', 's': 'freq'})
        
        tofbar, tonbar = compute_corrections (freqs, norms)
        if (tonbar and not(ml)):
            maxf = max(freqs) # because of bar height
            minf = min(freqs)
            maxrel = 0; # because of bar width
            for index, (f, nf) in enumerate(zip(freqs, norms)):
                if nf == 0:
                    nf = 100000
                    norms[index] = 100000
                newrel = (f*tofbar / (nf*tonbar))
                if maxrel < newrel:
                    maxrel = newrel
            head.append ({'n': 'Rel [%]', 's': 'rel'})
            lines = [{'Word':[{'n': '  '.join(n.split('\v'))} for n in w.split('\t')],
                      'freq': f, 'fbar': int(f*tofbar)+1,
                      'norm': nf, 'nbar': int(nf*tonbar),
                      'relbar': 1 + int(f*tofbar*normwidth / (nf*tonbar*maxrel)),
                      'norel': ml,
                      'freqbar': int(normheight*(f-minf+1)/(maxf-minf+1)+1),
                      'rel': round (f*tofbar / (nf*tonbar) * 100, 1)}
                     for w,f,nf in zip (words, freqs, norms)]
        else:
            lines = [{'Word':[{'n': '  '.join(n.split('\v'))} for n in w.split('\t')],
                      'freq': f, 'fbar': int(f*tofbar)+1,
                      'norel': 1}
                     for w,f,nf in zip (words, freqs, norms)]

        if ftt_include_empty and limit == 0 and '.' in attrs[0]:
            attr = self.corp.get_attr(attrs[0])
            all_vals = [attr.id2str(i) for i in range (attr.id_range())]
            used_vals = [line['Word'][0]['n'] for line in lines]
            for v in all_vals:
                if v in used_vals: continue
                lines.append({ 'Word': [{'n': v}],
                               'freq': 0, 'rel': 0, 'norm': 0, 'nbar': 0,
                               'relbar':0, 'norel': ml, 'freq': 0,
                               'freqbar': 0, 'fbar': 0,
                             })

        if (sortkey in ('0','1','2')) and (int(sortkey)<len(lines[0]['Word'])):
            sortkey = int (sortkey)
            lines = [(x['Word'][sortkey]['n'], x) for x in lines]
            lines.sort()
        else:
            if sortkey not in ('freq', 'rel'):
                sortkey = 'freq'
            lines = [(x[sortkey], x) for x in lines]
            lines.sort()
            lines.reverse()

        return {'Head': head,
                'Items': add_block_items ([x[1] for x in lines], block_size=2)}


    def xdistribution (self, xrange, yrange):
        begs = manatee.IntVector (xrange)
        vals = manatee.IntVector (xrange)
        self.distribution (vals, begs, yrange)
        return zip (vals, begs)

    def collocs (self, cattr='-', csortfn='m', cbgrfns='mt',
                 cfromw=1, ctow=1, cminfreq=5, cminbgr=3, cmaxitems=30):
        statdesc = {'t': 'T-score',
                    'm': 'MI',
                    '3': 'MI3',
                    'l': 'log likelihood',
                    's': 'min. sensitivity',
                    'p': 'MI.log_f',
                    'r': 'relative freq.',
                    'f': 'absolute freq.',
                    'd': 'logDice',
                    }

        items=[]
        colls = manatee.CollocItems (self, cattr, csortfn, cminfreq, cminbgr,
                                     cfromw, ctow, cmaxitems)
        qfilter = 'q=%%s%i %i 1 [%s="%%s"]' % (cfromw, ctow, cattr)
        while not colls.eos():
            items.append ({'str': colls.get_item(), 'freq': colls.get_cnt(),
                           'Stats': [{'s': '%.3f' % colls.get_bgr(s)}
                                     for s in  cbgrfns],
                           'pfilter': qfilter % ('p',colls.get_item()),
                           'nfilter': qfilter % ('n',colls.get_item())
                           })
            colls.next()
        head = [{'n': ''}, {'n': 'Freq', 's': 'f'}] \
               + [{'n': statdesc.get(s,s), 's': s} for s in cbgrfns]
        return {'Head': head, 'Items': add_block_items (items)}

    def linegroup_info_select (self, selected_count=5):
        ids = manatee.IntVector()
        freqs = manatee.IntVector()
        self.get_linegroup_stat (ids, freqs)
        grps = [(f, i) for f,i in zip(freqs, ids) if i]
        grps.sort()
        grps = [i for f,i in grps[-5:]]
        grps.sort()
        self.selected_grps = [0] + grps
        return self.selected_grps
        
    def linegroup_info_subset (self, conc):
        #fstream.thisown = False
        #conc = manatee.Concordance (fstream)
        conc.set_linegroup_from_conc (self)
        if not conc.size():
            return 0, 0, [0]*(len(self.selected_grps)+1)
        ids = manatee.IntVector()
        freqs = manatee.IntVector()
        conc.get_linegroup_stat (ids, freqs)
        info = dict(zip(ids, freqs))
        if not info:
            # no annotation
            return 0, 0, [0]*(len(self.selected_grps)+1)
        hist = [info.get(i,0) for i in self.selected_grps]
        hist.append (conc.size() - sum(hist))
        cnt, maxid = max(zip(freqs, ids))
        return maxid, (cnt/float(conc.size())), hist
        

def load_map (cache_dir):
    import cPickle
    try:
        f = open (cache_dir + '00CONCS.map', 'rb')
    except IOError:
        return {}
    try:
        flck_sh_lock (f)
        ret = cPickle.load (f)
        flck_unlock (f)
    except cPickle.UnpicklingError:
        os.rename (cache_dir + '00CONCS.map', 
                   cache_dir + '00CONCS-broken-%d.map' % os.getpid())
        return {}
    return ret

def uniqname (key, used):
    name = '#'.join ([''.join ([c for c in w if c.isalnum()]) for w in key])
    name = name[1:15]
    if not name:
        name = 'noalnums'
    if name in used:
        used = [w[len(name):] for w in used if w.startswith(name)]
        i = 0
        while str(i) in used:
            i += 1
        name += str(i)
    return name

def add_to_map (cache_dir, subchash, key, size):
    import cPickle
    kmap = None
    try:
        f = open (cache_dir + '00CONCS.map', 'r+b')
    except IOError:
        f = open (cache_dir + '00CONCS.map', 'wb')
        kmap = {}
    flck_ex_lock (f)
    if kmap is None:
        kmap = cPickle.load (f)
    if kmap.has_key ((subchash,key)):
        ret = kmap [subchash,key][0]
    else:
        ret = uniqname (key, [r for (r,s) in kmap.values()])
        kmap [subchash,key] = (ret, size)
        f.seek(0)
        cPickle.dump (kmap, f)
    f.close() # also automatically flck_unlock (f)
    return cache_dir + ret


def get_conc (corp, q=[], save=0, cache_dir='cache'):
    #from sys import stderr
    #stderr.write('get_conc: corpname = "%s"\n' % corpname)
    if not q:
        return None
    q = tuple (q)
    cache_dir = cache_dir + '/' + corp.corpname + '/'
    if save:
        try: 
            if not os.path.isdir (cache_dir):
                os.makedirs (cache_dir)
            elif (os.stat(cache_dir + '00CONCS.map').st_mtime
                  < os.stat(corp.get_conf('PATH') +'word.text').st_mtime):
                os.remove (cache_dir + '00CONCS.map')
                for f in os.listdir (cache_dir):
                    os.remove (f)
        except OSError:
            pass
    
    saved = load_map (cache_dir)
    subchash = getattr(corp, 'subchash', None)
    for i in range (len(q), 0, -1):
        cache_val = saved.get ((subchash, q[:i]))
        if cache_val:
            conc = PyConc (corp, 'l', os.path.join (cache_dir,
                                                    cache_val[0] + '.conc'))
            toprocess = i
            if toprocess == len(q):
                save = 0
            break
    else:
        conc = PyConc (corp, q[0][0], q[0][1:])
        toprocess = 1
    #print conc.size(),
    for act in range(toprocess, len(q)):
        command = q[act][0]
        if save and command in 'gae':
            # user specific/volatile actions, cannot save later
            save = 0
            conc.save (add_to_map (cache_dir, subchash, q[:act],
                                   conc.size()) + '.conc')
        getattr (conc, 'command_' + command) (q[act][1:])
        #print conc.size(),
    #print 'hotovo'

    if save:
        conc.save (add_to_map (cache_dir, subchash, q, conc.size()) + '.conc')

    return conc


def get_conc_desc (q=[], cache_dir='cache', corpname='', subchash=None):
    desctext = {'q': 'Query',
                'a': 'Query',
                'r': 'Random sample',
                's': 'Sort',
                'f': 'Shuffle',
                'n': 'Negative filter',
                'p': 'Positive filter',
                'w': 'Word sketch item',
                't': 'Word sketch texttype item',
                'e': 'GDEX',
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
    saved = load_map (cache_dir + '/' + corpname + '/')
    q = tuple (q)
    
    for i in range (len(q)):
        size = saved.get ((subchash, q[:i+1]), ('',''))[1]
        opid = q[i][0]
        args = q[i][1:]
        url1p = [('q', qi) for qi in q[:i]]
        url2 = urlencode ([('q', qi) for qi in q[:i+1]])
        op = desctext.get (opid)
        formname = forms.get(opid, ('',''))
        if formname[1]:
            url1p.append ((formname[1], args))

        if opid == 's' and args[0] != '*' and i > 0:
            sortopt = {'-1<0': 'left context',
                       '0<0~': 'node',
                       '1>0~': 'right context'}
            sortattrs = args.split()
            if len (sortattrs) > 2:
                op = 'Multilevel Sort'
            args = '%s in %s' % (sortattrs[0].split('/')[0],
                                 sortopt.get(sortattrs[1][:4], sortattrs[1]))
            url1p.append (('skey', {'-1':'lc', '0<': 'kw', '1>': 'rc'}
                           .get (sortattrs[1][:2], '')))

        if op:
            if formname[0]:
                url1 = '%s?%s' % (formname[0], urlencode(url1p))
            else:
                url1 = ''
            desc.append ((op, args, url1, url2, size))
    return desc

def get_conc_labelmap (infopath):
    labels = {}
    try:
        from xml.etree.ElementTree import parse
        annoti = parse (infopath)
        for e in annoti.find('labels'):
            labels[e.find('n').text] = e.find('lab').text
    except IOError, err:
        print >>stderr, 'get_conc_labelmap: %s' % err 
        pass
    return labels

number_re = re.compile ('[0-9]+$')

def lngrp_sortcrit (lab, separator='.'):
    def num2sort (n):
        if number_re.match (n):
            return ('n', int(n))
        else:
            return ('c', n)
    if not lab:
        return [('x','x')]
    return map (num2sort, lab.split (separator, 3))

def lngrp_sortstr (lab, separator='.'):
    f = {'n': 'n%03g', 'c': 'c%s', 'x': '%s'}
    return '|'.join([f[c] % s for c,s in lngrp_sortcrit(lab, separator)])


def format_labelmap (labelmap, separator='.'):
    matrix = {}
    for n,lab in labelmap.items():
        if lab:
            pref = lab.split (separator)[0]
            matrix.setdefault (pref, []).append ((lngrp_sortcrit(lab), lab, n))
    prefixes = [(lngrp_sortcrit(p), p) for p in matrix.keys()]
    prefixes.sort()
    lines = []
    for s, pref in prefixes:
        line = matrix[pref]
        line.sort()
        lines.append ({'Items': [{'n':n, 'lab':lab} for (s, lab,n) in line]})
    return lines


def get_stored_conc (corp, concname, conc_dir):
    basecorpname = corp.corpname.split(':')[0]
    conc_dir = os.path.join (conc_dir, basecorpname)
    if not os.path.isdir (conc_dir):
        os.makedirs (conc_dir)
    cpath = os.path.join (conc_dir, concname)
    conc = PyConc (corp, 'l', cpath + '.conc')
    conc.labelmap = get_conc_labelmap (cpath + '.info')
    return conc


def get_full_ref (corp, pos):
    data = {}
    refs = [(n == '#' and ('Token number', pos) or
             (n, corp.get_attr(n).pos2str (pos)))
            for n in corp.get_conf ('FULLREF').split(',')]
    data['Refs'] = [{'name': (corp.get_conf (n+'.LABEL') or n), 'val': v}
                    for n,v in refs]
    for n,v in refs:
        data [n.replace('.','_')] = v
    return data


def get_detail_context (corp, pos, hitlen=1,
                        detail_left_ctx=40, detail_right_ctx=40,
                        addattrs=[], attrsep='/', detail_ctx_incr=60):
    try:
        maxdetail = int (corp.get_conf ('MAXDETAIL'))
    except:
        maxdetail = 0
    if maxdetail:
        if detail_left_ctx > maxdetail:
            detail_left_ctx = maxdetail
        if detail_right_ctx > maxdetail:
            detail_right_ctx = maxdetail
    if detail_left_ctx > pos:
        detail_left_ctx = pos
    attrs = map (corp.get_attr, ['word'] + addattrs)
    tit = [a.textat (pos - detail_left_ctx) for a in attrs]
    data = {}
    data['left'] = ' '.join ([attrsep.join ([a.next() for a in tit])
                              for x in range (detail_left_ctx)])
    data['kwic'] = ' '.join ([attrsep.join ([a.next() for a in tit])
                              for x in range (hitlen)])
    data['right'] = ' '.join ([attrsep.join ([a.next() for a in tit])
                               for x in range (detail_right_ctx)])

    refbase = 'pos=%i;' % pos
    if hitlen != 1:
        refbase += 'hitlen=%i;' % hitlen
    data['leftlink'] = refbase + ('detail_left_ctx=%i;detail_right_ctx=%i'
                                  % (detail_left_ctx + detail_ctx_incr,
                                     detail_right_ctx))
    data['rightlink'] = refbase + ('detail_left_ctx=%i;detail_right_ctx=%i'
                                   % (detail_left_ctx,
                                      detail_right_ctx + detail_ctx_incr))
    data['righttoleft'] = corp.get_conf ('RIGHTTOLEFT')
    data['pos'] = pos
    return data




if __name__ == '__main__':
    import corplib
    cm = corplib.CorpusManager()
    #cc = PyConc('bnc:text', 'l', 'pokus')
    #cc = PyConc('susanne', 'q', '"dream"')
    cc = PyConc(cm.get_Corpus('bnc'), 'l', 'help')
    #printkwic (cc)
    #print cc.collocs()
    pass
