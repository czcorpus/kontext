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
import * as $ from 'jquery';
import {MultiDict, dictToPairs} from '../util';
import {CollFormStore, CollFormProps, CollFormInputs} from '../stores/analysis/collForm';
import {MLFreqFormStore, TTFreqFormStore, FreqFormInputs, FreqFormProps} from '../stores/analysis/freqForms';
import {init as analysisFrameInit, AnalysisFrameViews} from 'views/analysis/frame';
import {init as collFormInit, CollFormViews} from 'views/analysis/coll';
import {init as freqFormInit, FreqFormViews} from 'views/analysis/freq';

/**
 *
 */
export class CollPage {

    private layoutModel:PageModel;

    private checkIntervalId:number;

    private numNoChange:number;

    private lastStatus:number;

    private collFormStore:CollFormStore;

    private mlFreqStore:MLFreqFormStore;

    private ttFreqStore:TTFreqFormStore;

    static MAX_NUM_NO_CHANGE = 20;

    constructor(layoutModel:PageModel) {
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
        this.layoutModel.getConf<Array<string>>('workerTasks').forEach(taskId => {
            args.add('worker_tasks', taskId);
        });
        this.layoutModel.ajax(
            'GET',
            this.layoutModel.createActionUrl('wordlist_process'),
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
                        this.layoutModel.reload();

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
        const attrs = this.layoutModel.getConf<Array<{n:string; label:string}>>('AttrList');
        const currArgs = this.layoutModel.getConf<CollFormInputs>('CollFormArgs');
        const structAttrs = this.layoutModel.getConf<Array<{n:string; label:string}>>('StructAttrList');

        const freqFormProps:FreqFormProps = {
            structAttrList: structAttrs,
            fttattr: [structAttrs[0].n],
            ftt_include_empty: false,
            flimit: '0',
            attrList: attrs,
            mlxattr: [attrs[0].n],
            mlxicase: [false],
            mlxctx: ['0~0>0'],  // = "Node'"
            alignType: ['left']
        }

        this.mlFreqStore = new MLFreqFormStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            freqFormProps,
            this.layoutModel.getConf<number>('multilevelFreqDistMaxLevels')
        );

        this.ttFreqStore = new TTFreqFormStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            freqFormProps
        );

        const freqFormViews = freqFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.mlFreqStore,
            this.ttFreqStore
        );

        this.collFormStore = new CollFormStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
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
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.collFormStore
        );
        // TODO: init freq form
        const analysisViews = analysisFrameInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            collFormViews,
            freqFormViews,
            this.layoutModel.getStores().mainMenuStore
        );
        this.layoutModel.renderReactComponent(
            analysisViews.AnalysisFrame,
            window.document.getElementById('analysis-forms-mount'),
            {
                initialFreqFormVariant: 'ml'
            }
        );
    }

    init():void {
        this.layoutModel.init().then(
            () => {
                const mainMenuStore = this.layoutModel.getStores().mainMenuStore;
                // we must capture concordance-related actions which lead
                // to specific "pop-up" forms and redirect user back to
                // the 'view' action with additional information (encoded in
                // the fragment part of the URL) which form should be opened
                // once the 'view' page is loaded
                mainMenuStore.addChangeListener(() => {
                    const activeItem = mainMenuStore.getActiveItem() || {actionName: null, actionArgs: []};
                    switch (activeItem.actionName) {
                        case 'MAIN_MENU_SHOW_FILTER':
                            const filterArgs = new MultiDict(dictToPairs(activeItem.actionArgs));
                            window.location.replace(
                                this.layoutModel.createActionUrl(
                                    'view',
                                    this.layoutModel.getConcArgs().items()
                                ) + '#filter/' + this.layoutModel.encodeURLParameters(filterArgs)
                            );
                        break;
                        case 'MAIN_MENU_SHOW_SORT':
                            window.location.replace(this.layoutModel.createActionUrl(
                                'view',
                                this.layoutModel.getConcArgs().items()
                            ) + '#sort');
                        break;
                        case 'MAIN_MENU_SHOW_SAMPLE':
                            window.location.replace(this.layoutModel.createActionUrl(
                                'view',
                                this.layoutModel.getConcArgs().items()
                            ) + '#sample');
                        break;
                        case 'MAIN_MENU_APPLY_SHUFFLE':
                            window.location.replace(this.layoutModel.createActionUrl(
                                'view',
                                this.layoutModel.getConcArgs().items()
                            ) + '#shuffle');
                        break;
                    }
                });
                this.initAnalysisViews();
            }
        )
    }
}


export function init(conf:Kontext.Conf):void {
    const model = new CollPage(new PageModel(conf));
    model.init();
}
