/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import { PageModel } from "../../app/page.js";
import { Actions } from './actions.js';
import * as Kontext from '../../types/kontext.js';
import { ConcServerArgs } from './common.js';


export interface ConcStatus extends Kontext.AjaxResponse {
    relconcsize:number;
    concsize:number;
    finished:boolean;
    fullsize:number;

    /**
     * ARF metrics; please note that this value
     * is non-empty only once the status has
     * finished = true (i.e. the result is complete)
     */
    arf:number;
}


export class HitReloader {

    private readonly layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }


    init():void {
        const linesPerPage = this.layoutModel.getConf<number>('ItemsPerPage');
        const applyData = (data:ConcStatus) => {
            this.layoutModel.dispatcher.dispatch(
                Actions.AsyncCalculationUpdated,
                {
                    finished: !!data.finished,
                    concsize: data.concsize,
                    relconcsize: data.relconcsize,
                    arf: data.arf,
                    fullsize: data.fullsize,
                    availPages: Math.ceil(data.concsize / linesPerPage)
                }
            );
        };

        const args = this.layoutModel.getConcArgs();
        this.layoutModel.openEventSource<ConcStatus>(
            this.layoutModel.createActionUrl<ConcServerArgs>('conc_cache_status', args),
            (v) => v.finished

        ).subscribe({
            next: response => {
                applyData(response);
            },
            error: err => {
                this.layoutModel.showMessage('error', err);
                this.layoutModel.dispatcher.dispatch(Actions.AsyncCalculationFailed);
            },
        });
    }
}