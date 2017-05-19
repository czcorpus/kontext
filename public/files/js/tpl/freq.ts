/*
 * Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../types/common.d.ts" />
/// <reference path="../types/views.d.ts" />

import * as $ from 'jquery';
import {PageModel} from './document';
import {MultiDict, dictToPairs} from '../util';
import {bind as bindPopupBox} from '../popupbox';
import {CollFormStore, CollFormProps, CollFormInputs} from '../stores/analysis/collForm';
import {MLFreqFormStore, TTFreqFormStore, FreqFormInputs, FreqFormProps} from '../stores/analysis/freqForms';
import {QueryReplayStore, IndirectQueryReplayStore} from '../stores/query/replay';
import {init as freqFormInit, FreqFormViews} from 'views/analysis/freq';
import {init as collFormInit, CollFormViews} from 'views/analysis/coll';
import {init as analysisFrameInit, AnalysisFrameViews} from 'views/analysis/frame';
import {init as structsAttrsViewInit, StructsAndAttrsViews} from 'views/options/structsAttrs';
import {init as queryOverviewInit, QueryToolbarViews} from 'views/query/overview';

/**
 *
 */
class FreqPage {

    private layoutModel:PageModel;

    private mlFreqStore:MLFreqFormStore;

    private ttFreqStore:TTFreqFormStore;

    private collFormStore:CollFormStore;

    private queryReplayStore:IndirectQueryReplayStore;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private initAnalysisViews():void {
        const attrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList');

        // -------------------- freq form -------------------

        const freqFormInputs = this.layoutModel.getConf<FreqFormInputs>('FreqFormProps');
        const freqFormProps:FreqFormProps = {
            fttattr: freqFormInputs.fttattr || [],
            ftt_include_empty: freqFormInputs.ftt_include_empty || false,
            flimit: freqFormInputs.flimit || '1',
            freq_sort: freqFormInputs.freq_sort || 'freq',
            mlxattr: freqFormInputs.mlxattr || [attrs[0].n],
            mlxicase: freqFormInputs.mlxicase || [false],
            mlxctx: freqFormInputs.mlxctx || ['0>0'],
            alignType: freqFormInputs.alignType || ['left'],
            attrList: attrs,
            structAttrList: this.layoutModel.getConf<Array<{n:string; label:string}>>('StructAttrList')
        };

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

        // -------------------- coll form -------------------

        const collFormArgs = this.layoutModel.getConf<CollFormInputs>('CollFormProps');
        this.collFormStore = new CollFormStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            {
                attrList: attrs,
                cattr: attrs[0].n,
                cfromw: collFormArgs.cfromw,
                ctow: collFormArgs.ctow,
                cminfreq: collFormArgs.cminfreq,
                cminbgr: collFormArgs.cminbgr,
                cbgrfns: collFormArgs.cbgrfns,
                csortfn: collFormArgs.csortfn
            }
        );

        const collFormViews = collFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.collFormStore
        );

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
                initialFreqFormVariant: freqFormInputs.mlxattr ? 'ml' : 'tt'
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

    init() {
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
        ).then(
            () => undefined,
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }
}


export function init(conf:Kontext.Conf):void {
    let page = new FreqPage(new PageModel(conf));
    page.init();
}