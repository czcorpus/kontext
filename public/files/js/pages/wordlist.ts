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

import {Kontext} from '../types/common';
import {PageModel, DownloadType} from '../app/main';
import {MultiDict} from '../util';
import {init as wordlistFormInit, WordlistFormExportViews} from '../views/wordlist/form';
import {init as wordlistResultViewInit} from '../views/wordlist/result';
import {init as wordlistSaveViewInit} from '../views/wordlist/save';
import {StatefulModel} from '../models/base';
import {WordlistResultModel, ResultData, ResultItem, HeadingItem} from '../models/wordlist/main';
import {WordlistFormModel, WordlistFormProps} from '../models/wordlist/form';
import {WordlistSaveModel} from '../models/wordlist/save';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/wordlist.less');

/**
 *
 */
export class WordlistPage extends StatefulModel  {

    private layoutModel:PageModel;

    private checkIntervalId:number;

    private numErrors:number;

    private numNoChange:number;

    private lastStatus:number;

    private saveModel:WordlistSaveModel;

    private wordlistViews:WordlistFormExportViews;

    static MAX_NUM_NO_CHANGE = 20;

    constructor(layoutModel:PageModel) {
        super(layoutModel.dispatcher);
        this.layoutModel = layoutModel;
    }

    private stopWithError():void {
        this.stopWatching();
        this.layoutModel.showMessage(
                'error',
                this.layoutModel.translate('global__bg_calculation_failed'),
                () => {window.history.back();});
    }

    private checkStatus():void {
        const args = new MultiDict([
            ['corpname', this.layoutModel.getCorpusIdent().id],
            ['usesubcorp', this.layoutModel.getCorpusIdent().usesubcorp],
            ['attrname', this.layoutModel.getConf<string>('attrname')]
        ]);
        this.layoutModel.getConf<Array<string>>('WorkerTasks').forEach(taskId => {
            args.add('worker_tasks', taskId);
        });
        this.layoutModel.ajax(
            'GET',
            this.layoutModel.createActionUrl('wordlist_process'),
            args

        ).then(
            (data:Kontext.AjaxResponse) => {
                if (data['status'] === 100) {
                    this.stopWatching(); // just for sure
                    window.location.href = this.layoutModel.createActionUrl(
                        'wordlist',
                        new MultiDict(this.layoutModel.getConf<Kontext.ListOfPairs>('reloadArgs'))
                    );

                } else if (this.numNoChange >= WordlistPage.MAX_NUM_NO_CHANGE) {
                    this.stopWithError();

                } else if (data['status'] === this.lastStatus) {
                    this.numNoChange += 1;
                }
                this.lastStatus = data['status'];
            }
        ).catch(
            (err) => {
                this.stopWithError();
            }
        );
    }

    private startWatching():void {
        this.numNoChange = 0;
        this.checkIntervalId = window.setInterval(this.checkStatus.bind(this), 2000);
    }

    private stopWatching():void {
        clearTimeout(this.checkIntervalId);
    }

    private setupContextHelp(message):void {
        /*
        bindPopupBox($('#progress_message a.context-help'), message, {width: 'nice'});
        */
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
                usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp
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
        this.layoutModel.init().then(
            (data) => {
                this.setupContextHelp(this.layoutModel.translate('global__wl_calc_info'));
                if (this.layoutModel.getConf<boolean>('IsUnfinished')) {
                    this.startWatching();
                }
                const formModel = new WordlistFormModel(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    this.layoutModel.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
                    this.layoutModel.getConf<Array<string>>('SubcorpList'),
                    this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                    this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList')
                );
                formModel.csSetState(this.layoutModel.getConf<WordlistFormProps>('FormArgs'));

                this.saveModel = new WordlistSaveModel(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    this.setDownloadLink.bind(this),
                    () => formModel.createSubmitArgs()
                );

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
                    ]
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
                    wordlistSaveModel: this.saveModel
                });

                this.layoutModel.renderReactComponent(
                    view.WordlistResult,
                    document.getElementById('wordlist-result-mount'),
                    {}
                );

                this.initCorpInfoToolbar();

                this.layoutModel.getHistory().replaceState(
                    'wordlist',
                    new MultiDict(this.layoutModel.getConf<Kontext.ListOfPairs>('reloadArgs')),
                    {},
                    ''
                )
            }

        ).then(
            this.layoutModel.addUiTestingFlag

        ).catch(
            (err) => console.error(err)
        );
    }
}


export function init(conf:Kontext.Conf):void {
    const page:WordlistPage = new WordlistPage(new PageModel(conf));
    page.init();
}