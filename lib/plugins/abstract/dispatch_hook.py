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


class AbstractDispatchHook(abc.ABC):

    def pre_dispatch(self, plugin_api, action_name, action_metadata, request):
        """
        A function run right after Controller.pre_dispatch and before
        any Kontext.pre_dispatch.

        Both named_args and action_metadata are mutable which provides
        a way how to affect action processing (the action itself will
        be always the original one as the 'path' cannot be changed).

        Args:
            plugin_api -- an API available to plugins (controller.plg.PluginApi)
            action_name -- resolved action name
            action_metadata -- action metadata (added by @inject)
            request -- current request (Werkzeug Request)
        """

    def post_dispatch(self, plugin_api, methodname, action_metadata, log_data):
        """
        A function run right after Controller.post_dispatch and before
        Kontext.post_dispatch.

        The 'action_metadata' is mutable but in this phase, changing
        it has no effect on processed action.

        This hook can be used e.g. for logging and reporting (see log_data arg).

        Args:
            plugin_api -- an API available to plugins (controller.plg.PluginApi)
            methodname -- processed action method
            action_metadata -- action metadata (added by @inject)
            log_data -- an action log record created by KonText (the same data are
                        written to the log file (if configured so)).
                        It's OK to mutate this value as it is already been used by
                        KonText when the func. is called.
        """
