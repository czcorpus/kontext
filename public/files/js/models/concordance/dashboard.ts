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

import { StatelessModel, IActionDispatcher, Action, SEDispatcher } from 'kombo';

import { PageModel } from '../../app/page';
import { Actions, ActionName } from './actions';


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

    constructor(dispatcher:IActionDispatcher, layoutModel:PageModel, conf:ConcDashboardConf) {
        super(
            dispatcher,
            {
                expanded: layoutModel.getLocal(
                    ConcDashboard.EXTENDED_INFO_MINIMIZED_LOCAL_KEY,
                    true
                ),
                showKwicConnect: conf.hasKwicConnect,
                showFreqInfo: conf.showFreqInfo
            });
        this.layoutModel = layoutModel;

        this.addActionHandler<Actions.DashboardMinimizeExtInfo>(
            ActionName.DashboardMinimizeExtInfo,
            (state, action) => {
                state.expanded = false;
            },
            (state, action, dispatch) => {
                this.layoutModel.setLocal(
                    ConcDashboard.EXTENDED_INFO_MINIMIZED_LOCAL_KEY, state.expanded);
            }
        );

        this.addActionHandler<Actions.DashboardMaximizeExtInfo>(
            ActionName.DashboardMaximizeExtInfo,
            (state, action) => {
                state.expanded = true;
            },
            (state, action,dispatch) => {
                this.layoutModel.setLocal(
                    ConcDashboard.EXTENDED_INFO_MINIMIZED_LOCAL_KEY, state.expanded);
            }
        );

        this.addActionHandler<Actions.DashboardToggleExtInfo>(
            ActionName.DashboardToggleExtInfo,
            (state, action) => {
                state.expanded = !state.expanded;
            }
        );
    }
}