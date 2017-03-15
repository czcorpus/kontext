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

import {PageModel} from './document';
import * as $ from 'jquery';
import {bind as bindPopupBox} from '../popupbox';
import {MultiDict} from '../util';
import {init as wordlistFormInit, WordlistFormViews} from 'views/wordlist/form';
import {SimplePageStore} from '../stores/base';

/**
 *
 */
export class WordlistPage extends SimplePageStore  {

    private pageModel:PageModel;

    private checkIntervalId:number;

    private numErrors:number;

    private numNoChange:number;

    private lastStatus:number;

    static MAX_NUM_NO_CHANGE = 20;

    constructor(pageModel:PageModel) {
        super(pageModel.dispatcher);
        this.pageModel = pageModel;
    }

    private stopWithError():void {
        this.stopWatching();
        this.pageModel.showMessage(
                'error',
                this.pageModel.translate('global__bg_calculation_failed'),
                () => {window.history.back();});
    }

    private checkStatus():void {
        const args = new MultiDict([
            ['corpname', this.pageModel.getConf<string>('corpname')],
            ['usesubcorp', this.pageModel.getConf<string>('subcorpname')],
            ['attrname', this.pageModel.getConf<string>('attrname')]
        ]);
        this.pageModel.getConf<Array<string>>('WorkerTasks').forEach(taskId => {
            args.add('worker_tasks', taskId);
        });
        this.pageModel.ajax(
            'GET',
            this.pageModel.createActionUrl('wordlist_process'),
            args

        ).then(
            (data:Kontext.AjaxResponse) => {
                if (data.contains_errors) {
                    this.stopWithError();

                } else {
                    $('#processbar').css('width', data['status'] + '%');
                    if (data['status'] === 100) {
                        this.stopWatching(); // just for sure
                        window.location.href = this.pageModel.getConf<string>('reloadUrl');

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
        bindPopupBox($('#progress_message a.context-help'), message, {width: 'nice'});
    }

    private initCorpInfoToolbar():void {
        const views:WordlistFormViews = wordlistFormInit(
            this.pageModel.dispatcher,
            this.pageModel.exportMixins(),
            this.pageModel.layoutViews,
            this
        );
        this.pageModel.renderReactComponent(
            views.CorpInfoToolbar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.pageModel.getConf<string>('corpname'),
                humanCorpname: this.pageModel.getConf<string>('humanCorpname'),
                usesubcorp: this.pageModel.getConf<string>('subcorpname')
            }
        );
    }

    init():void {
        this.pageModel.init().then(
            (data) => {
                this.setupContextHelp(this.pageModel.translate('global__wl_calc_info'));
                if (this.pageModel.getConf<boolean>('IsUnfinished')) {
                    this.startWatching();
                }
                this.initCorpInfoToolbar();
            }
        );
    }
}


export function init(conf:Kontext.Conf):void {
    const page:WordlistPage = new WordlistPage(new PageModel(conf));
    page.init();
}