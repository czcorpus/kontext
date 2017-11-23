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

/// <reference path="../types/common.d.ts" />
/// <reference path="../types/ajaxResponses.d.ts" />
/// <reference path="../types/views.d.ts" />

import {PageModel} from './document';
import {MultiDict, dictToPairs} from '../util';
import {CollFormStore, CollFormProps, CollFormInputs} from '../stores/coll/collForm';
import {MLFreqFormStore, TTFreqFormStore, FreqFormInputs, FreqFormProps} from '../stores/freqs/freqForms';
import {ContingencyTableStore} from '../stores/freqs/ctable';
import {CTFlatStore} from '../stores/freqs/flatCtable';
import {CTFormProperties, CTFormInputs} from '../stores/freqs/generalCtable';
import {QueryReplayStore, IndirectQueryReplayStore} from '../stores/query/replay';
import {QuerySaveAsFormStore} from '../stores/query/save';
import {init as freqFormInit, FreqFormViews} from 'views/freqs/forms';
import {init as collFormInit, CollFormViews} from 'views/coll/forms';
import {init as analysisFrameInit, AnalysisFrameViews} from 'views/analysis';
import {init as queryOverviewInit, QueryToolbarViews} from 'views/query/overview';
import {init as resultViewInit, FreqsResultViews} from 'views/freqs/main';
import {init as ctResultViewInit, CTFreqsResultViews} from 'views/freqs/ctResult';
import {FreqDataRowsStore, ResultBlock} from '../stores/freqs/dataRows';
import {FreqResultsSaveStore, FreqCTResultsSaveStore} from '../stores/freqs/save';
import {ConfIntervals, DataPoint} from '../charts/confIntervals';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/freq.less');

/**
 *
 */
class FreqPage {

    private layoutModel:PageModel;

    private mlFreqStore:MLFreqFormStore;

    private ttFreqStore:TTFreqFormStore;

    private ctFreqStore:ContingencyTableStore;

    private ctFlatFreqStore:CTFlatStore;

    private ctResultSaveStore:FreqCTResultsSaveStore;

    private collFormStore:CollFormStore;

    private queryReplayStore:IndirectQueryReplayStore;

    private querySaveAsFormStore:QuerySaveAsFormStore;

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
            freq_sort: 'freq',
            mlxattr: freqFormInputs.mlxattr || [attrs[0].n],
            mlxicase: freqFormInputs.mlxicase || [false],
            mlxctx: freqFormInputs.mlxctx || ['0>0'],
            alignType: freqFormInputs.alignType || ['left'],
            attrList: attrs,
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList')
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

        this.ctFreqStore = new ContingencyTableStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps
        );
        this.ctFlatFreqStore = new CTFlatStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps
        );

        this.ctResultSaveStore = new FreqCTResultsSaveStore(
            this.layoutModel.dispatcher,
            this.ctFreqStore,
            this.ctFlatFreqStore
        );

        const freqFormViews = freqFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.layoutModel.layoutViews,
            this.mlFreqStore,
            this.ttFreqStore,
            this.ctFreqStore,
            this.ctFlatFreqStore
        );

        // -------------------- coll form -------------------

        const collFormArgs = this.layoutModel.getConf<CollFormInputs>('CollFormProps');
        this.collFormStore = new CollFormStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            {
                attrList: attrs,
                cattr: collFormArgs.cattr || attrs[0].n,
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
            this.layoutModel.getComponentHelpers(),
            this.layoutModel.layoutViews,
            this.collFormStore
        );

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
                initialFreqFormVariant: this.layoutModel.getConf<string>('FreqType')
            }
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
                usesubcorp: this.layoutModel.getConf<string>('subcorpname'),
                queryFormProps: {},
                filterFormProps: {},
                sortFormProps: {},
                shuffleFormProps: {}
            }
        );
    }

    private setDownloadLink(url:string):void {
        const iframe = <HTMLIFrameElement>document.getElementById('download-frame');
        iframe.src = url;
    }

    private initFreqResult():void {
        switch (this.layoutModel.getConf<string>('FreqType')) {
            case 'ml':
            case 'tt':
                const freqResultStore = new FreqDataRowsStore(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    this.layoutModel.getConf<Array<[string, string]>>('FreqCrit'),
                    this.layoutModel.getConf<FreqFormInputs>('FreqFormProps'),
                    (s)=>this.setDownloadLink(s)
                );
                freqResultStore.importData(
                    this.layoutModel.getConf<Array<FreqResultResponse.Block>>('FreqResultData'),
                    this.layoutModel.getConf<number>('FreqItemsPerPage'),
                    1
                );
                const freqResultView = resultViewInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.getComponentHelpers(),
                    freqResultStore,
                    this.layoutModel.layoutViews
                );
                this.layoutModel.renderReactComponent(
                    freqResultView.FreqResultView,
                    window.document.getElementById('result-mount'),
                    {}
                );
            break;
            case 'ct':
                const data = this.layoutModel.getConf<FreqResultResponse.CTFreqResultData>('CTFreqResultData');
                this.ctFreqStore.importData(data);
                this.ctFlatFreqStore.importData(data);
                this.ctFreqStore.addOnNewDataHandler((newData) =>
                    this.ctFlatFreqStore.importDataAndNotify(newData)
                );
                const ctFreqResultView = ctResultViewInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.getComponentHelpers(),
                    this.ctFreqStore,
                    this.ctFlatFreqStore
                );
                const width = 600;
                const height = 14 * (this.ctFreqStore.getD1Labels().filter(x => x[1]).size +
                    this.ctFreqStore.getD2Labels().filter(x => x[1]).size) / 2;
                this.layoutModel.renderReactComponent(
                    ctFreqResultView.CTFreqResultView,
                    window.document.getElementById('result-mount'),
                    {
                        onConfIntervalFrameReady: (data:Array<DataPoint>, heading:string) => {
                            const charts = new ConfIntervals(
                                this.layoutModel,
                                width,
                                height,
                                document.getElementById('confidence-intervals-frame')
                            );
                            charts.renderChart(data, heading);
                        },
                        d3PaneWidth: width,
                        d3PaneHeight: height
                    }
                );
            break;
        }
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
                this.initAnalysisViews();
                this.initQueryOpNavigation();
                this.initFreqResult();
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