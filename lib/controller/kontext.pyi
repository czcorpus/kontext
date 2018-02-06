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

from typing import Any, Optional, TypeVar, Dict, List, Iterator, Callable, Tuple
import werkzeug.contrib.sessions
import werkzeug.wrappers
from controller import KonTextCookie, Controller
from manatee import Corpus
import argmapping.query
from corplib import CorpusManager
from main_menu import AbstractMenuItem

T = TypeVar('T')


class LinesGroups(object):

    def __init__(self, data:List[Any]): ...

    def __len__(self) -> int: ...

    def __iter__(self) -> Iterator: ...

    def serialize(self) -> Dict[str, Any]: ...

    def as_list(self) -> List[Any]: ...

    def is_defined(self) -> bool: ...

    @staticmethod
    def deserialize(data:List[Any]) -> LinesGroups: ...


class AsyncTaskStatus(object):

    def __init__(self, status:int, ident:str, category:str, label:str, args:Dict[str, Any]): ...

    def is_finished(self) -> bool: ...

    @staticmethod
    def from_dict(data:Dict[str, Any]) -> AsyncTaskStatus: ...

    def to_dict(self) -> Dict[str, Any]: ...


class Kontext(Controller):

    BASE_ATTR:str

    _curr_corpus:Corpus

    _corpus_variant:str

    return_url:str

    cm:CorpusManager

    disabled_menu_items:List[str]

    _save_menu:List[AbstractMenuItem]

    _conc_dir:unicode

    _files_path:unicode

    _lines_groups:LinesGroups

    _plugin_api:PluginApi

    subcpath:List[str]

    get_corpus_info:Callable[str, Dict[str, Any]]

    _q_code:str

    _prev_q_data:Dict[str, Any]

    _auto_generated_conc_ops:List[Tuple[str, argmapping.query.ConcFormArgs]]

    def __init__(self, request:werkzeug.wrappers.Request, ui_lang:str): ...

    def get_mapping_url_prefix(self) -> str: ...

    def get_saveable_conc_data(self) -> Dict[str, Any]: ...

    def acknowledge_auto_generated_conc_op(self, q_idx:str, query_form_args:argmapping.query.ConcFormArgs) -> None: ...

    @property
    def corp_encoding(self) -> str: ...

    def handle_dispatch_error(self, ex:Exception): ...

    @property
    def corp(self) -> Corpus: ...

    def permitted_corpora(self) -> Dict[str, str]: ...

    def get_async_tasks(self, category:Optional[str]) -> List[AsyncTaskStatus]: ...

    def concdesc_json(self) -> Dict[str, Any]: ...

    def check_tasks_status(self, request:werkzeug.wrappers.Request) -> Dict[str, Any]: ...

    def remove_task_info(self, request:werkzeug.wrappers.Request) -> Dict[str, Any]: ...

    def get_current_aligned_corpora(self) -> List[str]: ...

    def get_available_aligned_corpora(self) -> List[str]: ...


class PluginApi(object):

    _controller:Kontext

    def __init__(self, controller:Kontext, cookies:KonTextCookie, session:werkzeug.contrib.sessions.Session): ...

    def set_shared(self, key:str, value:Any): ...

    def get_shared(self, key:str, default:Optional[T]) -> T: ...

    def get_from_environ(self, key:str, default:Optional[T]) -> T: ...

    @property
    def cookies(self) -> KonTextCookie: ...

    @property
    def session(self) -> werkzeug.contrib.sessions.Session: ...

    def refresh_session_id(self) -> None: ...

    @property
    def user_lang(self) -> str: ...

    @property
    def user_id(self) -> int: ...

    @property
    def user_dict(self) -> Dict[str, Any]: ...

    @property
    def user_is_anonymous(self) -> bool: ...

    @property
    def current_corpus(self) -> Corpus: ...

    @property
    def current_url(self) -> str: ...

    @property
    def root_url(self) -> str: ...

    def redirect(self, url:str, code:Optional[int]) -> None: ...

    @property
    def text_types(self) -> Dict: ...
