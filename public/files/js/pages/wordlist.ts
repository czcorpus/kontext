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

import * as Kontext from '../types/kontext';
import { PageModel, DownloadType } from '../app/page';
import { WordlistFormExportViews } from '../views/wordlist/form';
import { init as wordlistResultViewInit } from '../views/wordlist/result';
import { init as wordlistSaveViewInit } from '../views/wordlist/save';
import { WordlistFormModel, WordlistFormModelArgs } from '../models/wordlist/form';
import { WordlistSaveModel } from '../models/wordlist/save';
import { init as queryOverviewInit } from '../views/wordlist/overview';
import { KontextPage } from '../app/main';
import { WordlistResultModel } from '../models/wordlist/main';
import { ResultItem, WordlistSaveArgs } from '../models/wordlist/common';
import { Actions } from '../models/wordlist/actions';
import { Ident } from 'cnc-tskit';


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

    setDownloadLink(name:string, format:string, url:string, args:WordlistSaveArgs):void {
        this.layoutModel.bgDownload({
            name,
            format,
            datasetType: DownloadType.WORDLIST,
            url,
            contentType: 'multipart/form-data',
            args,
        }).subscribe();
    }

    private initCorpnameLink(model:WordlistFormModel, corparchWidgetId:string):void {
        const queryOverviewViews = queryOverviewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            model,
            null,
            this.layoutModel.getModels().mainMenuModel,
            corparchWidgetId
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
                corpusIdent: this.layoutModel.getCorpusIdent(),
                subcorpList: this.layoutModel.getConf<Array<string>>('SubcorpList'),
                attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                structAttrList: Kontext.structsAndAttrsToStructAttrList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs')),
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
                    reverse: this.layoutModel.getConf<boolean>('Reverse'),
                    wlsort: this.layoutModel.getConf<string>('Wlsort'),
                    page: this.layoutModel.getConf<number>('PageNum'),
                    pageSize: this.layoutModel.getConf<number>('PageSize'),
                    isLastPage: !!this.layoutModel.getConf<boolean>('IsLastPage')
                },
                [
                    {
                        str: this.layoutModel.getConf<string>('wlattrLabel'),
                        sortKey: 'wlattr'
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

            this.layoutModel.initKeyShortcuts();

            this.layoutModel.getHistory().setOnPopState(
                (evt:PopStateEvent) => {
                    if ('wlsort' in evt.state && 'wlpage' in evt.state) {
                        this.layoutModel.dispatcher.dispatch<typeof Actions.WordlistHistoryPopState>({
                            name: Actions.WordlistHistoryPopState.name,
                            payload: {...evt.state}
                    });
                }
            });
            const corparchWidgetId = Ident.puid()
            this.initCorpnameLink(formModel, corparchWidgetId);
        });
    }
}


export function init(conf:Kontext.Conf):void {
    new WordlistPage(new KontextPage(conf)).init();
}