/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

import { of as rxOf, zip } from 'rxjs';
import { expand, takeWhile, delay, concatMap, take } from 'rxjs/operators';
import { HTTP } from 'cnc-tskit';
import { PageModel } from "../../app/page";
import { Actions } from './actions';
import * as Kontext from '../../types/kontext';


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

    private static CHECK_CONC_DECAY = 1.08;

    private static CHECK_CONC_MAX_WAIT = 500;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }


    init():void {
        const linesPerPage = this.layoutModel.getConf<number>('ItemsPerPage');
        const applyData = (data:ConcStatus) => {
            this.layoutModel.dispatcher.dispatch<typeof Actions.AsyncCalculationUpdated>({
                name: Actions.AsyncCalculationUpdated.name,
                payload: {
                    finished: !!data.finished,
                    concsize: data.concsize,
                    relconcsize: data.relconcsize,
                    arf: data.arf,
                    fullsize: data.fullsize,
                    availPages: Math.ceil(data.concsize / linesPerPage)
                }
            });
        };

        if (this.layoutModel.supportsWebSocket()) {
            const [checkConc$, concCacheStatusSocket] = this.layoutModel.openWebSocket<{
                user_id:number;
                corp_id:string;
                subc_path:string;
                conc_id:string}, ConcStatus>('conc_cache_status');
            concCacheStatusSocket.subscribe({
                next: response => {
                    applyData(response);
                },
                error: err => {
                    this.layoutModel.dispatcher.dispatch<typeof Actions.AsyncCalculationFailed>({
                        name: Actions.AsyncCalculationFailed.name,
                        payload: {}
                    });
                    this.layoutModel.showMessage('error', err);
                }
            });
            checkConc$.next({
                user_id: this.layoutModel.getConf<number>('userId'),
                corp_id: this.layoutModel.getCorpusIdent().id,
                subc_path: this.layoutModel.getCorpusIdent().usesubcorp,
                conc_id: this.layoutModel.getConf<string>('concPersistenceOpId')
            });

        } else {
            rxOf(HitReloader.CHECK_CONC_DECAY).pipe(
                expand(
                    (interval) => rxOf(interval * HitReloader.CHECK_CONC_DECAY)
                ),
                take(100), // just a safe limit
                concatMap(v => rxOf(v).pipe(delay(v * 1000))),
                concatMap(
                    (interval) => zip(
                        this.layoutModel.ajax$<ConcStatus>(
                            HTTP.Method.GET,
                            this.layoutModel.createActionUrl('get_conc_cache_status'),
                            this.layoutModel.getConcArgs()
                        ),
                        rxOf(interval)
                    )
                ),
                takeWhile(
                    ([response, interval]) => interval < HitReloader.CHECK_CONC_MAX_WAIT &&
                        !response.finished,
                    true // true => emit also the last item (which already breaks the predicate)
                ),
            ).subscribe({
                next: ([response,]) => {
                    applyData(response);
                },
                error: (err) => {
                    this.layoutModel.dispatcher.dispatch<typeof Actions.AsyncCalculationFailed>({
                        name: Actions.AsyncCalculationFailed.name,
                        payload: {}
                    });
                    this.layoutModel.showMessage('error', err);
                }
            });
        }
    }
}