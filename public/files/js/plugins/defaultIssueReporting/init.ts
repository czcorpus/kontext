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
/// <reference path="./view.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />

import {Kontext} from '../../types/common';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {ActionPayload} from '../../app/dispatcher';
import {SimplePageStore} from '../../stores/base';
import {init as viewInit} from './view';
import * as RSVP from 'vendor/rsvp';


export class IssueReportingStore extends SimplePageStore {

    private pluginApi:IPluginApi;

    private issueBody:string;

    private _isBusy:boolean;

    private _isActive:boolean;

    constructor(pluginApi:IPluginApi) {
        super(pluginApi.dispatcher());
        this.pluginApi = pluginApi;
        this._isBusy = false;
        this._isActive = false;

        pluginApi.dispatcher().register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'ISSUE_REPORTING_SET_VISIBILITY':
                    this._isActive = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'ISSUE_REPORTING_UPDATE_ISSUE_BODY':
                    this.issueBody = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'ISSUE_REPORTING_SUBMIT_ISSUE':
                    this._isBusy = true;
                    this.notifyChangeListeners();
                    this.pluginApi.ajax(
                        'POST',
                        this.pluginApi.createActionUrl('user/submit_issue'),
                        {
                            body: this.issueBody,
                            args: JSON.stringify(this.fetchBrowserInfo())
                        }
                    ).then(
                        (data) => {
                            this._isBusy = false;
                            this._isActive = false;
                            this.pluginApi.showMessage('info', this.pluginApi.translate('defaultIR__message_sent'));
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this._isBusy = false;
                            this.pluginApi.showMessage('error', err);
                            this.notifyChangeListeners();
                        }
                    );
                break;
            }
        });
    }

    private fetchBrowserInfo():any {
        return {
            viewSize: [window.innerWidth, window.innerHeight],
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            language: navigator.language
        };
    }

    getIssueBody():string {
        return this.issueBody;
    }

    isBusy():boolean {
        return this._isBusy;
    }

    isActive():boolean {
        return this._isActive;
    }

}


export class IssueReportingPlugin implements PluginInterfaces.IIssueReporting {

    private store:IssueReportingStore;

    private view:React.ComponentClass;

    constructor(store:IssueReportingStore, view:React.ComponentClass) {
        this.store = store;
        this.view = view;
    }

    getWidgetView():React.ComponentClass {
        return this.view;
    }
}



export default function init(pluginApi:IPluginApi):RSVP.Promise<PluginInterfaces.IIssueReporting> {
    const store = new IssueReportingStore(pluginApi);
    const view = viewInit(pluginApi.dispatcher(), pluginApi.getComponentHelpers(), store);
    return new RSVP.Promise((resolve:(data)=>void, reject:(err)=>void) => {
        resolve(new IssueReportingPlugin(store, view.IssueReportingWidget));
    });
}
