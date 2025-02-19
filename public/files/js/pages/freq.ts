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

import * as Kontext from '../types/kontext.js';
import * as TextTypes from '../types/textTypes.js';
import { PageModel, DownloadType } from '../app/page.js';
import { CollFormModel, CollFormInputs } from '../models/coll/collForm.js';
import { MLFreqFormModel, TTFreqFormModel, FreqFormInputs, FreqFormProps }
    from '../models/freqs/regular/freqForms.js';
import { Freq2DTableModel } from '../models/freqs/twoDimension/table2d.js';
import { Freq2DFlatViewModel } from '../models/freqs/twoDimension/flatTable.js';
import { Freq2DFormModel } from '../models/freqs/twoDimension/form.js';
import { QuerySaveAsFormModel } from '../models/query/save.js';
import { fetchQueryFormArgs } from '../models/query/first.js';
import { init as freqFormFactory } from '../views/freqs/forms.js';
import { init as collFormFactory } from '../views/coll/forms.js';
import { init as analysisFrameInit } from '../views/analysis.js';
import { init as queryOverviewInit } from '../views/query/overview/index.js';
import { init as resultViewFactory } from '../views/freqs/regular/index.js';
import { init as ctResultViewInit } from '../views/freqs/twoDimension/table2d/index.js';
import { FreqDataRowsModel, importData as importFreqData } from '../models/freqs/regular/table.js';
import { FreqCTResultsSaveModel } from '../models/freqs/twoDimension/save.js';
import { TextTypesModel } from '../models/textTypes/main.js';
import { KontextPage } from '../app/main.js';
import { IndirectQueryReplayModel } from '../models/query/replay/indirect.js';
import { Dict, List, Maths, pipe, tuple } from 'cnc-tskit';
import { CTFormInputs, CTFormProperties, CTFreqResultData,
    AlignTypes } from '../models/freqs/twoDimension/common.js';
import { Actions } from '../models/freqs/regular/actions.js';
import { Block, FreqResultViews } from '../models/freqs/common.js';
import { ConcFormArgs, QueryFormArgsResponse } from '../models/query/formArgs.js';
import { FreqChartsModel } from '../models/freqs/regular/freqCharts.js';
import { FreqDataLoader } from '../models/freqs/regular/common.js';
import { init as viewFreqCommonInit } from '../views/freqs/common.js';
import { ImageConversionModel } from '../models/common/imgConv.js';
import { DispersionResultModel } from '../models/dispersion/result.js';
import { FreqResultsSaveModel } from '../models/freqs/regular/save.js';
import { FreqChartsSaveFormModel } from '../models/freqs/regular/saveChart.js';
import { importInitialTTData, TTInitialData } from '../models/textTypes/common.js';
import { TabWrapperModel } from '../models/freqs/regular/tabs.js';
import { transferActionToViewPage } from '../app/navigation/interpage.js';
import { QueryProps } from '../models/cqleditor/qprops.js';

/**
 *
 */
class FreqPage {

    private layoutModel:PageModel;

    private mlFreqModel:MLFreqFormModel;

    private ttFreqModel:TTFreqFormModel;

    private freqLoader:FreqDataLoader;

    private freqResultModel:FreqDataRowsModel;

    private freqChartsModel:FreqChartsModel;

    private regularfreqTabSwitchModel:TabWrapperModel;

    private ctFreqModel:Freq2DTableModel;

    private ctFlatFreqModel:Freq2DFlatViewModel;

    private cTFreqFormModel:Freq2DFormModel;

    private dispersionModel:DispersionResultModel;

    private ctResultSaveModel:FreqCTResultsSaveModel;

    private collFormModel:CollFormModel;

    private queryReplayModel:IndirectQueryReplayModel;

    private querySaveAsFormModel:QuerySaveAsFormModel;

    private imgConversionModel:ImageConversionModel;

    private saveTablesModel:FreqResultsSaveModel;

    private saveChartFormModel:FreqChartsSaveFormModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private initAnalysisViews(
        ttSelection:Array<TextTypes.AnyTTSelection>,
        bibIdAttr:string,
        bibLabelAttr:string,
        queryProps:QueryProps
    ):void {
        const attrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList');

        // -------------------- freq form -------------------

        const freqFormInputs = this.layoutModel.getConf<FreqFormInputs>('FreqFormProps');
        const initFreqLevel = this.layoutModel.getConf<number>('InitialFreqLevel');
        const freqFormProps:FreqFormProps = {
            fttattr: freqFormInputs.fttattr || [],
            flimit: freqFormInputs.flimit || '1',
            freq_sort: 'freq',
            mlxattr: freqFormInputs.mlxattr || List.repeat(() => attrs[0].n, initFreqLevel),
            mlxicase: freqFormInputs.mlxicase || List.repeat(() => false, initFreqLevel),
            mlxctx: freqFormInputs.mlxctx || List.repeat(() => '0>0', initFreqLevel),
            alignType: freqFormInputs.alignType ||
                List.repeat(() => AlignTypes.LEFT, initFreqLevel),
            attrList: attrs,
            structAttrList: Kontext.structsAndAttrsToStructAttrList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs'))
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
            structAttrList: Kontext.structsAndAttrsToStructAttrList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs')),
            ctattr1: ctFormInputs.ctattr1,
            ctattr2: ctFormInputs.ctattr2,
            ctfcrit1: ctFormInputs.ctfcrit1,
            ctfcrit2: ctFormInputs.ctfcrit2,
            ctminfreq: ctFormInputs.ctminfreq,
            ctminfreq_type: ctFormInputs.ctminfreq_type,
            usesAdHocSubcorpus: TextTypesModel.findHasSelectedItems(ttSelection),
            selectedTextTypes: TextTypesModel.exportSelections(ttSelection, bibIdAttr, bibLabelAttr, false, true)
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
        this.dispersionModel = new DispersionResultModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            {
                isBusy: false,
                concordanceId: this.layoutModel.getConf<string>('concPersistenceOpId'),
                resolution: Kontext.newFormValue('100', true),
                maxResolution: this.layoutModel.getConf<number>('maxDispersionResolution'),
                data: [],
                downloadFormat: 'png',
            }
        );

        const freqFormViews = freqFormFactory(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.mlFreqModel,
            this.ttFreqModel,
            this.cTFreqFormModel,
            this.dispersionModel
        );

        this.imgConversionModel = new ImageConversionModel(
            this.layoutModel.dispatcher,
            this.layoutModel
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
                initialFreqFormVariant: this.layoutModel.getConf<Kontext.FreqModuleType>('FreqType'),
                concHasAdhocQuery: queryProps.containsAdhocSubcorp()
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
            this.layoutModel.getConf<number>('concUrlTTLDays')
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
                subcName: this.layoutModel.getCorpusIdent().subcName,
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
                cutoff: this.layoutModel.getConcArgs().cutoff
            }
        );
    }

    setDownloadLink(name:string, format:string, url:string, args?:any) {
        this.layoutModel.bgDownload({
            name,
            format,
            datasetType: DownloadType.FREQ,
            url,
            contentType: 'text/plain',
            args,
        }).subscribe();
    }

    private initFreqResult(queryProps:QueryProps):void {
        switch (this.layoutModel.getConf<Kontext.FreqModuleType>('FreqType')) {
            case 'tokens':
            case 'text-types':
                this.freqLoader = new FreqDataLoader({
                    pageModel: this.layoutModel
                });

                const alphaLevelValue = this.layoutModel.getConf<string>('AlphaLevel');
                const alphaLevel = {
                    "0.1": Maths.AlphaLevel.LEVEL_10,
                    "0.05": Maths.AlphaLevel.LEVEL_5,
                    "0.01": Maths.AlphaLevel.LEVEL_1,
                }[alphaLevelValue];
                const forcedParams = this.layoutModel.getConf<{[sourceId:string]:{[key:string]:any}}>('ForcedParams');

                const initialData = List.map(
                    block => importFreqData(
                        this.layoutModel,
                        block,
                        forcedParams[block.fcrit]?.fpage || this.layoutModel.getConf<number>('CurrentPage'),
                        this.layoutModel.getConf<number>('FreqItemsPerPage'),
                        alphaLevel,
                    ),
                    this.layoutModel.getConf<Array<Block>>('FreqResultData'),
                );
                const currentPage = this.layoutModel.getConf<number>('CurrentPage');

                const saveLinkFn = this.setDownloadLink.bind(this);

                const formProps = this.layoutModel.getConf<FreqFormInputs>('FreqFormProps');

                this.freqResultModel = new FreqDataRowsModel({
                    dispatcher: this.layoutModel.dispatcher,
                    pageModel: this.layoutModel,
                    freqType: this.layoutModel.getConf<Kontext.BasicFreqModuleType>('FreqType'),
                    freqCrit: this.layoutModel.getConf<Array<Kontext.AttrItem>>('FreqCrit'),
                    freqCritAsync: this.layoutModel.getConf<Array<Kontext.AttrItem>>('FreqCritAsync'),
                    formProps,
                    initialData,
                    currentPage,
                    freqLoader: this.freqLoader,
                    forcedParams,
                    alphaLevel,
                    concHasAdhocQuery: queryProps.containsAdhocSubcorp()
                });

                this.saveTablesModel = new FreqResultsSaveModel({
                    dispatcher: this.layoutModel.dispatcher,
                    layoutModel: this.layoutModel,
                    saveLinkFn,
                    quickSaveRowLimit: this.layoutModel.getConf<number>('QuickSaveRowLimit'),
                });

                this.regularfreqTabSwitchModel = new TabWrapperModel(
                    this.layoutModel.dispatcher,
                    formProps,
                    alphaLevel,
                    this.layoutModel.getConf<FreqResultViews>('FreqDefaultView')
                );

                const allCrit = List.concat(
                    this.layoutModel.getConf<Array<Kontext.AttrItem>>('FreqCritAsync'),
                    this.layoutModel.getConf<Array<Kontext.AttrItem>>('FreqCrit')
                );
                this.saveChartFormModel = new FreqChartsSaveFormModel(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    {
                        formIsActive: false,
                        formats: pipe(
                            allCrit,
                            List.map(crit => tuple<string, Kontext.ChartExportFormat>(crit.n, 'png')),
                            Dict.fromEntries()
                        ),
                        criteria: allCrit,
                        sourceId: List.head(allCrit).n
                    }
                );

                this.freqChartsModel = new FreqChartsModel({
                    dispatcher: this.layoutModel.dispatcher,
                    pageModel: this.layoutModel,
                    freqType: this.layoutModel.getConf<Kontext.BasicFreqModuleType>('FreqType'),
                    freqCrit: this.layoutModel.getConf<Array<Kontext.AttrItem>>('FreqCrit'),
                    freqCritAsync: this.layoutModel.getConf<Array<Kontext.AttrItem>>('FreqCritAsync'),
                    formProps: this.layoutModel.getConf<FreqFormInputs>('FreqFormProps'),
                    initialData: currentPage === 1 ?
                        initialData :
                        pipe(
                            this.layoutModel.getConf<Array<Kontext.AttrItem>>('FreqCrit'),
                            List.concat(this.layoutModel.getConf<Array<Kontext.AttrItem>>('FreqCritAsync')),
                            List.map(v => ({
                                fcrit: v.n,
                                heading: v.label,
                                TotalPages: 0,
                                isEmpty: true
                            }))
                        ),
                    fpagesize: this.layoutModel.getConf<number>('FreqItemsPerPage'),
                    freqLoader: this.freqLoader,
                    forcedParams,
                    alphaLevel,
                    concHasAdhocQuery: queryProps.containsAdhocSubcorp()
                });
                const freqResultView = resultViewFactory(
                    this.layoutModel.dispatcher,
                    this.layoutModel.getComponentHelpers(),
                    this.freqChartsModel,
                    this.saveChartFormModel,
                    this.freqResultModel,
                    this.saveTablesModel,
                    this.regularfreqTabSwitchModel
                );
                this.layoutModel.renderReactComponent(
                    freqResultView.FreqResultView,
                    window.document.getElementById('result-mount'),
                    {userEmail: this.layoutModel.getConf<string>('userEmail')}
                );
            break;
            case '2-attribute':
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

    initHelp():void {
        const views = viewFreqCommonInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers()
        );
        this.layoutModel.renderReactComponent(
            views.FreqsHelp,
            window.document.getElementById('topbar-help-mount'),
            {
                confIntervalLeftMinWarn: 0 // TODO
            }
        );
    }

    initTTModel(
        ttData:TTInitialData,
        queryFormArgs:QueryFormArgsResponse
    ):[TextTypesModel, Array<TextTypes.AnyTTSelection>] {
        const attributes = importInitialTTData(ttData, {});
        const ttModel = new TextTypesModel({
            dispatcher: this.layoutModel.dispatcher,
            pluginApi: this.layoutModel.pluginApi(),
            attributes,
            readonlyMode: true,
            bibIdAttr: ttData.bib_id_attr,
            bibLabelAttr: ttData.bib_label_attr
        });
        ttModel.applyCheckedItems(queryFormArgs.selected_text_types, {});
        return tuple(ttModel, attributes);
    }

    private setupBackButtonListening():void {
        this.layoutModel.getHistory().setOnPopState(
            (event) => {
                if (event.state['onPopStateAction']) {
                    this.layoutModel.dispatcher.dispatch(event.state['onPopStateAction']);
                }
            }
        );
        switch (this.layoutModel.getConf<Kontext.FreqModuleType>('FreqType')) {
            case '2-attribute': {
                const args = {
                    ...this.ctFreqModel.getSubmitArgs(),
                    format: undefined
                };
                this.layoutModel.getHistory().replaceState(
                    'freqct',
                    args,
                    {} // TODO missing handler action
                );
            }
            break;
            case 'text-types':
            case 'tokens': {
                // if ForceParams defined => sharing freqs, don't alter history
                if (!Dict.empty(this.layoutModel.getConf('ForcedParams'))) {
                    break;
                }

                const [args, state, activeView] = (() => {
                    const currAction = this.layoutModel.getConf<'freqs'|'freqml'>('currentAction');

                    if (this.layoutModel.getConf<FreqResultViews>('FreqDefaultView') === 'tables') {
                        if (currAction === 'freqs') {
                            const state = this.freqResultModel.getState(); // no antipattern here
                            const firstCrit = List.head(state.freqCrit);
                            const args = {
                                ...this.freqResultModel.getSubmitArgs(
                                    state, firstCrit.n, state.flimit, parseInt(state.currentPage[firstCrit.n])),
                                fcrit_async: List.map(v => v.n, state.freqCritAsync),
                                freq_type: state.freqType,
                                format: undefined
                            };
                            return tuple(args, state, 'tables');

                        } else {
                            const state = this.mlFreqModel.getState(); // no antipattern here
                            const args = {
                                ...this.mlFreqModel.getSubmitArgs(state),
                                freq_type: 'freqml',
                                format: undefined
                            };
                            return tuple(args, state, 'tables');
                        }

                    } else {
                        const state = this.freqChartsModel.getState(); // no antipattern here
                        const firstCrit = List.head(state.freqCrit);
                        const args = {
                            ...this.freqChartsModel.getSubmitArgs(state, firstCrit.n, state.flimit),
                            fcrit_async: List.map(v => v.n, state.freqCritAsync),
                            freq_type: state.freqType,
                            format: undefined
                        };
                        return tuple(args, state, 'tables');
                    }
                })();
                this.layoutModel.getHistory().replaceState(
                    this.layoutModel.getConf<string>('currentAction'),
                    args,
                    {
                        onPopStateAction: {
                            name: Actions.PopHistory.name,
                            payload: {
                                activeView,
                                state
                            }
                        }
                    }
                );
                break;
            }
        }
    }

    init() {
        this.layoutModel.init(true, [], () => {
            const mainMenuModel = this.layoutModel.getModels().mainMenuModel;
            // we must capture concordance-related actions which lead
            // to specific "pop-up" forms and redirect user back to
            // the 'view' action with additional information (encoded in
            // the fragment part of the URL) which form should be opened
            // once the 'view' page is loaded
            this.layoutModel.dispatcher.registerActionListener(
                transferActionToViewPage(this.layoutModel)
            );
            const ttData = this.layoutModel.getConf<TTInitialData>('textTypesData');
            const concFormArgs = this.layoutModel.getConf<{[ident:string]:ConcFormArgs}>(
                'ConcFormsArgs'
            );
            const queryFormArgs = fetchQueryFormArgs(concFormArgs);
            const rawQuery = pipe(
                this.layoutModel.getConf<Array<Kontext.QueryOperation>>('queryOverview') || [],
                List.head(),
                x => x.args
            );
            const [,ttSelection] = this.initTTModel(ttData, queryFormArgs);
            const qProps = new QueryProps(rawQuery);
            this.initAnalysisViews(
                ttSelection, ttData.bib_id_attr, ttData.bib_label_attr, qProps);
            this.initQueryOpNavigation();
            this.initHelp();
            this.initFreqResult(qProps);
            this.setupBackButtonListening();
            this.layoutModel.initKeyShortcuts();
        });
    }
}


export function init(conf:Kontext.Conf):void {
    let page = new FreqPage(new KontextPage(conf));
    page.init();
}