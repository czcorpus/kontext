/*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import * as PluginInterfaces from '../../types/plugins/index.js';
import { init as viewInit } from './view.js';
import { StatelessModel } from 'kombo';
import { Actions } from './actions.js';
import { HTTP } from 'cnc-tskit';
import { IPluginApi } from '../../types/plugins/common.js';
import * as CoreViews from '../../types/coreViews/index.js';


export interface IssueReportingModelState {
    issueBody:string;
    isBusy:boolean;
    isActive:boolean;
}

export class IssueReportingModel extends StatelessModel<IssueReportingModelState> {

    private pluginApi:IPluginApi;

    constructor(pluginApi:IPluginApi) {
        super(
            pluginApi.dispatcher(),
            {
                issueBody: '',
                isBusy: false,
                isActive: false
            }
        );
        this.pluginApi = pluginApi;

        this.addActionHandler<typeof Actions.SetVisibility>(
            Actions.SetVisibility.name,
            (state, action) => {state.isActive = action.payload.value}
        );

        this.addActionHandler<typeof Actions.UpdateIssueBody>(
            Actions.UpdateIssueBody.name,
            (state, action) => {state.issueBody = action.payload.value}
        );

        this.addActionHandler<typeof Actions.SubmitIssue>(
            Actions.SubmitIssue.name,
            (state, action) => {state.isBusy = true},
            (state, action, dispatch) => {
                this.pluginApi.ajax$(
                    HTTP.Method.POST,
                    this.pluginApi.createActionUrl('user/submit_issue'),
                    {
                        body: state.issueBody,
                        args: JSON.stringify(this.fetchBrowserInfo())
                    }
                ).subscribe(
                    (data) => {
                        dispatch<typeof Actions.SubmitIssueDone>({name: Actions.SubmitIssueDone.name});
                    },
                    (err) => {
                        dispatch<typeof Actions.SubmitIssueDone>({
                            name: Actions.SubmitIssueDone.name,
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<typeof Actions.SubmitIssueDone>(
            Actions.SubmitIssueDone.name,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    this.pluginApi.showMessage('error', action.error);

                } else {
                    state.isActive = false;
                    this.pluginApi.showMessage('info', this.pluginApi.translate('defaultIR__message_sent'));
                }
            }
        );
    }

    private fetchBrowserInfo():any {
        return {
            viewSize: [window.innerWidth, window.innerHeight],
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            language: navigator.language
        };
    }

    isActive():boolean {
        return true;
    }

}


export class IssueReportingPlugin implements PluginInterfaces.IssueReporting.IPlugin {

    private model:IssueReportingModel;

    private view:React.ComponentClass<CoreViews.IssueReportingLink.Props>;

    constructor(model:IssueReportingModel, view:React.ComponentClass<CoreViews.IssueReportingLink.Props>) {
        this.model = model;
        this.view = view;
    }

    isActive():boolean {
        return true;
    }

    getWidgetView():React.ComponentClass<CoreViews.IssueReportingLink.Props> {
        return this.view;
    }
}


const init:PluginInterfaces.IssueReporting.Factory = (pluginApi) => {
    const model = new IssueReportingModel(pluginApi);
    const view = viewInit(pluginApi.dispatcher(), pluginApi.getComponentHelpers(), model);
    return new IssueReportingPlugin(model, view.IssueReportingWidget);
};

export default init;
