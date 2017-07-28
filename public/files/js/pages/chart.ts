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

/// <reference path="../types/common.d.ts" />

import {PageModel} from './document';
import * as lineGroups from '../charts/lineSelection';

class ChartPage {

    private layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private renderChart(chartType:string, data:any):void {
        switch (chartType) {
            case 'line_group_ratios':
                const c1 = new lineGroups.LineSelGroupsRatiosChart(
                    this.layoutModel,
                    <lineGroups.LineGroupStats>data,
                    this.layoutModel.getConf<Array<string>>('FillIds')
                );
                c1.showGroupsStats(document.getElementById('chart-root'), true, [600, 600]);
            break;
        }
    }

    init():void {
        this.layoutModel.initCoreOnly().then(
            () => {
                this.renderChart(
                    this.layoutModel.getConf<string>('ChartType'),
                    this.layoutModel.getConf<any>('Data')
                );
            }
        ).catch(
            (err) => {
                console.error(err);
            }
        )
    }
}


export function init(conf:Kontext.Conf):void {
    new ChartPage(new PageModel(conf)).init();
}