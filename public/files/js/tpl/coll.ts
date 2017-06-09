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
import {MLFreqFormStore, TTFreqFormStore, FreqFormInputs, FreqFormProps} from '../stores/freqs/freqForms';
import {ContingencyTableStore, ContingencyTableFormProperties, ContingencyTableFormInputs} from '../stores/freqs/ctable';
import {QueryReplayStore, IndirectQueryReplayStore} from '../stores/query/replay';
import {init as analysisFrameInit, AnalysisFrameViews} from 'views/analysis';
import {init as collFormInit, CollFormViews} from 'views/coll/forms';
import {init as freqFormInit, FreqFormViews} from 'views/freqs/forms';
import {init as structsAttrsViewInit, StructsAndAttrsViews} from 'views/options/structsAttrs';
import {init as queryOverviewInit, QueryToolbarViews} from 'views/query/overview';

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

    private ctFreqStore:ContingencyTableStore;

    private queryReplayStore:IndirectQueryReplayStore;

    /**
     * Specifies after how many checks should client
     * give-up on watching the status.
     */
    static MAX_NUM_NO_CHANGE = 240;

    static CHECK_INTERVAL_SEC = 2;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private stopWithError(customMsg?:string):void {
        if (!customMsg) {
            customMsg = '';
        }
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
                        this.stopWithError('global__bg_calculation_waiting_failed');

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
        this.checkIntervalId = setInterval(this.checkStatus.bind(this),
                CollPage.CHECK_INTERVAL_SEC * 1000);
    }

    stopWatching():void {
        clearTimeout(this.checkIntervalId);
    }

    initAnalysisViews():void {
        const attrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList');
        const currArgs = this.layoutModel.getConf<CollFormInputs>('CollFormProps');
        const structAttrs = this.layoutModel.getConf<Array<{n:string; label:string}>>('StructAttrList');
        const freqFormInputs = this.layoutModel.getConf<FreqFormInputs>('FreqFormProps');

        const freqFormProps:FreqFormProps = {
            structAttrList: structAttrs,
            fttattr: freqFormInputs.fttattr,
            ftt_include_empty: freqFormInputs.ftt_include_empty,
            flimit: freqFormInputs.flimit,
            freq_sort: freqFormInputs.freq_sort,
            attrList: attrs,
            mlxattr: [attrs[0].n],
            mlxicase: [false],
            mlxctx: ['0>0'],  // = "Node'"
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

        const ctFormInputs = this.layoutModel.getConf<ContingencyTableFormInputs>('CTFreqFormProps');
        const ctFormProps:ContingencyTableFormProperties = {
            attrList: attrs,
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
            ctattr1: ctFormInputs.ctattr1,
            ctattr2: ctFormInputs.ctattr2,
            ctfcrit1: ctFormInputs.ctfcrit1,
            ctfcrit2: ctFormInputs.ctfcrit2,
            multiSattrAllowedStructs: this.layoutModel.getConf<Array<string>>('multiSattrAllowedStructs'),
            queryContainsWithin: this.layoutModel.getConf<boolean>('ContainsWithin'),
            ctminfreq: ctFormInputs.ctminfreq
        };


        this.ctFreqStore = new ContingencyTableStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps
        );

        const freqFormViews = freqFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.mlFreqStore,
            this.ttFreqStore,
            this.ctFreqStore
        );

        this.collFormStore = new CollFormStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            {
                attrList: attrs,
                cattr: currArgs.cattr || attrs[0].n,
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

    private initViewOptions():void {
        const viewOptionsViews:StructsAndAttrsViews = structsAttrsViewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.layoutModel.getStores().viewOptionsStore,
            this.layoutModel.getStores().mainMenuStore
        );

        this.layoutModel.renderReactComponent(
            viewOptionsViews.StructAttrsViewOptions,
            window.document.getElementById('view-options-mount'),
            {
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                isSubmitMode: true,
                stateArgs: this.layoutModel.getConcArgs().items()
            }
        );
    }

    private initQueryOpNavigation():void {
        this.queryReplayStore = new IndirectQueryReplayStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.layoutModel.getConf<Array<Kontext.QueryOperation>>('queryOverview') || []
        );
        const queryOverviewViews = queryOverviewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            {
                QueryFormView: null,
                FilterFormView: null,
                SortFormView: null,
                SampleFormView: null,
                ShuffleFormView: null
            },
            this.queryReplayStore,
            this.layoutModel.getStores().mainMenuStore
        );
        this.layoutModel.renderReactComponent(
            queryOverviewViews.NonViewPageQueryToolbar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getConf<string>('corpname'),
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                usesubcorp: this.layoutModel.getConf<string>('usesubcorp'),
                queryFormProps: {},
                filterFormProps: {},
                sortFormProps: {},
                shuffleFormProps: {}
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
                mainMenuStore.addItemActionPrerequisite(
                    'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS',
                    (args:Kontext.GeneralProps) => {
                        return this.layoutModel.getStores().viewOptionsStore.loadData();
                    }
                );
                this.initViewOptions();
                this.initAnalysisViews();
                this.initQueryOpNavigation();
            }
        )
    }
}


export function init(conf:Kontext.Conf, runningInBg:boolean):void {
    const model = new CollPage(new PageModel(conf));
    model.init();
    if (runningInBg) {
        model.startWatching();
    }
}
