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

import {Kontext, ViewOptions} from '../../types/common';
import {SimplePageStore} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher} from '../../app/dispatcher';


export interface ConcDashboardProps {
    showTTOverview:boolean;
    hasTTCrit:boolean;
}


export class ConcDashboard extends SimplePageStore {

    private layoutModel:PageModel;

    private showTTOverview:boolean;

    private globalOpts:ViewOptions.IGeneralViewOptionsStore;

    private hasTTCrit:boolean;

    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel,
                globalOpts:ViewOptions.IGeneralViewOptionsStore, props:ConcDashboardProps) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.showTTOverview = props.showTTOverview;
        this.hasTTCrit = props.hasTTCrit;
    }

    updateOnGlobalViewOptsChange(store:ViewOptions.IGeneralViewOptionsStore):void {
        this.showTTOverview = store.getShowTTOverview();
        this.notifyChangeListeners();
    }

    getShowTTOverview():boolean {
        return this.showTTOverview && this.hasTTCrit;
    }
}