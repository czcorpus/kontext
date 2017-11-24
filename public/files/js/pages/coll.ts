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
/// <reference path="../types/views.d.ts" />

import {PageModel} from './document';
import {MultiDict, dictToPairs} from '../util';
import {CollFormStore, CollFormProps, CollFormInputs} from '../stores/coll/collForm';
import {MLFreqFormStore, TTFreqFormStore, FreqFormInputs, FreqFormProps} from '../stores/freqs/freqForms';
import {CTFormProperties, CTFormInputs, CTFreqFormStore} from '../stores/freqs/ctFreqForm';
import {QueryReplayStore, IndirectQueryReplayStore} from '../stores/query/replay';
import {QuerySaveAsFormStore} from '../stores/query/save';
import {CollResultStore, CollResultData, CollResultHeading} from '../stores/coll/result';
import {init as analysisFrameInit, AnalysisFrameViews} from 'views/analysis';
import {init as collFormInit, CollFormViews} from 'views/coll/forms';
import {init as collResultViewInit} from 'views/coll/result';
import {init as freqFormInit, FreqFormViews} from 'views/freqs/forms';
import {init as queryOverviewInit, QueryToolbarViews} from 'views/query/overview';


declare var require:any;
// weback - ensure an individual style (even empty one) is created for the page
require('styles/coll.less');

/**
 *
 */
export class CollPage {

    private layoutModel:PageModel;

    private collFormStore:CollFormStore;

    private mlFreqStore:MLFreqFormStore;

    private ttFreqStore:TTFreqFormStore;

    private ctFreqFormStore:CTFreqFormStore;

    private queryReplayStore:IndirectQueryReplayStore;

    private collResultStore:CollResultStore;

    private querySaveAsFormStore:QuerySaveAsFormStore;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
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

        const ctFormInputs = this.layoutModel.getConf<CTFormInputs>('CTFreqFormProps');
        const ctFormProps:CTFormProperties = {
            attrList: attrs,
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
            ctattr1: ctFormInputs.ctattr1,
            ctattr2: ctFormInputs.ctattr2,
            ctfcrit1: ctFormInputs.ctfcrit1,
            ctfcrit2: ctFormInputs.ctfcrit2,
            multiSattrAllowedStructs: this.layoutModel.getConf<Array<string>>('multiSattrAllowedStructs'),
            ctminfreq: ctFormInputs.ctminfreq,
            ctminfreq_type: ctFormInputs.ctminfreq_type
        };


        this.ctFreqFormStore = new CTFreqFormStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps
        );

        const freqFormViews = freqFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.mlFreqStore,
            this.ttFreqStore,
            this.ctFreqFormStore
        );

        // collocations ------------------------------------

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
            this.layoutModel.getComponentHelpers(),
            this.layoutModel.layoutViews,
            this.collFormStore
        );
        // TODO: init freq form
        const analysisViews = analysisFrameInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
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

        // ---- coll result

        this.collResultStore = new CollResultStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.collFormStore,
            this.layoutModel.getConf<CollResultData>('CollResultData'),
            this.layoutModel.getConf<CollResultHeading>('CollResultHeading'),
            this.layoutModel.getConf<number>('CollPageSize'),
            (s)=>this.setDownloadLink(s),
            this.layoutModel.getConf<number>('CollSaveLinesLimit'),
            !!this.layoutModel.getConf<number>('CollUnfinished')
        );

        const collResultViews = collResultViewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.layoutModel.layoutViews,
            this.collResultStore
        );

        this.layoutModel.renderReactComponent(
            collResultViews.CollResultView,
            document.getElementById('coll-view-mount'),
            {}
        );
    }

    private initQueryOpNavigation():void {
        this.queryReplayStore = new IndirectQueryReplayStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.layoutModel.getConf<Array<Kontext.QueryOperation>>('queryOverview') || []
        );
        this.querySaveAsFormStore = new QuerySaveAsFormStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.layoutModel.getConf<string>('concPersistenceOpId')
        );
        const queryOverviewViews = queryOverviewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.layoutModel.layoutViews,
            {
                QueryFormView: null,
                FilterFormView: null,
                SortFormView: null,
                SampleFormView: null,
                ShuffleFormView: null,
                SwitchMainCorpFormView: null
            },
            this.queryReplayStore,
            this.layoutModel.getStores().mainMenuStore,
            this.querySaveAsFormStore
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

    setDownloadLink(url:string):void {
        const iframe = <HTMLIFrameElement>document.getElementById('download-frame');
        iframe.src = url;
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
                this.initQueryOpNavigation();
            }

        ).catch((err) => {
            console.error(err);
        });
    }
}


export function init(conf:Kontext.Conf, runningInBg:boolean):void {
    new CollPage(new PageModel(conf)).init();
}
