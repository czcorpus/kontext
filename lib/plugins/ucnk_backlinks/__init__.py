# Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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

from controller import exposed
from controller.errors import UserActionException
from actions.backlinks import BacklinksActions
from plugins.abstract.backlinks import AbstractBacklinks


def col_lemma_log(request):
    return dict(
        corpname=request.args.get('corpname'), maincorp=request.args.get('maincorp'),
        viewmode=request.args.get('viewmode'), pagesize=request.args.get('pagesize'),
        attrs=request.args.get('attrs'), attr_vmode=request.args.get('attrs_vmode'),
        q=request.args.get('q'))


@exposed(
    return_type='template', mutates_result=True, action_log_mapper=col_lemma_log, template='view.html',
    page_model='view')
def col_lemma(self, req):
    """
    """
    cl = req.args.get('cl')
    if not cl:
        raise UserActionException('Missing parameter "cl"')
    if self.args.corpname not in ('syn_v11', ):
        raise UserActionException('Function not supported in {}'.format(self.args.corpname))
    self.args.q = ['q[col_lemma="{cl}"][]*[col_lemma="{cl}"] within <s />'.format(cl=cl)]
    pf = req.args.get('p')
    if pf:
        self.args.q.append(f'p0 0 1 [lemma="{pf}"]')
    self.args.q.extend(['D', 'f'])
    self.args.refs = '=doc.title,=doc.pubyear'
    self.args.pagesize = 50
    self.args.attrs = 'word'
    self.args.attr_vmode = 'mouseover'
    self.args.base_viewattr = 'word'
    self.args.structs = ''
    self.args.viewmode = 'sen'
    return self.view(req)


class UcnkBacklinks(AbstractBacklinks):

    def export_actions(self):
        return {BacklinksActions: [col_lemma]}


def create_instance(settings) -> UcnkBacklinks:
    return UcnkBacklinks()
