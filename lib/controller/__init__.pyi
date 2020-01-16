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
import http.cookies
from argmapping import Args, Parameter
import werkzeug.wrappers
import jinja2


def exposed(access_level:int = 0, template:Optional[str] = None, vars:Tuple = (), page_model:Optional[str] = None,
            func_arg_mapped:bool = False, skip_corpus_init:bool = False, mutates_conc:bool = False, http_method:Union[Optional[str], Tuple[str,...]] = 'GET',
            accept_kwargs:bool = False, apply_semi_persist_args:bool = False, return_type:str = 'template') -> Callable[..., Any]: ...

def convert_types(args:Dict[str, Any], defaults:Dict[str, Any], del_nondef:int = 0,
                  selector:int = 0) -> Dict[str, Any]: ...


class KonTextCookie(http.cookies.BaseCookie): ...

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
    _validators:List[Callable[[],Exception]]
    _template_dir:str
    _template_env:jinja2.Environment
    args:Args
    _uses_valid_sid:bool
    _plugin_api:Any

    def init_session(self) -> None: ...

    def session_get(self, *nested_keys:str) -> Any: ...

    @property
    def _session(self) -> Dict[str, Any]: ...

    def refresh_session_id(self) -> None: ...

    def add_validator(self, func:Callable[..., Exception]) -> None: ...  #TODO ???

    def add_system_message(self, msg_type:str, text:str) -> None: ...

    def _is_template(self, template:str) -> bool: ...

    def _export_status(self) -> str: ...

    @property
    def corp_encoding(self) -> str: ...

    def add_globals(self, result:Dict[str, Any], methodname:str, action_metadata:Dict[str, Any]) -> None: ...

    def _get_template_class(self, name:str) -> Any: ...  # TODO return type

    def get_current_url(self) -> str: ...

    def updated_current_url(self, params:Dict[str, Any]) -> str: ...

    def get_current_action(self) -> str: ...

    def get_root_url(self) -> str: ...

    def create_url(self, action:str, params:Union[Dict[str, Union[str, int, float, bool]], List[Tuple[str, Any]]]) -> str: ...

    def _validate_http_method(self, action_metadata:Dict[str, Any]) -> None: ...

    def _pre_action_validate(self) -> None: ...

    def call_function(self, func:Callable, args:Union[List[Any], Tuple[Any]], **named_args:Dict[str, Any]) -> Dict: ...

    def clone_args(self) -> Dict[str, Any]: ...

    def _get_method_metadata(self, method_name:str, attr_name:Optional[str] = None) -> Union[Any, Dict[str, Any]]: ...

    def get_mapping_url_prefix(self) -> str: ...

    def _import_req_path(self) -> List[str]: ...

    def redirect(self, url:str, code:int = 303) -> None: ...

    def set_not_found(self) -> None: ...

    @staticmethod
    def _get_attrs_by_persistence(persistence_types:int) -> List[Parameter]: ...

    def _get_items_by_persistence(self, persistence_types:int) -> Dict[str, Parameter]: ...

    def _install_plugin_actions(self) -> None: ...

    def _normalize_error(self, err:Exception) -> Exception: ...

    def get_http_method(self) -> str: ...

    def pre_dispatch(self, action_name:str, args:Dict[str, Any], action_metadata:Optional[Dict[str, Any]] = None
                     ) -> Dict[str, Any]: ...

    def post_dispatch(self, methodname:str, action_metadata:Dict[str, Any],
                      tmpl:str, result:Dict[str, Any], err_desc:Tuple[Exception, str]) -> None: ...

    def is_action(self, action_name:str, metadata:Dict[str, Any]) -> bool: ...

    def _run_message_action(self, named_args, action_metadata:Dict[str, Any], message_type:str, message:str
                            ) -> Tuple[str, Dict[str, Any]]: ...

    @staticmethod
    def _is_allowed_explicit_out_format(f:str) -> bool: ...

    def run(self, path:Optional[str] = None) -> Tuple[str, List[Union[Tuple[str, str], bool, str]]]: ...

    def _create_user_action_err_result(self, ex:Exception, return_type:str) -> Dict[str, Any]: ...

    def process_action(self, methodname:str, named_args:Dict[str, Any]) -> Tuple[str, Dict[str, Any]]: ...

    def urlencode(self, key_val_pairs:List[Tuple[str, Union[str, str, bool, int, float]]]) -> str: ...

    def output_headers(self, return_type:str = 'template') -> List[Tuple[str, str]]: ...

    def output_result(self, methodname:str, template:str, result:Dict[str, Any], action_metadata:Dict[str, Any],
                      return_type:str) -> Union[str, bytes]: ...

    def user_is_anonymous(self) -> bool: ...

    def nop(self, request:werkzeug.wrappers.Request, *args:Any) -> None: ...

    def message(self, *args:Any, **kwargs:Any) -> Dict[str, Any]: ...
