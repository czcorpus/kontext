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


/// <reference path="../../types/common.d.ts" />
/// <reference path="../../types/plugins.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />
/// <reference path="./view.d.ts" />

import {init as viewInit} from './view';
import * as RSVP from 'vendor/rsvp';


export class IssueReportingPlugin implements PluginInterfaces.IIssueReporting {


    private view:React.ComponentClass;

    constructor(view:React.ComponentClass) {
        this.view = view;
    }

    getWidgetView():React.ComponentClass {
        return this.view;
    }
}


export default function init(pluginApi:Kontext.PluginApi):RSVP.Promise<PluginInterfaces.IIssueReporting> {
    const view = viewInit(pluginApi.dispatcher(), pluginApi.getComponentHelpers());
    return new RSVP.Promise((resolve:(data)=>void, reject:(err)=>void) => {
        resolve(new IssueReportingPlugin(view.IssueReportingWidget));
    });
}