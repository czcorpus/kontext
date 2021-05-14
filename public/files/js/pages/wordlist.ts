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

import { Kontext } from '../types/common';
import { PageModel, DownloadType } from '../app/page';
import { init as wordlistFormInit, WordlistFormExportViews } from '../views/wordlist/form';
import { init as wordlistResultViewInit } from '../views/wordlist/result';
import { init as wordlistSaveViewInit } from '../views/wordlist/save';
import { WordlistFormModel, WordlistFormModelArgs } from '../models/wordlist/form';
import { WordlistSaveModel } from '../models/wordlist/save';
import { init as queryOverviewInit } from '../views/wordlist/overview';
import { KontextPage } from '../app/main';
import { WordlistResultModel } from '../models/wordlist/main';
import { ResultItem, WordlistSaveArgs } from '../models/wordlist/common';
import { Actions, ActionName } from '../models/wordlist/actions';


interface AsyncProcessResponse {
    status:number;
}

/**
 *
 */
export class WordlistPage {

    private readonly layoutModel:PageModel;

    private saveModel:WordlistSaveModel;

    private wordlistViews:WordlistFormExportViews;

    static MAX_NUM_NO_CHANGE = 80;

    static MAX_NUM_STATUS_CHECK = 300;

    static STATUS_CHECK_INTERVAL = 3000;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
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

    setDownloadLink(file:string, url:string, args:WordlistSaveArgs):void {
        this.layoutModel.bgDownload(
            file,
            DownloadType.WORDLIST,
            url,
            'application/json',
            args
        );
    }

    private initCorpnameLink(model:WordlistFormModel):void {
        const queryOverviewViews = queryOverviewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            model,
            null,
            this.layoutModel.getModels().mainMenuModel
        );
        this.layoutModel.renderReactComponent(
            queryOverviewViews,
            window.document.getElementById('query-overview-mount'),
            {
                queryId: this.layoutModel.getConf<string>('QueryId')
            }
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {

            const formModel = new WordlistFormModel({
                dispatcher: this.layoutModel.dispatcher,
                layoutModel: this.layoutModel,
                corpusIdent: this.layoutModel.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
                subcorpList: this.layoutModel.getConf<Array<string>>('SubcorpList'),
                attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
                initialArgs: this.layoutModel.getConf<WordlistFormModelArgs['initialArgs']>('Form')
            });

            this.saveModel = new WordlistSaveModel({
                dispatcher: this.layoutModel.dispatcher,
                layoutModel: this.layoutModel,
                quickSaveRowLimit: this.layoutModel.getConf<number>('QuickSaveRowLimit'),
                queryId: this.layoutModel.getConf<string>('QueryId'),
                saveLinkFn: this.setDownloadLink.bind(this)
            });

            const resultModel = new WordlistResultModel(
                this.layoutModel.dispatcher,
                this.layoutModel,
                {
                    data: this.layoutModel.getConf<Array<ResultItem>>('Data'),
                    total: this.layoutModel.getConf<number>('Total'),
                    corpname: this.layoutModel.getCorpusIdent().id,
                    usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                    queryId: this.layoutModel.getConf<string>('QueryId'),
                    reversed: this.layoutModel.getConf<boolean>('Reversed'),
                    wlsort: this.layoutModel.getConf<string>('Wlsort'),
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
                wordlistSaveViews: saveViews,
                wordlistResultModel: resultModel,
                wordlistFormModel: formModel
            });

            this.layoutModel.renderReactComponent(
                view.WordlistResult,
                document.getElementById('wordlist-result-mount'),
                {}
            );

            this.initCorpInfoToolbar();
            this.layoutModel.initKeyShortcuts();

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

            this.initCorpnameLink(formModel);
        });
    }
}


export function init(conf:Kontext.Conf):void {
    new WordlistPage(new KontextPage(conf)).init();
}