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

import {Kontext, TextTypes} from '../types/common';
import {AjaxResponse, FreqResultResponse} from '../types/ajaxResponses';
import {PageModel} from '../app/main';
import {MultiDict, dictToPairs} from '../util';
import {CollFormModel, CollFormProps, CollFormInputs} from '../models/coll/collForm';
import {MLFreqFormModel, TTFreqFormModel, FreqFormInputs, FreqFormProps} from '../models/freqs/freqForms';
import {Freq2DTableModel} from '../models/freqs/ctable';
import {Freq2DFlatViewModel} from '../models/freqs/flatCtable';
import {CTFormProperties, CTFormInputs, Freq2DFormModel} from '../models/freqs/ctFreqForm';
import {QueryReplayModel, IndirectQueryReplayModel} from '../models/query/replay';
import {QuerySaveAsFormModel} from '../models/query/save';
import {fetchQueryFormArgs} from '../models/query/main';
import {init as freqFormFactory} from '../views/freqs/forms';
import {init as collFormFactory} from '../views/coll/forms';
import {init as analysisFrameInit, FormsViews as AnalysisFrameViews} from '../views/analysis';
import {init as queryOverviewInit, OverviewViews as QueryOverviewViews} from '../views/query/overview';
import {init as resultViewFactory} from '../views/freqs/main';
import {init as ctResultViewInit} from '../views/freqs/ctResult';
import {FreqDataRowsModel, ResultBlock} from '../models/freqs/dataRows';
import {FreqResultsSaveModel, FreqCTResultsSaveModel} from '../models/freqs/save';
import {ConfIntervals, DataPoint} from '../charts/confIntervals';
import {TextTypesModel} from '../models/textTypes/attrValues';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/freq.less');

/**
 *
 */
class FreqPage {

    private layoutModel:PageModel;

    private mlFreqModel:MLFreqFormModel;

    private ttFreqModel:TTFreqFormModel;

    private freqResultModel:FreqDataRowsModel;

    private ctFreqModel:Freq2DTableModel;

    private ctFlatFreqModel:Freq2DFlatViewModel;

    private cTFreqFormModel:Freq2DFormModel;

    private ctResultSaveModel:FreqCTResultsSaveModel;

    private collFormModel:CollFormModel;

    private queryReplayModel:IndirectQueryReplayModel;

    private querySaveAsFormModel:QuerySaveAsFormModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private initAnalysisViews(adhocSubcDetector:TextTypes.IAdHocSubcorpusDetector):void {
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

        this.mlFreqModel = new MLFreqFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            freqFormProps,
            this.layoutModel.getConf<number>('multilevelFreqDistMaxLevels')
        );

        this.ttFreqModel = new TTFreqFormModel(
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

        this.cTFreqFormModel = new Freq2DFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps,
            adhocSubcDetector
        );
        this.ctFreqModel = new Freq2DTableModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps,
            adhocSubcDetector
        );
        this.ctFlatFreqModel = new Freq2DFlatViewModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps,
            adhocSubcDetector,
        );
        this.ctResultSaveModel = new FreqCTResultsSaveModel(
            this.layoutModel.dispatcher,
            this.ctFreqModel,
            this.ctFlatFreqModel
        );

        const freqFormViews = freqFormFactory(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.mlFreqModel,
            this.ttFreqModel,
            this.cTFreqFormModel
        );

        // -------------------- coll form -------------------

        const collFormArgs = this.layoutModel.getConf<CollFormInputs>('CollFormProps');
        this.collFormModel = new CollFormModel(
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

        const collFormViews = collFormFactory(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.collFormModel
        );

        const analysisViews = analysisFrameInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            collViews: collFormViews,
            freqViews: freqFormViews,
            mainMenuModel: this.layoutModel.getModels().mainMenuModel
        });

        this.layoutModel.renderReactComponent(
            analysisViews.AnalysisFrame,
            window.document.getElementById('analysis-forms-mount'),
            {
                initialFreqFormVariant: this.layoutModel.getConf<string>('FreqType')
            }
        );
    }

    private initQueryOpNavigation():void {
        this.queryReplayModel = new IndirectQueryReplayModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.layoutModel.getConf<Array<Kontext.QueryOperation>>('queryOverview') || []
        );
        this.querySaveAsFormModel = new QuerySaveAsFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.layoutModel.getConf<string>('concPersistenceOpId')
        );
        const queryOverviewViews = queryOverviewInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            viewDeps: {
                QueryFormView: null,
                FilterFormView: null,
                SubHitsForm: null,
                FirstHitsForm: null,
                SortFormView: null,
                SampleForm: null,
                ShuffleForm: null,
                SwitchMainCorpForm: null
            },
            queryReplayModel: this.queryReplayModel,
            mainMenuModel: this.layoutModel.getModels().mainMenuModel,
            querySaveAsModel: this.querySaveAsFormModel
        });
        this.layoutModel.renderReactComponent(
            queryOverviewViews.NonViewPageQueryToolbar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getConf<string>('corpname'),
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                usesubcorp: this.layoutModel.getConf<string>('subcorpname'),
                queryFormProps: {
                    formType: Kontext.ConcFormTypes.QUERY,
                    actionPrefix: '',
                    allowCorpusSelection: false,
                    tagHelperView: null,
                    queryStorageView: null,
                    liveAttrsView: null,
                    liveAttrsCustomTT: null,
                    attributes: [],
                    onEnterKey:()=>undefined
                },
                filterFormProps: {
                    formType: Kontext.ConcFormTypes.FILTER,
                    actionPrefix: '',
                    filterId: null,
                    tagHelperView: null,
                    queryStorageView: null
                },
                sortFormProps: {
                    formType: Kontext.ConcFormTypes.SORT,
                    sortId: null,
                },
                shuffleFormProps: {
                    formType: Kontext.ConcFormTypes.SHUFFLE,
                    shuffleMinResultWarning: null,
                    lastOpSize: null,
                    operationIdx: null,
                    shuffleSubmitFn:()=>undefined
                }
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
                this.freqResultModel = new FreqDataRowsModel(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    this.layoutModel.getConf<Array<[string, string]>>('FreqCrit'),
                    this.layoutModel.getConf<FreqFormInputs>('FreqFormProps'),
                    (s)=>this.setDownloadLink(s)
                );
                this.freqResultModel.importData(
                    this.layoutModel.getConf<Array<FreqResultResponse.Block>>('FreqResultData'),
                    this.layoutModel.getConf<number>('FreqItemsPerPage'),
                    1
                );
                const freqResultView = resultViewFactory(
                    this.layoutModel.dispatcher,
                    this.layoutModel.getComponentHelpers(),
                    this.freqResultModel
                );
                this.layoutModel.renderReactComponent(
                    freqResultView.FreqResultView,
                    window.document.getElementById('result-mount'),
                    {}
                );
            break;
            case 'ct':
                const data = this.layoutModel.getConf<FreqResultResponse.CTFreqResultData>('CTFreqResultData');
                this.ctFreqModel.importData(data);
                this.ctFlatFreqModel.importData(data);
                this.ctFreqModel.addOnNewDataHandler((newData) =>
                    this.ctFlatFreqModel.importDataAndNotify(newData)
                );
                const ctFreqResultView = ctResultViewInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.getComponentHelpers(),
                    this.ctFreqModel,
                    this.ctFlatFreqModel
                );
                const width = 600;
                const height = 14 * (this.ctFreqModel.getD1Labels().filter(x => x[1]).size +
                    this.ctFreqModel.getD2Labels().filter(x => x[1]).size) / 2;
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

    initAdhocSubcDetector():TextTypes.IAdHocSubcorpusDetector {
        const concFormArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
        const queryFormArgs = fetchQueryFormArgs(concFormArgs);
        const ttModel = new TextTypesModel(
            this.layoutModel.dispatcher,
            this.layoutModel.pluginApi(),
            this.layoutModel.getConf<any>('textTypesData')
        );
        ttModel.applyCheckedItems(queryFormArgs.selected_text_types, {});
        return ttModel;
    }

    private setupBackButtonListening():void {
        this.layoutModel.getHistory().setOnPopState((event) => {
            window.location.reload();
        });
        switch (this.layoutModel.getConf<string>('FreqType')) {
            case 'ct': {
                const args = this.ctFreqModel.getSubmitArgs();
                args.remove('format');
                this.layoutModel.getHistory().replaceState(
                    'freqct',
                    args,
                    window.document.title
                );
            }
            break;
            case 'tt':
            case 'ml': {
                const args = this.freqResultModel.getSubmitArgs();
                args.remove('format');
                this.layoutModel.getHistory().replaceState(
                    'freqs',
                    args,
                    window.document.title
                );
            }
            break;
        }
    }

    init() {
        this.layoutModel.init().then(
            () => {
                const mainMenuModel = this.layoutModel.getModels().mainMenuModel;
                // we must capture concordance-related actions which lead
                // to specific "pop-up" forms and redirect user back to
                // the 'view' action with additional information (encoded in
                // the fragment part of the URL) which form should be opened
                // once the 'view' page is loaded
                mainMenuModel.addChangeListener(() => {
                    const activeItem = mainMenuModel.getActiveItem() || {actionName: null, actionArgs: []};
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
                const adhocSubcIdentifier = this.initAdhocSubcDetector();
                this.initAnalysisViews(adhocSubcIdentifier);
                this.initQueryOpNavigation();
                this.initFreqResult();
                this.setupBackButtonListening();
            }

        ).then(
            this.layoutModel.addUiTestingFlag

        ).catch(
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