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

import abc
from action import ActionProps


class AbstractDispatchHook(abc.ABC):

    def pre_dispatch(self, plugin_ctx, action_props: ActionProps, request):
        """
        A function run right after Controller.pre_dispatch and before
        any Kontext.pre_dispatch.

        action_metadata are mutable which provides
        a way how to affect action processing (the action itself will
        be always the original one as the 'path' cannot be changed).

        Args:
            plugin_ctx -- an API available to plugins (controller.plg.PluginCtx)
            action_props -- action properties as used by action models
                            (derived mostly from @http_action decor.)
            request -- current request (Werkzeug Request)
        """

    def post_dispatch(self, plugin_ctx, methodname, action_metadata):
        """
        A function run right after Controller.post_dispatch and before
        Kontext.post_dispatch.

        The 'action_metadata' is mutable but in this phase, changing
        it has no effect on processed action.

        This hook can be used e.g. for logging and reporting (see log_data arg).

        Args:
            plugin_ctx -- an API available to plugins (controller.plg.PluginCtx)
            methodname -- processed action method
            action_metadata -- action metadata (added by @inject)
        """
