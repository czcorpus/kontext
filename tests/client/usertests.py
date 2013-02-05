#
# Copyright (c) 2012 Czech National Corpus
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
#

testSuite = (
    ('http://127.0.0.1/bonito/run.cgi/first?corpname=syn2010&queryselector=lemmarow&lemma=dokument&lpos=&wpos=&default_attr=word&tag=.*&fc_lemword_window_type=both&fc_lemword_wsize=5&fc_lemword_type=all&fc_pos_window_type=both&fc_pos_wsize=5&fc_pos_type=all&usesubcorp=',
    'test-concordance.js'),

    ('http://127.0.0.1/bonito/run.cgi/freqml?q=aword%2C%5Blemma%3D"dokument"%5D&corpname=syn2010&attrs=word&ctxattrs=word&structs=sp&refs=%3Dopus.nazev&lemma=dokument&ml=1&flimit=0&freqlevel=1&ml1attr=word&ml1ctx=0<0&ml2attr=word&ml2ctx=0<0&ml3attr=word&ml3ctx=0<0',
    'test-freq-list.js'),

    ('http://127.0.0.1/bonito/run.cgi/first_form?corpname=syn2010;',
    'test-main-page.js')
)

if __name__ == '__main__':
    import subprocess
    import sys

    total_errors = 0
    for url, fileName in testSuite:
        print('==================================================================')
        print('test module [%s]' % fileName)
        print('==================================================================')
        cmd = ['/opt/phantomjs/bin/phantomjs', 'tests/client/run.js', fileName, url]
        process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        while True:
            out = process.stdout.read(1)
            if out == '' and process.poll() is not None:
                break
            if out != '':
                sys.stdout.write(out)
                sys.stdout.flush()

        total_errors += process.returncode

    print('TOTAL RESULT: %s' % ('PASSED', 'FAILED')[total_errors > 0])