# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import Dict
from collections import OrderedDict


REG_COLS_MAP: Dict[str, str] = OrderedDict(
    NAME='name',
    PATH='path',
    VERTICAL='vertical',
    LANGUAGE='language',
    LOCALE='locale',
    ENCODING='rencoding',
    INFO='info',
    DOCSTRUCTURE='docstructure',
    SHORTREF='shortref',
    FREQTTATTRS='freqttattrs',
    SUBCORPATTRS='subcorpattrs',
    TAGSETDOC='tagsetdoc',
    WPOSLIST='wposlist',
    WSDEF='wsdef',
    WSBASE='wsbase',
    WSTHES='wsthes',
    ALIGNSTRUCT='alignstruct',
    ALIGNDEF='aligndef')

REG_VAR_COLS_MAP: Dict[str, str] = OrderedDict(
    MAXCONTEXT='maxcontext',
    MAXDETAIL='maxdetail',
    MAXKWIC='maxkwic')

POS_COLS_MAP: Dict[str, str] = OrderedDict(
    TYPE='type',
    LABEL='label',
    DYNAMIC='dynamic',
    DYNLIB='dynlib',
    ARG1='arg1',
    ARG2='arg2',
    FUNTYPE='funtype',
    DYNTYPE='dyntype',
    TRANSQUERY='transquery',
    MULTIVALUE='multivalue',
    MULTISEP='multisep')

SATTR_COLS_MAP: Dict[str, str] = OrderedDict(
    TYPE='type',
    LOCALE='locale',
    MULTIVALUE='multivalue',
    DEFAULTVALUE='defaultvalue',
    MAXLISTSIZE='maxlistsize',
    MULTISEP='multisep',
    ATTRDOC='attrdoc',
    ATTRDOCLABEL='attrdoclabel',
    NUMERIC='rnumeric')

STRUCT_COLS_MAP: Dict[str, str] = OrderedDict(
    TYPE='type',
    DISPLAYTAG='displaytag',
    DISPLAYBEGIN='displaybegin')
