import os
import jinja2
import json
import re
from typing import Union, Callable, Any, Dict
from dataclasses_json import DataClassJsonMixin
import l10n
import strings
from xml.sax.saxutils import escape


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
        self._template_env.filters.update(_=translate)
        template_object = self._template_env.get_template(template)
        return template_object.render(data)
