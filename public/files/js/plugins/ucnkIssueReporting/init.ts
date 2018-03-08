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

/// <reference path="../../types/plugins.d.ts" />

import {Kontext} from '../../types/common';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {init as viewInit} from './view';
import RSVP from 'rsvp';


export class IssueReportingPlugin implements PluginInterfaces.IssueReporting {


    private view:React.SFC<{}>;

    constructor(view:React.SFC<{}>) {
        this.view = view;
    }

    getWidgetView():React.SFC<{}> {
        return this.view;
    }
}


export default function init(pluginApi:IPluginApi):RSVP.Promise<PluginInterfaces.IssueReporting> {
    const view = viewInit(pluginApi.dispatcher(), pluginApi.getComponentHelpers());
    return new RSVP.Promise((resolve:(data)=>void, reject:(err)=>void) => {
        resolve(new IssueReportingPlugin(view.IssueReportingWidget));
    });
}