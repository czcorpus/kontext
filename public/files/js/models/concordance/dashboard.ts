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

import {StatelessModel} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher, Action, SEDispatcher} from '../../app/dispatcher';

export interface ConcDashboardConf {
    showFreqInfo:boolean;
    hasKwicConnect:boolean;
}


export interface ConcDashboardState {
    expanded:boolean;
    showKwicConnect:boolean;
    showFreqInfo:boolean;
}


export class ConcDashboard extends StatelessModel<ConcDashboardState> {

    private layoutModel:PageModel;

    private static EXTENDED_INFO_MINIMIZED_LOCAL_KEY = 'dashboardExpanded';

    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel, conf:ConcDashboardConf) {
        super(
            dispatcher,
            {
                expanded: layoutModel.getLocal(ConcDashboard.EXTENDED_INFO_MINIMIZED_LOCAL_KEY, true),
                showKwicConnect: conf.hasKwicConnect,
                showFreqInfo: conf.showFreqInfo
            });
        this.layoutModel = layoutModel;
    }

    reduce(state:ConcDashboardState, action:Action) {
        let newState:ConcDashboardState;
        switch (action.actionType) {
            case 'DASHBOARD_MINIMIZE_EXTENDED_INFO':
                newState = this.copyState(state);
                newState.expanded = false;
                this.layoutModel.setLocal(ConcDashboard.EXTENDED_INFO_MINIMIZED_LOCAL_KEY, true);
                return newState;
            case 'DASHBOARD_MAXIMIZE_EXTENDED_INFO':
                newState = this.copyState(state);
                newState.expanded = true;
                return newState;
            case 'DASHBOARD_TOGGLE_EXTENDED_INFO':
                newState = this.copyState(state);
                newState.expanded = !newState.expanded;
                return newState;
            default:
                return state;
        }
    }

    sideEffects(state:ConcDashboardState, action:Action, dispatch:SEDispatcher) {
        switch (action.actionType) {
            case 'DASHBOARD_MINIMIZE_EXTENDED_INFO':
            case 'DASHBOARD_MAXIMIZE_EXTENDED_INFO':
                this.layoutModel.setLocal(ConcDashboard.EXTENDED_INFO_MINIMIZED_LOCAL_KEY, state.expanded);
            break;
        }
    }
}