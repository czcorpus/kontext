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

import {ViewOptions} from '../../types/common';
import {StatefulModel} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';


export interface ConcDashboardProps {
    showTTOverview:boolean;
    hasTTCrit:boolean;
}


export class ConcDashboard extends StatefulModel {

    private layoutModel:PageModel;

    private showTTOverview:boolean;

    private globalOpts:ViewOptions.IGeneralViewOptionsModel;

    private hasTTCrit:boolean;

    private extendedInfoMinimized:boolean;

    private static EXTENDED_INFO_MINIMIZED_LOCAL_KEY = 'extendedInfoMinimized';

    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel,
                globalOpts:ViewOptions.IGeneralViewOptionsModel, props:ConcDashboardProps) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.extendedInfoMinimized = this.layoutModel.getLocal(
                    ConcDashboard.EXTENDED_INFO_MINIMIZED_LOCAL_KEY, false);
        this.showTTOverview = props.showTTOverview;
        this.hasTTCrit = props.hasTTCrit;

        dispatcher.register((action:ActionPayload) => {
            switch (action.actionType) {
                case 'DASHBOARD_MINIMIZE_EXTENDED_INFO':
                    this.extendedInfoMinimized = true;
                    this.layoutModel.setLocal(ConcDashboard.EXTENDED_INFO_MINIMIZED_LOCAL_KEY, true);
                    this.notifyChangeListeners();
                break;
                case 'DASHBOARD_MAXIMIZE_EXTENDED_INFO':
                    this.extendedInfoMinimized = false;
                    this.layoutModel.setLocal(ConcDashboard.EXTENDED_INFO_MINIMIZED_LOCAL_KEY, false);
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    updateOnGlobalViewOptsChange(model:ViewOptions.IGeneralViewOptionsModel):void {
        this.showTTOverview = model.getShowTTOverview();
        this.notifyChangeListeners();
    }

    getShowTTOverview():boolean {
        return this.showTTOverview && this.hasTTCrit;
    }

    getIsExtendedInfoMinimized():boolean {
        return this.extendedInfoMinimized;
    }
}