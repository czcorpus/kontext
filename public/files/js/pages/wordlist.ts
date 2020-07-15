/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Observable, interval as rxInterval } from 'rxjs';
import { concatMap, scan, takeWhile, last } from 'rxjs/operators';
import { HTTP } from 'cnc-tskit';

import { Kontext } from '../types/common';
import { PageModel, DownloadType } from '../app/page';
import { MultiDict } from '../multidict';
import { init as wordlistFormInit, WordlistFormExportViews } from '../views/wordlist/form';
import { init as wordlistResultViewInit } from '../views/wordlist/result';
import { init as wordlistSaveViewInit } from '../views/wordlist/save';
import { WordlistFormModel, WordlistModelInitialArgs } from '../models/wordlist/form';
import { WordlistSaveModel } from '../models/wordlist/save';
import { KontextPage } from '../app/main';
import { WordlistResultModel } from '../models/wordlist/main';
import { ResultItem } from '../models/wordlist/common';
import { Actions, ActionName } from '../models/wordlist/actions';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/wordlist.less');


interface AsyncProcessResponse {
    status:number;
}

interface AsyncProcessStatus extends AsyncProcessResponse {
    numUnchanged:number;
}

/**
 *
 */
export class WordlistPage {

    private readonly layoutModel:PageModel;

    private saveModel:WordlistSaveModel;

    private wordlistViews:WordlistFormExportViews;

    static MAX_NUM_NO_CHANGE = 30;

    static MAX_NUM_STATUS_CHECK = 300;

    static STATUS_CHECK_INTERVAL = 3000;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private startWatching():Observable<AsyncProcessStatus> {
        const args = new MultiDict<{
            corpname:string;
            usesubcorp:string;
            attrname:string;
            worker_tasks:string}>
        ([
            ['corpname', this.layoutModel.getCorpusIdent().id],
            ['usesubcorp', this.layoutModel.getCorpusIdent().usesubcorp],
            ['attrname', this.layoutModel.getConf<string>('attrname')]
        ]);
        this.layoutModel.getConf<Array<string>>('WorkerTasks').forEach(taskId => {
            args.add('worker_tasks', taskId);
        });

        return rxInterval(WordlistPage.STATUS_CHECK_INTERVAL).pipe(
            concatMap((v, i) => {
                return this.layoutModel.ajax$<AsyncProcessResponse>(
                    HTTP.Method.GET,
                    this.layoutModel.createActionUrl('wordlist/process'),
                    args
                );
            }),
            scan(
                (acc:AsyncProcessStatus, v:AsyncProcessResponse, i:number) => {
                    if (v.status === acc.status) {
                        if (acc.numUnchanged + 1 >= WordlistPage.MAX_NUM_NO_CHANGE ||
                                    i >= WordlistPage.MAX_NUM_STATUS_CHECK) {
                            throw new Error('No change for too long...');
                        }
                        return {
                            status: v.status,
                            numUnchanged: acc.numUnchanged + 1
                        };

                    } else {
                        return {
                            status: v.status,
                            numUnchanged: 0
                        };
                    }
                },
                {status: 0, numUnchanged: 0}
            ),
            takeWhile(
                (resp) => resp.status < 100 || resp.numUnchanged < 1
            )
        );
    }

    private initCorpInfoToolbar():void {
        this.wordlistViews = wordlistFormInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            CorparchWidget: null,
            wordlistFormModel: null
        });
        this.layoutModel.renderReactComponent(
            this.wordlistViews.CorpInfoToolbar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getCorpusIdent().id,
                humanCorpname: this.layoutModel.getCorpusIdent().name,
                usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                origSubcorpName: undefined,
                foreignSubcorp: undefined
            }
        );
    }

    setDownloadLink(file:string, url:string):void {
        this.layoutModel.bgDownload(
            file,
            DownloadType.WORDLIST,
            url
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            if (this.layoutModel.getConf<boolean>('IsUnfinished')) {
                const updateStream = this.startWatching();
                updateStream.subscribe(
                    (data) => {
                        this.layoutModel.dispatcher.dispatch({
                            name: 'WORDLIST_IMTERMEDIATE_BG_CALC_UPDATED',
                            payload: data
                        });
                    }
                );
                updateStream.pipe(last()).subscribe(
                    (data) => {
                        if (data.status === 100) {
                            window.location.href = this.layoutModel.createActionUrl(
                                'wordlist/result',
                                new MultiDict(this.layoutModel.getConf<Kontext.ListOfPairs>('reloadArgs'))
                            );

                        } else {
                            this.layoutModel.dispatcher.dispatch({
                                name: 'WORDLIST_IMTERMEDIATE_BG_CALC_UPDATED',
                                payload: data,
                                error: new Error(this.layoutModel.translate('global__bg_calculation_failed'))
                            });
                            this.layoutModel.showMessage(
                                'error',
                                this.layoutModel.translate('global__bg_calculation_failed')
                            );
                        }
                    },
                    (err) => {
                        this.layoutModel.showMessage(
                            'error',
                            this.layoutModel.translate('global__bg_calculation_failed')
                        );
                        this.layoutModel.dispatcher.dispatch({
                            name: 'WORDLIST_IMTERMEDIATE_BG_CALC_UPDATED',
                            payload: {},
                            error: err
                        });
                        console.error(err);
                    }
                )
            }
            const formModel = new WordlistFormModel(
                this.layoutModel.dispatcher,
                this.layoutModel,
                this.layoutModel.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
                this.layoutModel.getConf<Array<string>>('SubcorpList'),
                this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
                this.layoutModel.getConf<WordlistModelInitialArgs>('FormArgs')
            );

            this.saveModel = new WordlistSaveModel({
                dispatcher: this.layoutModel.dispatcher,
                layoutModel: this.layoutModel,
                quickSaveRowLimit: this.layoutModel.getConf<number>('QuickSaveRowLimit'),
                saveLinkFn: this.setDownloadLink.bind(this)
            });

            const resultModel = new WordlistResultModel(
                this.layoutModel.dispatcher,
                this.layoutModel,
                formModel,
                {
                    data: this.layoutModel.getConf<Array<ResultItem>>('Data'),
                    page: this.layoutModel.getConf<number>('PageNum'),
                    pageSize: this.layoutModel.getConf<number>('PageSize'),
                    isLastPage: !!this.layoutModel.getConf<boolean>('IsLastPage')
                },
                [
                    {
                        str: this.layoutModel.getConf<string>('wlattrLabel'),
                        sortKey: ''
                    },
                    {
                        str: this.layoutModel.getConf<string>('freqFigure'),
                        sortKey: 'f'
                    }
                ],
                this.layoutModel.getConf<Kontext.ListOfPairs>('reloadArgs'),
                this.layoutModel.getConf<boolean>('IsUnfinished')
            );

            const saveViews = wordlistSaveViewInit({
                dispatcher: this.layoutModel.dispatcher,
                utils: this.layoutModel.getComponentHelpers(),
                commonViews: this.layoutModel.commonViews,
                saveModel: this.saveModel
            });

            const view = wordlistResultViewInit({
                dispatcher: this.layoutModel.dispatcher,
                utils: this.layoutModel.getComponentHelpers(),
                wordlistSaveViews:saveViews,
                wordlistResultModel: resultModel,
                wordlistFormModel: formModel
            });

            this.layoutModel.renderReactComponent(
                view.WordlistResult,
                document.getElementById('wordlist-result-mount'),
                {}
            );

            this.initCorpInfoToolbar();

            this.layoutModel.getHistory().replaceState(
                'wordlist/result',
                new MultiDict(this.layoutModel.getConf<Kontext.ListOfPairs>('reloadArgs')),
                {
                    pagination: true,
                    page: 1
                },
                ''
            );

            this.layoutModel.getHistory().setOnPopState((evt:PopStateEvent) => {
                if (evt.state['pagination']) {
                    this.layoutModel.dispatcher.dispatch<Actions.WordlistHistoryPopState>({
                        name: ActionName.WordlistHistoryPopState,
                        payload: {
                            currPageInput: evt.state['page']
                        }
                    });
                }
            });
        });
    }
}


export function init(conf:Kontext.Conf):void {
    new WordlistPage(new KontextPage(conf)).init();
}