/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import * as PluginInterfaces from '../../types/plugins';
import { init as viewInit } from './view';


export class IssueReportingPlugin implements PluginInterfaces.IssueReporting.IPlugin {

    private view:React.SFC<{}>;

    constructor(view:React.SFC<{}>) {
        this.view = view;
    }

    isActive():boolean {
        return true;
    }

    getWidgetView():React.SFC<{}> {
        return this.view;
    }
}


const init:PluginInterfaces.IssueReporting.Factory = (pluginApi) => {
    const view = viewInit(pluginApi.dispatcher(), pluginApi.getComponentHelpers());
    return new IssueReportingPlugin(view.IssueReportingWidget);
};

export default init;