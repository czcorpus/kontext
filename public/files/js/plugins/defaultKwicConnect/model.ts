/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

import { StatelessModel } from "../../models/base";
import { ActionPayload, ActionDispatcher } from "../../app/dispatcher";
import { IPluginApi, PluginInterfaces } from "../../types/plugins";
import { Kontext } from "../../types/common";


export interface KwicConnectState {
    isBusy:boolean;
    data:Kontext.GeneralProps; // TODO
}

export enum Actions {
    FETCH_INFO_DONE = 'KWIC_CONNECT_FETCH_INFO_DONE'
}

interface AjaxResponse extends Kontext.AjaxResponse {
    data:any;
}

export class KwicConnectModel extends StatelessModel<KwicConnectState> {

    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi) {
        super(
            dispatcher,
            {
                isBusy: false,
                data: {}
            },
            (state, action, dispatch) => {
                switch (action.actionType) {
                    case PluginInterfaces.KwicConnect.Actions.FETCH_INFO:
                        pluginApi.ajax<AjaxResponse>(
                            'GET',
                            pluginApi.createActionUrl('fetch_external_kwic_info'),
                            {}
                        ).then(
                            (data) => {
                                dispatch({
                                    actionType: Actions.FETCH_INFO_DONE,
                                    props: {
                                        data: data.data
                                    }
                                });
                            },
                            (err) => {
                                dispatch({
                                    actionType: Actions.FETCH_INFO_DONE,
                                    props: {},
                                    error: err
                                });
                            }
                        );
                    break;
                }
            }
        )
    }

    reduce(state:KwicConnectState, action:ActionPayload):KwicConnectState {
        const newState = this.copyState(state);
        switch (action.actionType) {
            case PluginInterfaces.KwicConnect.Actions.FETCH_INFO:
                newState.isBusy = true;
            break;
            case Actions.FETCH_INFO_DONE:
                newState.isBusy = false;
                newState.data = action.props['data'];
            break;
        }
        return newState;
    }

}