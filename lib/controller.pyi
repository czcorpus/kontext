# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import Dict, List, Tuple, Callable, Any, Union, Optional
from argmapping import Args
import Cookie
import werkzeug.wrappers


def exposed(**kwargs:Dict[str, Any]) -> Callable[Any,...]: ...


class KonTextCookie(Cookie.BaseCookie):
    pass

class Controller(object):

    NO_OPERATION:str

    _request:werkzeug.wrappers.Request
    environ:Dict[str, str]
    ui_lang:str
    _cookies:KonTextCookie
    _new_cookies:KonTextCookie
    _headers:Dict[str, str]
    _status:int
    _system_messages:List[Tuple[str, str]]
    _proc_time:float
    _validators:List[Callable[Exception]]
    _exceptmethod:str
    _template_dir:unicode
    args:Args
    _uses_valid_sid:bool
    _plugin_api:Any

    def refresh_session_id(self) -> None: ...

    def add_validator(self, func:Callable[Exception]) -> None: ...

    def add_system_message(self, msg_type:str, text:str) -> None: ...

    @property
    def corp_encoding(self) -> str: ...

    def get_current_action(self) -> str: ...

    def get_root_url(self) -> str: ...

    def create_url(self, action:str, params:Dict[str, Union[str, int, float, bool]]) -> str: ...

    def call_function(self, func:Callable, args:Union[List[Any], Tuple[Any]], **named_args:Dict[str, Any]) -> Dict: ...

    def clone_args(self) -> Dict[str, Any]: ...

    def get_mapping_url_prefix(self) -> str: ...

    def redirect(self, url:str, code:Optional[int]) -> None: ...

    def get_http_method(self) -> str: ...

    def pre_dispatch(self, path:str, args:Dict[str, Any], action_metadata:Optional[Dict[str, Any]]
                     ) -> Tuple[str, Dict[str, Any]]: ...

    def post_dispatch(self, methodname:str, action_metadata:Dict[str, Any],
                      tmpl:str, result:Dict[str, Any]) -> None: ...

    def is_action(self, action_name:str, metadata:Dict[str, Any]) -> bool: ...

    def contains_errors(self) -> bool: ...

    def run(self, path:Optional[str]) -> Tuple[str, List[Tuple[str, str], bool, unicode]]: ...

    def handle_action_error(self, ex:Exception, action_name:str, pos_args:List[Any],
                            named_args:Dict[str, Any]) -> Dict[str, Any]: ...

    def handle_dispatch_error(self, ex:Exception) -> None: ...

    def process_action(self, methodname:str, pos_args:List[Any],
                       named_args:Dict[str, Any]) -> Tuple[str, str, Dict[str, Any]]: ...

    def urlencode(self, key_val_pairs:List[Tuple[str, Union[str, unicode, bool, int, float]]]) -> str: ...

    def output_headers(self, return_type:Optional[str]) -> List[Tuple[str, str]]: ...

    def output_result(self, methodname:str, template:str, result:Dict[str, Any], action_metadata:Dict[str, Any],
                      outf:file, return_template:Optional[bool]) -> None: ...

    def user_is_anonymous(self) -> bool: ...

    def message(self, *args:Any, **kwargs:Any) -> Dict[str, Any]: ...
