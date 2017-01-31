/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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
import $ = require('jquery');
import {MultiDict} from '../util';
import {CollFormStore, CollFormProps, CollFormInputs} from '../stores/coll/collForm';
import {init as analysisFrameInit, AnalysisFrameViews} from 'views/analysis/frame';
import {init as collFormInit, CollFormViews} from 'views/analysis/coll';

/**
 *
 */
export class CollPage {

    private pageModel:PageModel;

    private checkIntervalId:number;

    private numNoChange:number;

    private lastStatus:number;

    private collFormStore:CollFormStore;

    static MAX_NUM_NO_CHANGE = 20;

    constructor(pageModel:PageModel) {
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
        this.pageModel.getConf<Array<string>>('workerTasks').forEach(taskId => {
            args.add('worker_tasks', taskId);
        });
        this.pageModel.ajax(
            'GET',
            this.pageModel.createActionUrl('wordlist_process'),
            args,
            {contentType : 'application/x-www-form-urlencoded'}

        ).then(
            (data:Kontext.AjaxResponse) => {
                if (data.contains_errors) {
                    this.stopWithError();

                } else {
                    $('#processbar').css('width', data['status'] + '%');
                    if (data['status'] === 100) {
                        this.stopWatching(); // just for sure
                        this.pageModel.reload();

                    } else if (this.numNoChange >= CollPage.MAX_NUM_NO_CHANGE) {
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

    startWatching():void {
        this.numNoChange = 0;
        this.checkIntervalId = setInterval(this.checkStatus.bind(this), 2000);
    }

    stopWatching():void {
        clearTimeout(this.checkIntervalId);
    }

    initAnalysisViews():void {
        const attrs = this.pageModel.getConf<Array<{n:string; label:string}>>('AttrList');
        const currArgs = this.pageModel.getConf<CollFormInputs>('CollFormArgs');
        this.collFormStore = new CollFormStore(
            this.pageModel.dispatcher,
            this.pageModel,
            {
                attrList: attrs,
                cattr: currArgs.cattr,
                cfromw: currArgs.cfromw,
                ctow: currArgs.ctow,
                cminfreq: currArgs.cminfreq,
                cminbgr: currArgs.cminbgr,
                cbgrfns: currArgs.cbgrfns,
                csortfn: currArgs.csortfn
            }
        );
        const collFormViews = collFormInit(
            this.pageModel.dispatcher,
            this.pageModel.exportMixins(),
            this.pageModel.layoutViews,
            this.collFormStore
        );
        // TODO: init freq form
        const analysisViews = analysisFrameInit(
            this.pageModel.dispatcher,
            this.pageModel.exportMixins(),
            this.pageModel.layoutViews,
            collFormViews,
            null, // TODO
            this.pageModel.getStores().mainMenuStore
        );
        this.pageModel.renderReactComponent(
            analysisViews.AnalysisFrame,
            window.document.getElementById('analysis-forms-mount'),
            {}
        );
    }

    init():void {
        this.pageModel.init().then(
            () => {
                this.initAnalysisViews();
            }
        )
    }
}


export function init(conf:Kontext.Conf):void {
    const model = new CollPage(new PageModel(conf));
    model.init();
}
