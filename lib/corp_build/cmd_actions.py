# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

import subprocess


def export_tags(src_path):
    """
    Loads all unique tags as found in provided corpus source

    arguments:
    src_path -- a path to a corpus source file

    returns:
    a list containing a list of all found unique tags
    """

    cat_type = 'zcat' if src_path.endswith('.gz') else 'cat'
    p = subprocess.Popen("%s %s | grep -v '<' | awk 'BEGIN { FS = \"\\t\" } ; {print $3}' | sort | uniq" % (cat_type, src_path),
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
    lines, err = p.communicate()
    if len(err) > 0:
        raise Exception(err)
    lines = lines.split('\n')
    ans = set()
    for line in lines:
        if len(line.strip()) > 0:
            ans.add(line.strip())
    return sorted(ans)


def compile_vertical_file(registry_file, target_dir, vertical_file, memory_limit=None, verbose=False, fd_fgd=False):
    args = '-c %s -p %s' % (registry_file, target_dir)
    if memory_limit:
        args += ' -m %d' % memory_limit
    if verbose:
        args += ' -v'
    if fd_fgd:
        args += ' -b'
    p = subprocess.Popen('encodevert %s %s' % (args, vertical_file),
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
    lines, err = p.communicate()
    return p.returncode, err
