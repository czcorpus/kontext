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

/// <reference path="../types/common.d.ts" />

import {PageModel} from '../app/main';
import {MultiDict} from '../util';
import {init as wordlistFormInit, WordlistFormViews} from 'views/wordlist/form';
import {init as wordlistResultViewInit} from 'views/wordlist/result';
import {init as wordlistSaveViewInit} from 'views/wordlist/save';
import {SimplePageStore} from '../stores/base';
import {WordlistResultStore, ResultData, ResultItem, HeadingItem} from '../stores/wordlist/main';
import {WordlistFormStore, WordlistFormProps} from '../stores/wordlist/form';
import {WordlistSaveStore} from '../stores/wordlist/save';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/wordlist.less');

/**
 *
 */
export class WordlistPage extends SimplePageStore  {

    private layoutModel:PageModel;

    private checkIntervalId:number;

    private numErrors:number;

    private numNoChange:number;

    private lastStatus:number;

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
            ['corpname', this.layoutModel.getConf<string>('corpname')],
            ['usesubcorp', this.layoutModel.getConf<string>('subcorpname')],
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
                if (data.contains_errors) {
                    this.stopWithError();

                } else {
                    // $('#processbar').css('width', data['status'] + '%');
                    if (data['status'] === 100) {
                        this.stopWatching(); // just for sure
                        window.location.href = this.layoutModel.getConf<string>('reloadUrl');

                    } else if (this.numNoChange >= WordlistPage.MAX_NUM_NO_CHANGE) {
                        this.stopWithError();

                    } else if (data['status'] === this.lastStatus) {
                        this.numNoChange += 1;
                    }
                    this.lastStatus = data['status'];
                }
            },
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
        const views:WordlistFormViews = wordlistFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.layoutModel.layoutViews,
            null, // TODO corparch widget view !!!!
            this
        );
        this.layoutModel.renderReactComponent(
            views.CorpInfoToolbar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getConf<string>('corpname'),
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                usesubcorp: this.layoutModel.getConf<string>('subcorpname')
            }
        );
    }

    setDownloadLink(url:string):void {
        const iframe = <HTMLIFrameElement>document.getElementById('download-frame');
        iframe.src = url;
    }

    init():void {
        this.layoutModel.init().then(
            (data) => {
                this.setupContextHelp(this.layoutModel.translate('global__wl_calc_info'));
                if (this.layoutModel.getConf<boolean>('IsUnfinished')) {
                    this.startWatching();
                }
                const formStore = new WordlistFormStore(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    this.layoutModel.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
                    this.layoutModel.getConf<string>('subcorpname'),
                    this.layoutModel.getConf<Array<string>>('SubcorpList'),
                    this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                    this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList')
                );
                formStore.csSetState(this.layoutModel.getConf<WordlistFormProps>('FormArgs'));

                const saveStore = new WordlistSaveStore(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    url => this.setDownloadLink(url),
                    () => formStore.createSubmitArgs()
                );

                const resultStore = new WordlistResultStore(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    formStore,
                    saveStore,
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

                const saveViews = wordlistSaveViewInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.getComponentHelpers(),
                    this.layoutModel.layoutViews,
                    this.layoutModel.commonViews,
                    saveStore
                );

                const view = wordlistResultViewInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.getComponentHelpers(),
                    this.layoutModel.layoutViews,
                    saveViews,
                    resultStore
                );

                this.layoutModel.renderReactComponent(
                    view.WordlistResult,
                    document.getElementById('wordlist-result-mount'),
                    {}
                );

                this.initCorpInfoToolbar();
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