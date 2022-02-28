# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2014 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

import os
from typing import Union, Dict, List, Tuple, Any, Callable
import jinja2
import re
import json
from urllib.parse import urlparse
from xml.sax.saxutils import escape
from dataclasses_json.api import DataClassJsonMixin
import werkzeug.http

from translation import ugettext
import l10n
import strings
import settings


ResultType = Union[
    Callable[[], Union[str, bytes, DataClassJsonMixin, Dict[str, Any]]],
    Dict[str, Any],
    str,
    bytes,
    DataClassJsonMixin]


class CustomJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, DataClassJsonMixin):
            return o.to_dict()
        return super().default(o)


def val_to_js(obj):
    s = obj.to_json() if callable(getattr(obj, 'to_json', None)) else json.dumps(obj, cls=CustomJSONEncoder)
    return re.sub(
        r'<(/)?(script|iframe|frame|frameset|embed|img|object)>', r'<" + "\g<1>\g<2>>', s, flags=re.IGNORECASE)


@jinja2.pass_context
def translat_filter(_, s):
    return ugettext(s)


class Templating:

    def __init__(self):
        self._template_dir: str = os.path.realpath(os.path.join(
            os.path.dirname(__file__), '..', '..', 'templates'))
        tpl_cache_path = settings.get('global', 'template_engine_cache_path', None)
        cache = jinja2.FileSystemBytecodeCache(tpl_cache_path) if tpl_cache_path else None
        self._template_env: jinja2.Environment = jinja2.Environment(
            loader=jinja2.FileSystemLoader(searchpath=self._template_dir),
            bytecode_cache=cache,
            trim_blocks=True,
            lstrip_blocks=True)
        self._template_env.filters.update(
            to_json=val_to_js,
            shorten=strings.shorten,
            camelize=l10n.camelize,
            _=translat_filter,
            xmle=escape
        )

    def output_result(
            self,
            code: int,
            result: ResultType,
            template: str,
            action_metadata: Dict[str, Any],
            return_type: str) -> Union[str, bytes]:
        """
        Renders a response body out of a provided data. The concrete form of data transformation
        depends on the combination of the 'return_type' argument and a type of the 'result'.
        Typical combinations are (ret. type, data type):
        'template' + dict
        'json' + dict (which may contain dataclass_json instances)
        'json' + dataclass_json
        'plain' + str
        A callable 'result' can be used for lazy result evaluation or for JSON encoding with a custom encoder
        """
        if 300 <= code < 400 or result is None:
            return ''
        if callable(result):
            result = result()
        if return_type == 'json':
            try:
                if type(result) in (str, bytes):
                    return result
                else:
                    return json.dumps(result, cls=CustomJSONEncoder)
            except Exception as e:
                self._status = 500
                return json.dumps(dict(messages=[('error', str(e))]))
        elif return_type == 'xml':
            from templating import Type2XML
            return Type2XML.to_xml(result)
        elif return_type == 'plain' and not isinstance(result, (dict, DataClassJsonMixin)):
            return result
        elif isinstance(result, dict):
            inject_page_globals(method_name, action_metadata, result)
            template_object = self._template_env.get_template(template)
            return template_object.render(result)
        raise RuntimeError(f'Unknown source ({result.__class__.__name__}) or return type ({return_type})')
