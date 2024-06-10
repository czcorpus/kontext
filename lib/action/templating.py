# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import json
import os
from typing import Any, Callable, Dict, Union
from xml.sax.saxutils import escape

import jinja2
import l10n
import markupsafe
import strings
from action.result.base import BaseResult
from dataclasses_json import DataClassJsonMixin

ResultType = Union[
    Callable[[], Union[str, bytes, DataClassJsonMixin, Dict[str, Any]]],
    Dict[str, Any],
    str,
    bytes,
    DataClassJsonMixin,
    BaseResult]


class CustomJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, DataClassJsonMixin):
            return o.to_dict()
        return super().default(o)


def val_to_js(obj):
    s = obj.to_json() if callable(getattr(obj, 'to_json', None)) else json.dumps(obj, cls=CustomJSONEncoder)
    return markupsafe.Markup(
        s.replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
        .replace("'", "\\u0027"))


class TplEngine:

    def __init__(self, settings):
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
            xmle=escape)

    def render(self, template: str, data: Dict[str, Any], translate: Callable[[str], str] = lambda x: x):
        template_object = self._template_env.get_template(
            template, globals={"translate": translate})
        return template_object.render(data)
