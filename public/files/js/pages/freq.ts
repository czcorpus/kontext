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

import { Kontext, TextTypes } from '../types/common';
import { AjaxResponse, FreqResultResponse } from '../types/ajaxResponses';
import { PageModel, DownloadType } from '../app/page';
import { MultiDict } from '../multidict';
import { CollFormModel, CollFormInputs } from '../models/coll/collForm';
import { MLFreqFormModel, TTFreqFormModel, FreqFormInputs, FreqFormProps }
    from '../models/freqs/freqForms';
import { Freq2DTableModel } from '../models/freqs/twoDimension/table2d';
import { Freq2DFlatViewModel } from '../models/freqs/twoDimension/flatTable';
import { Freq2DFormModel } from '../models/freqs/twoDimension/form';
import { QuerySaveAsFormModel } from '../models/query/save';
import { fetchQueryFormArgs } from '../models/query/first';
import { init as freqFormFactory } from '../views/freqs/forms';
import { init as collFormFactory } from '../views/coll/forms';
import { init as analysisFrameInit } from '../views/analysis';
import { init as queryOverviewInit } from '../views/query/overview';
import { init as resultViewFactory } from '../views/freqs/main';
import { init as ctResultViewInit } from '../views/freqs/twoDimension/table2d';
import { FreqDataRowsModel, importData as importFreqData,
    FreqDataRowsModelState } from '../models/freqs/dataRows';
import { FreqCTResultsSaveModel } from '../models/freqs/save';
import { TextTypesModel } from '../models/textTypes/main';
import { NonQueryCorpusSelectionModel } from '../models/corpsel';
import { KontextPage } from '../app/main';
import { IndirectQueryReplayModel } from '../models/query/replay/indirect';
import { List, Dict } from 'cnc-tskit';
import { CTFormInputs, CTFormProperties, CTFreqResultData,
    AlignTypes } from '../models/freqs/twoDimension/common';
import { Actions as MainMenuActions } from '../models/mainMenu/actions';
import { Actions } from '../models/freqs/actions';


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
        const initFreqLevel = this.layoutModel.getConf<number>('InitialFreqLevel');
        const freqFormProps:FreqFormProps = {
            fttattr: freqFormInputs.fttattr || [],
            ftt_include_empty: freqFormInputs.ftt_include_empty || false,
            flimit: freqFormInputs.flimit || '1',
            freq_sort: 'freq',
            mlxattr: freqFormInputs.mlxattr || List.repeat(() => attrs[0].n, initFreqLevel),
            mlxicase: freqFormInputs.mlxicase || List.repeat(() => false, initFreqLevel),
            mlxctx: freqFormInputs.mlxctx || List.repeat(() => '0>0', initFreqLevel),
            alignType: freqFormInputs.alignType ||
                List.repeat(() => AlignTypes.LEFT, initFreqLevel),
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
            ctminfreq: ctFormInputs.ctminfreq,
            ctminfreq_type: ctFormInputs.ctminfreq_type,
            usesAdHocSubcorpus: adhocSubcDetector.usesAdHocSubcorpus(),
            selectedTextTypes: adhocSubcDetector.UNSAFE_exportSelections(false)
        };

        this.cTFreqFormModel = new Freq2DFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps
        );
        this.ctFreqModel = new Freq2DTableModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps
        );
        this.ctFlatFreqModel = new Freq2DFlatViewModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps
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
            this.layoutModel.getConf<string>('concPersistenceOpId'),
            this.layoutModel.getConf<number>('concUrlTTLDays'),
            this.layoutModel.getConf<boolean>('concExplicitPersistenceUI')
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
                corpname: this.layoutModel.getCorpusIdent().id,
                humanCorpname: this.layoutModel.getCorpusIdent().name,
                usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                origSubcorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
                foreignSubcorp: this.layoutModel.getCorpusIdent().foreignSubcorp,
                queryFormProps: {
                    formType: Kontext.ConcFormTypes.QUERY,
                    allowCorpusSelection: false,
                    tagHelperViews: {},
                    LiveAttrsView: null,
                    LiveAttrsCustomTT: null
                },
                filterFormProps: {
                    formType: Kontext.ConcFormTypes.FILTER,
                    filterId: null,
                    corpname: this.layoutModel.getCorpusIdent().id,
                    tagHelperView: null
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

    setDownloadLink(filename:string, url:string) {
        this.layoutModel.bgDownload({
            filename,
            type: DownloadType.FREQ,
            url,
            contentType: 'multipart/form-data'
        });
    }

    private initFreqResult():void {
        switch (this.layoutModel.getConf<string>('FreqType')) {
            case 'ml':
            case 'tt':
                this.freqResultModel = new FreqDataRowsModel({
                    dispatcher: this.layoutModel.dispatcher,
                    pageModel: this.layoutModel,
                    freqCrit: this.layoutModel.getConf<Array<[string, string]>>('FreqCrit'),
                    formProps: this.layoutModel.getConf<FreqFormInputs>('FreqFormProps'),
                    saveLinkFn: this.setDownloadLink.bind(this),
                    quickSaveRowLimit: this.layoutModel.getConf<number>('QuickSaveRowLimit'),
                    initialData: importFreqData(
                        this.layoutModel,
                        this.layoutModel.getConf<Array<FreqResultResponse.Block>>('FreqResultData'),
                        this.layoutModel.getConf<number>('FreqItemsPerPage'),
                        1
                    ),
                    currentPage: this.layoutModel.getConf<number>('CurrentPage')
                });
                const freqResultView = resultViewFactory(
                    this.layoutModel.dispatcher,
                    this.layoutModel.getComponentHelpers(),
                    this.freqResultModel
                );
                this.layoutModel.renderReactComponent(
                    freqResultView.FreqResultView,
                    window.document.getElementById('result-mount'),
                    {} as FreqDataRowsModelState
                );
            break;
            case 'ct':
                const data = this.layoutModel.getConf<CTFreqResultData>(
                    'CTFreqResultData'
                );
                this.ctFreqModel.initialImportData(data);
                this.ctFlatFreqModel.initialImportData(data);
                const ctFreqResultView = ctResultViewInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.getComponentHelpers(),
                    this.ctFreqModel,
                    this.ctFlatFreqModel
                );
                const [width, height, onFrameReady] = this.ctFreqModel.getOnTableFrameReady();
                this.layoutModel.renderReactComponent(
                    ctFreqResultView.CTFreqResultView,
                    window.document.getElementById('result-mount'),
                    {
                        onConfIntervalFrameReady: onFrameReady,
                        d3PaneWidth: width,
                        d3PaneHeight: height
                    }
                );
            break;
        }
    }

    initAdhocSubcDetector():TextTypes.IAdHocSubcorpusDetector {
        const concFormArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>(
            'ConcFormsArgs'
        );
        const queryFormArgs = fetchQueryFormArgs(concFormArgs);
        const ttModel = new TextTypesModel(
            this.layoutModel.dispatcher,
            this.layoutModel.pluginApi(),
            this.layoutModel.getConf<any>('textTypesData'),
            true
        );
        ttModel.applyCheckedItems(queryFormArgs.selected_text_types, {});
        return ttModel;
    }

    private setupBackButtonListening():void {
        this.layoutModel.getHistory().setOnPopState((event) => {
            if (event.state['onPopStateAction']) {
                this.layoutModel.dispatcher.dispatch(event.state['onPopStateAction']);
            }
        });

        switch (this.layoutModel.getConf<string>('FreqType')) {
            case 'ct': {
                const args = this.ctFreqModel.getSubmitArgs();
                args.remove('format');
                this.layoutModel.getHistory().replaceState(
                    'freqct',
                    args,
                    {} // TODO missing handler action
                );
            }
            break;
            case 'tt':
            case 'ml': {
                const state = this.freqResultModel.getState(); // no antipattern here
                const args = this.freqResultModel.getSubmitArgs(state);
                args.remove('format');
                this.layoutModel.getHistory().replaceState(
                    'freqs',
                    args,
                    {
                        onPopStateAction: {
                            name: Actions.PopHistory.name,
                            payload: {
                                currentPage: state.currentPage,
                                flimit: state.flimit,
                                sortColumn: state.sortColumn
                            }
                        }
                    }
                );
            }
            break;
        }
    }

    init() {
        this.layoutModel.init(true, [], () => {
            const subcorpSel = new NonQueryCorpusSelectionModel({
                layoutModel: this.layoutModel,
                dispatcher: this.layoutModel.dispatcher,
                usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                origSubcorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
                foreignSubcorp: this.layoutModel.getCorpusIdent().foreignSubcorp,
                corpora: [this.layoutModel.getCorpusIdent().id],
                availSubcorpora: []
            });
            const mainMenuModel = this.layoutModel.getModels().mainMenuModel;
            // we must capture concordance-related actions which lead
            // to specific "pop-up" forms and redirect user back to
            // the 'view' action with additional information (encoded in
            // the fragment part of the URL) which form should be opened
            // once the 'view' page is loaded
            this.layoutModel.dispatcher.registerActionListener(
                (action) => {
                    switch (action.name) {
                        case MainMenuActions.ShowFilter.name:
                            const filterArgs = new MultiDict(Dict.toEntries(action.payload));
                            window.location.replace(
                                this.layoutModel.createActionUrl(
                                    'view',
                                    this.layoutModel.exportConcArgs().items()
                                ) + '#filter/' + this.layoutModel.encodeURLParameters(filterArgs)
                            );
                        break;
                        case MainMenuActions.ShowSort.name:
                            window.location.replace(this.layoutModel.createActionUrl(
                                'view',
                                this.layoutModel.exportConcArgs().items()
                            ) + '#sort');
                        break;
                        case MainMenuActions.ShowSample.name:
                            window.location.replace(this.layoutModel.createActionUrl(
                                'view',
                                this.layoutModel.exportConcArgs().items()
                            ) + '#sample');
                        break;
                        case MainMenuActions.ApplyShuffle.name:
                            window.location.replace(this.layoutModel.createActionUrl(
                                'view',
                                this.layoutModel.exportConcArgs().items()
                            ) + '#shuffle');
                        break;
                    }
                }
            );
            const adhocSubcIdentifier = this.initAdhocSubcDetector();
            this.initAnalysisViews(adhocSubcIdentifier);
            this.initQueryOpNavigation();
            this.initFreqResult();
            this.setupBackButtonListening();
            this.layoutModel.initKeyShortcuts();
        });
    }
}


export function init(conf:Kontext.Conf):void {
    let page = new FreqPage(new KontextPage(conf));
    page.init();
}