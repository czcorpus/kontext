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

import { PageModel } from '../../app/page';
import * as Kontext from '../../types/kontext';
import { HTTP, tuple } from 'cnc-tskit';


type WatchdogUpdateCallback = (status:number, err:Error)=>void;

/**
 *
 */
export class CalcWatchdog {

    private layoutModel:PageModel;

    private numNoChange:number;

    private lastStatus:number;

    private checkIntervalId:number;

    private onUpdate:WatchdogUpdateCallback;

    /**
     * Specifies after how many checks should client
     * give-up on watching the status.
     */
    static MAX_NUM_NO_CHANGE = 240;

    static CHECK_INTERVAL_SEC = 2;

    constructor(layoutModel:PageModel, onUpdate:WatchdogUpdateCallback) {
        this.layoutModel = layoutModel;
        this.onUpdate = onUpdate;
    }

    private checkStatus():void {
        const args = [
            tuple('corpname', this.layoutModel.getCorpusIdent().id),
            tuple('usesubcorp', this.layoutModel.getCorpusIdent().usesubcorp),
            tuple('attrname', this.layoutModel.getConf<string>('attrname'))
        ];
        this.layoutModel.getConf<Array<string>>('workerTasks').forEach(taskId => {
            args.push(tuple('worker_tasks', taskId));
        });
        this.layoutModel.ajax$(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('wordlist_process'),
            args

        ).subscribe(
            (data:Kontext.AjaxResponse) => {
                if (data['status'] === 100) {
                        this.stopWatching(); // just for sure

                } else if (this.numNoChange >= CalcWatchdog.MAX_NUM_NO_CHANGE) {
                    this.onUpdate(null, new Error(this.layoutModel.translate('global__bg_calculation_failed')));

                } else if (data['status'] === this.lastStatus) {
                    this.numNoChange += 1;
                }
                this.lastStatus = data['status'];
                this.onUpdate(this.lastStatus, null);
            },
            (err) => {
                this.onUpdate(null, new Error(this.layoutModel.translate('global__bg_calculation_failed')));
            }
        );
    }

    startWatching():void {
        this.numNoChange = 0;
        this.checkIntervalId = window.setInterval(this.checkStatus.bind(this),
                CalcWatchdog.CHECK_INTERVAL_SEC * 1000);
    }

    stopWatching():void {
        clearTimeout(this.checkIntervalId);
    }
}

