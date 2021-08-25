/*
 * Copyright (c) 2013 Charles University, Faculty of Arts,
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

/// <reference path="../vendor.d.ts/soundmanager.d.ts" />

import { Action } from 'kombo';
import { List, tuple, Dict, pipe } from 'cnc-tskit';

import { KontextPage } from '../app/main';
import * as ViewOptions from '../types/viewOptions';
import * as Kontext from '../types/kontext';
import { PageModel, DownloadType } from '../app/page';
import * as PluginInterfaces from '../types/plugins';
import { parseUrlArgs } from '../app/navigation';
import { init as concViewsInit, ViewPageModels, MainViews as ConcViews }
    from '../views/concordance/main';
import { LineSelectionModel, LineSelectionModelState } from '../models/concordance/lineSelection';
import { ConcDetailModel } from '../models/concordance/detail';
import { ConcordanceModel } from '../models/concordance/main';
import { QueryFormProperties, FirstQueryFormModel, fetchQueryFormArgs }
    from '../models/query/first';
import { UsageTipsModel } from '../models/usageTips';
import { QueryReplayModel, LocalQueryFormData } from '../models/query/replay';
import { Actions as QueryActions } from '../models/query/actions';
import { FilterFormModel, FilterFormProperties, fetchFilterFormArgs } from '../models/query/filter';
import { ConcSampleModel, SampleFormProperties, fetchSampleFormArgs } from '../models/query/sample';
import { SwitchMainCorpModel, SwitchMainCorpFormProperties, fetchSwitchMainCorpFormArgs }
    from '../models/query/switchmc';
import { QuerySaveAsFormModel } from '../models/query/save';
import { TextTypesModel } from '../models/textTypes/main';
import { WithinBuilderModel } from '../models/query/withinBuilder';
import { VirtualKeyboardModel } from '../models/query/virtualKeyboard';
import { QueryContextModel } from '../models/query/context';
import { CollFormModel, CollFormInputs } from '../models/coll/collForm';
import { MLFreqFormModel, TTFreqFormModel, FreqFormInputs, FreqFormProps }
    from '../models/freqs/freqForms';
import { FirstHitsModel } from '../models/query/firstHits';
import { Freq2DFormModel } from '../models/freqs/twoDimension/form';
import { ConcSaveModel } from '../models/concordance/save';
import { ConcDashboard } from '../models/concordance/dashboard';
import { TextTypesDistModel } from '../models/concordance/ttdist/model';
import { TTCrit } from '../models/concordance/ttdist/common';
import { DummySyntaxViewModel } from '../models/concordance/syntax';
import { init as queryFormInit, MainViews as QueryMainViews } from '../views/query/first';
import { init as filterFormInit, FilterFormViews } from '../views/query/filter';
import { init as queryOverviewInit, OverviewViews as QueryOverviewViews }
    from '../views/query/overview';
import { init as sortFormInit, SortViews } from '../views/query/sort';
import { init as sampleFormInit, SampleFormViews } from '../views/query/miscActions';
import { init as analysisFrameInit, FormsViews as AnalysisFrameViews } from '../views/analysis';
import { init as collFormInit, FormsViews as CollFormsViews } from '../views/coll/forms';
import { init as freqFormInit, FormsViews as FreqFormViews } from '../views/freqs/forms';
import { LineSelGroupsRatiosChart } from '../charts/lineSelection';
import { ViewConfiguration, ConcSummary, ServerPagination, ServerLineData, WideCtxArgs }
    from '../models/concordance/common';
import { RefsDetailModel } from '../models/concordance/refsDetail';
import { openStorage, ConcLinesStorage } from '../models/concordance/selectionStorage';
import { Actions } from '../models/concordance/actions';
import { CTFormInputs, CTFormProperties, AlignTypes } from '../models/freqs/twoDimension/common';
import { Actions as MainMenuActions } from '../models/mainMenu/actions';
import { ConcSortModel } from '../models/query/sort/single';
import { importMultiLevelArg, SortFormProperties, fetchSortFormArgs }
    from '../models/query/sort/common';
import { MultiLevelConcSortModel } from '../models/query/sort/multi';
import { PluginName } from '../app/plugin';
import tagHelperPlugin from 'plugins/taghelper/init';
import syntaxViewerInit from 'plugins/syntaxViewer/init';
import tokenConnectInit from 'plugins/tokenConnect/init';
import kwicConnectInit from 'plugins/kwicConnect/init';
import { TTInitialData } from '../models/textTypes/common';
import { QueryType } from '../models/query/query';
import { HitReloader } from '../models/concordance/concStatus';
import { QueryHelpModel } from '../models/help/queryHelp';
import { ConcSummaryModel } from '../models/concordance/summary';
import * as formArgs from '../models/query/formArgs';


export class QueryModels {
    queryModel:FirstQueryFormModel;
    filterModel:FilterFormModel;
    textTypesModel:TextTypesModel;
    queryHintModel:UsageTipsModel;
    withinBuilderModel:WithinBuilderModel;
    virtualKeyboardModel:VirtualKeyboardModel;
    queryContextModel:QueryContextModel;
    queryReplayModel:QueryReplayModel;
    sortModel:ConcSortModel;
    multiLevelConcSortModel:MultiLevelConcSortModel;
    sampleModel:ConcSampleModel;
    switchMcModel:SwitchMainCorpModel;
    saveAsFormModel:QuerySaveAsFormModel;
    firstHitsModel:FirstHitsModel;
    queryHelpModel:QueryHelpModel;
}

interface RenderLinesDeps {
    ttModel:TextTypesModel;
    lvprops:ViewConfiguration;
    tagh:PluginInterfaces.TagHelper.IPlugin;
}



/**
 * This is the concordance viewing and operating model with
 * all attached subsequent form components (filters, sorting,...)
 * and manual line selection functionality.
 */
export class ViewPage {

    private layoutModel:PageModel;

    private viewModels:ViewPageModels;

    private queryModels:QueryModels;

    private concViews:ConcViews;

    private analysisViews:AnalysisFrameViews;

    private lineGroupsChart:LineSelGroupsRatiosChart; // TODO

    private queryFormViews:QueryMainViews;

    private queryOverviewViews:QueryOverviewViews;

    private filterFormViews:FilterFormViews;

    private sortFormViews:SortViews;

    private miscQueryOpsViews:SampleFormViews;

    private concFormsInitialArgs:formArgs.ConcFormsInitialArgs;

    private collFormModel:CollFormModel;

    private collFormViews:CollFormsViews;

    private mlFreqModel:MLFreqFormModel;

    private ttFreqModel:TTFreqFormModel;

    private ctFreqFormModel:Freq2DFormModel;

    private freqFormViews:FreqFormViews;

    private readonly hitReloader:HitReloader;

    /**
     *
     * @param layoutModel
     * @param hasLockedGroups
     */
    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
        this.queryModels = new QueryModels();
        this.concFormsInitialArgs = this.layoutModel.getConf<formArgs.ConcFormsInitialArgs>(
            'ConcFormsInitialArgs');
        this.lineGroupsChart = new LineSelGroupsRatiosChart(
            this.layoutModel,
            this.layoutModel.getConf<Array<string>>('ChartExportFormats')
        );
        this.hitReloader = new HitReloader(this.layoutModel);
    }

    private deserializeHashAction(v:string):Action {
        const [action, rawArgs] = (v || '').substr(1).split('/');
        return this.createFormAction(action, parseUrlArgs(rawArgs || ''));
    }

    private createFormAction(actionName:string, args:{}):Action {
        switch (actionName) {
            case 'filter':
                return {
                    name: MainMenuActions.ShowFilter.name,
                    payload: args
                };
            case 'sort':
            case 'sortx':
                return {
                    name: MainMenuActions.ShowSort.name,
                    payload: args
                };
            case 'sample':
                return {
                    name: MainMenuActions.ShowSample.name,
                    payload: args
                };
            case 'shuffle':
                return {
                    name: MainMenuActions.ApplyShuffle.name,
                    payload: args
                };
            case 'edit_op':
                return {
                    name: QueryActions.EditQueryOperation.name,
                    payload: {operationIdx: Number(args['operationIdx'])} // TODO untyped property
                };
            default:
                return null;
        }
    }

    /**
     *
     */
    private setupHistoryOnPopState():void {
        // register event to load lines via ajax in case user hits back
        this.layoutModel.getHistory().setOnPopState((event) => {
            if (event.state) {
                if (event.state['onPopStateAction']) {
                    this.layoutModel.dispatcher.dispatch(event.state['onPopStateAction']);
                }
            }
        });
    }

    renderLines(
        renderDeps:RenderLinesDeps,
        kwicConnectView:PluginInterfaces.KwicConnect.WidgetWiew
    ):void {
        this.layoutModel.renderReactComponent(
            this.concViews.ConcordanceDashboard,
            window.document.getElementById('conc-dashboard-mount'),
            {
                concViewProps: renderDeps.lvprops,
                kwicConnectView
            }
        );
    }

    reloadHits():void {
        this.hitReloader.init();
    }

    /**
     * Ensures that view's URL is always reusable via concordance ID
     */
    private updateHistory():void {
        if (window.location.hash) {
            const hashedAction = this.deserializeHashAction(window.location.hash);
            if (hashedAction) {
                this.layoutModel.dispatcher.dispatch(hashedAction);
                return;
            }
        }
        const currAction = this.layoutModel.getConf<string>('currentAction');
        switch (currAction) {
            case 'quick_filter':
            case 'create_view': {
                this.layoutModel.getHistory().replaceState(
                    'view',
                    this.layoutModel.getConcArgs(),
                    {
                        onPopStateAction: {
                            name: QueryActions.EditLastQueryOperation.name,
                            payload: {
                                sourceId: this.layoutModel.getConcArgs().q
                            }
                        }
                    },
                    window.document.title
                );
            }
            break;
            case 'view': {
                this.layoutModel.getHistory().replaceState(
                    'view',
                    this.layoutModel.getConcArgs(),
                    {
                        onPopStateAction: {
                            name: Actions.ReloadConc.name,
                            payload: {
                                concId: this.layoutModel.getConf<string>('concPersistenceOpId'),
                                isPopState: true
                            }
                        }
                    },
                    window.document.title
                );
            }
            break;
        }
    }

    private getActiveCorpora():Array<string> {
        return [this.layoutModel.getCorpusIdent().id].concat(
                this.layoutModel.getConf<Array<string>>('alignedCorpora') || []);
    }

    /**
     *
     */
    private initQueryForm(queryFormArgs:formArgs.QueryFormArgsResponse):void {
        this.queryModels.queryHintModel = new UsageTipsModel(
            this.layoutModel.dispatcher,
            this.layoutModel.translate.bind(this.layoutModel)
        );
        this.queryModels.withinBuilderModel = new WithinBuilderModel(
            this.layoutModel.dispatcher,
            this.layoutModel
        );
        this.queryModels.virtualKeyboardModel = new VirtualKeyboardModel(
            this.layoutModel.dispatcher,
            this.layoutModel
        );
        this.queryModels.queryContextModel = new QueryContextModel(
            this.layoutModel.dispatcher,
            queryFormArgs
        );
        this.queryModels.saveAsFormModel = new QuerySaveAsFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.layoutModel.getConf<string>('concPersistenceOpId'),
            this.layoutModel.getConf<number>('concUrlTTLDays'),
            this.layoutModel.getConf<boolean>('concExplicitPersistenceUI')
        );
        this.queryModels.queryHelpModel = new QueryHelpModel(
            this.layoutModel,
            this.layoutModel.dispatcher,
            {
                isBusy: false,
                rawHtml: '',
                tagsets: queryFormArgs.tagsets,
                activeCorpora: [
                    this.layoutModel.getCorpusIdent().id,
                    ...this.layoutModel.getConf<Array<string>>('alignedCorpora')
                ]
            }
        );

        const queryFormProps:QueryFormProperties = {
            corpora: this.getActiveCorpora(),
            availableAlignedCorpora: this.layoutModel.getConf<Array<Kontext.AttrItem>>(
                'availableAlignedCorpora'
            ),
            currQueryTypes: queryFormArgs.curr_query_types,
            currQueries: queryFormArgs.curr_queries,
            currParsedQueries: queryFormArgs.curr_parsed_queries,
            currPcqPosNegValues: queryFormArgs.curr_pcq_pos_neg_values,
            currIncludeEmptyValues: queryFormArgs.curr_include_empty_values,
            currLposValues: queryFormArgs.curr_lpos_values,
            currQmcaseValues: queryFormArgs.curr_qmcase_values,
            currDefaultAttrValues: queryFormArgs.curr_default_attr_values,
            currUseRegexpValues: queryFormArgs.curr_use_regexp_values,
            subcorpList: this.layoutModel.getConf<Array<Kontext.SubcorpListItem>>('SubcorpList'),
            currentSubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
            origSubcorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
            isForeignSubcorpus: this.layoutModel.getCorpusIdent().foreignSubcorp,
            shuffleConcByDefault: this.layoutModel.getConf<boolean>('ShuffleConcByDefault'),
            forcedAttr: this.layoutModel.getConf<string>('ForcedAttr'),
            attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
            structList: this.layoutModel.getConf<Array<string>>('StructList'),
            hasLemma: queryFormArgs.has_lemma,
            tagsets: queryFormArgs.tagsets,
            wPoSList: this.layoutModel.getConf<Array<{v:string; n:string}>>('Wposlist'),
            inputLanguages: this.layoutModel.getConf<{[corpname:string]:string}>('InputLanguages'),
            textTypesNotes: this.layoutModel.getConf<string>('TextTypesNotes'),
            selectedTextTypes: queryFormArgs.selected_text_types,
            useRichQueryEditor:this.layoutModel.getConf<boolean>('UseRichQueryEditor'),
            isAnonymousUser: this.layoutModel.getConf<boolean>('anonymousUser'),
            isLocalUiLang: this.layoutModel.getConf<boolean>('isLocalUiLang'),
            suggestionsEnabled: this.layoutModel.getConf<boolean>('QSEnabled'),
            simpleQueryDefaultAttrs: pipe(
                this.getActiveCorpora(),
                List.map(corpus => tuple(
                    corpus,
                    pipe(
                        this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                        List.map(v => v.n),
                        this.layoutModel.getConf<Array<string>>('SimpleQueryDefaultAttrs').length > 0 ?
                            List.unshift<string|Array<string>>(this.layoutModel.getConf<Array<string>>('SimpleQueryDefaultAttrs')) :
                            v => v
                    )
                )),
                Dict.fromEntries()
            )
        };

        this.queryModels.queryModel = new FirstQueryFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.queryModels.textTypesModel,
            this.queryModels.queryContextModel,
            this.layoutModel.qsuggPlugin,
            queryFormProps
        );

        this.queryFormViews = queryFormInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            CorparchWidget: null, // no corpus selection widget here
            queryModel: this.queryModels.queryModel,
            textTypesModel: this.queryModels.textTypesModel,
            queryHintModel: this.queryModels.queryHintModel,
            withinBuilderModel: this.queryModels.withinBuilderModel,
            virtualKeyboardModel: this.queryModels.virtualKeyboardModel,
            queryContextModel: this.queryModels.queryContextModel,
            querySuggest: this.layoutModel.qsuggPlugin,
            queryHelpModel: this.queryModels.queryHelpModel,
            searchHistoryModel: this.layoutModel.getModels().searchHistoryModel
        });
    }

    private initFilterForm(
        querySuggest:PluginInterfaces.QuerySuggest.IPlugin,
        firstHitsModel:FirstHitsModel
    ):void {

        const concFormsArgs = this.layoutModel.getConf<{[ident:string]:formArgs.ConcFormArgs}>(
            'ConcFormsArgs'
        );
        const fetchArgs = <T extends formArgs.FilterFormArgs[
                keyof formArgs.FilterFormArgs]>
                (key:(item:formArgs.FilterFormArgs)=>T) =>
            fetchFilterFormArgs(concFormsArgs, this.concFormsInitialArgs.filter, key);

        const filterFormProps:FilterFormProperties = {
            filters: pipe(
                concFormsArgs,
                Dict.values(),
                List.filter(v => v.form_type === Kontext.ConcFormTypes.FILTER),
                List.map(v => v.op_key)
            ),
            maincorps: fetchArgs(item => item.maincorp),
            currPnFilterValues: fetchArgs<'p'|'n'>(item => item.pnfilter),
            currQueryTypes: fetchArgs<QueryType>(item => item.query_type),
            currQueries: fetchArgs<string>(item => item.query),
            currQmcaseValues: fetchArgs<boolean>(item => item.qmcase),
            currDefaultAttrValues: fetchArgs<string>(item => item.default_attr),
            currUseRegexpValues: fetchArgs<boolean>(item => item.use_regexp),
            currLposValues: fetchArgs<string>(item => item.lpos),
            currFilflVlaues: fetchArgs<'f'|'l'>(item => item.filfl),
            currFilfposValues: fetchArgs<string>(item => item.filfpos),
            currFiltposValues: fetchArgs<string>(item => item.filtpos),
            currInclkwicValues: fetchArgs<boolean>(item => item.inclkwic),
            tagsets: this.concFormsInitialArgs.filter.tagsets,
            withinArgValues: fetchArgs<boolean>(item => !!item.within),
            forcedAttr: this.layoutModel.getConf<string>('ForcedAttr'),
            attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
            structList: this.layoutModel.getConf<Array<string>>('StructList'),
            hasLemma: fetchArgs<boolean>(item => item.has_lemma),
            wPoSList: this.layoutModel.getConf<Array<{v:string; n:string}>>('Wposlist'),
            inputLanguage: this.layoutModel.getConf<{[corpname:string]:string}>(
                'InputLanguages'
            )[this.layoutModel.getCorpusIdent().id],
            opLocks: fetchArgs<boolean>(item => item.form_type === 'locked'),
            useRichQueryEditor: this.layoutModel.getConf<boolean>('UseRichQueryEditor'),
            isAnonymousUser: this.layoutModel.getConf<boolean>('anonymousUser'),
            isLocalUiLang: this.layoutModel.getConf<boolean>('isLocalUiLang'),
            suggestionsEnabled: this.layoutModel.getConf<boolean>('QSEnabled'),
            simpleQueryDefaultAttrs: {
                '__new__': pipe(
                    this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                    List.map(v => v.n),
                    this.layoutModel.getConf<Array<string>>('SimpleQueryDefaultAttrs').length > 0 ?
                        List.unshift<string|Array<string>>(this.layoutModel.getConf<Array<string>>('SimpleQueryDefaultAttrs')) :
                        v => v
                )
            }
        };

        this.queryModels.filterModel = new FilterFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.queryModels.textTypesModel,
            this.queryModels.queryContextModel,
            querySuggest,
            filterFormProps,
            this.concFormsInitialArgs.filter
        );

        this.filterFormViews = filterFormInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            filterModel: this.queryModels.filterModel,
            queryHintModel: this.queryModels.queryHintModel,
            withinBuilderModel: this.queryModels.withinBuilderModel,
            virtualKeyboardModel: this.queryModels.virtualKeyboardModel,
            firstHitsModel,
            querySuggest,
            searchHistoryModel: this.layoutModel.getModels().searchHistoryModel
        });
    }

    private initSortForm():void {
        const concFormsArgs = this.layoutModel.getConf<{[ident:string]:formArgs.ConcFormArgs}>(
            'ConcFormsArgs'
        );
        const fetchArgs = <T extends formArgs.SortFormArgs[keyof formArgs.SortFormArgs]>(
            key:(item:formArgs.SortFormArgs)=>T
        ):Array<[string, T]> => List.map(
            ([k, v]) => tuple(k, v[0]),
            fetchSortFormArgs(concFormsArgs, this.concFormsInitialArgs.sort, key)
        );

        const fetchMLArgs = <T extends formArgs.SortFormArgs[keyof formArgs.SortFormArgs]>(
            key:(item:formArgs.SortFormArgs)=>Array<T>
        ):Array<[string, Array<T>]> => fetchSortFormArgs(
            concFormsArgs, this.concFormsInitialArgs.sort, key);

        const availAttrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList');
        const sortModelProps:SortFormProperties = {
            attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
            sattr: fetchArgs(item => item.sattr),
            sbward: fetchArgs(item => item.sbward),
            sicase: fetchArgs(item => item.sicase),
            skey: fetchArgs(item => item.skey),
            spos: fetchArgs(item => item.spos),
            sortlevel : fetchArgs(item => item.sortlevel),
            defaultFormAction : fetchArgs(item => item.form_action),
            mlxattr : fetchMLArgs(item => importMultiLevelArg(
                'mlxattr', item, ()=>availAttrs[0].n)),
            mlxicase : fetchMLArgs(item => importMultiLevelArg('mlxicase', item)),
            mlxbward : fetchMLArgs(item => importMultiLevelArg('mlxbward', item)),
            mlxctx : fetchMLArgs(item => importMultiLevelArg('mlxctx', item)),
            mlxpos : fetchMLArgs(item => importMultiLevelArg('mlxpos', item))
        };

        this.queryModels.sortModel = new ConcSortModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            sortModelProps,
            this.concFormsInitialArgs.sort
        );
        this.queryModels.multiLevelConcSortModel = new MultiLevelConcSortModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            sortModelProps,
            this.concFormsInitialArgs.sort
        );
        this.sortFormViews = sortFormInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            sortModel: this.queryModels.sortModel,
            multiLevelConcSortModel: this.queryModels.multiLevelConcSortModel
        });
    }

    private initSampleForm(switchMcModel:SwitchMainCorpModel):void {
        const concFormsArgs = this.layoutModel.getConf<{[ident:string]:formArgs.ConcFormArgs}>(
            'ConcFormsArgs'
        );
        const fetchArg = <T>(key:(item:formArgs.SampleFormArgs)=>T):Array<[string, T]>=>
            fetchSampleFormArgs(concFormsArgs, key);

        const sampleModelProps:SampleFormProperties = {
            rlines: fetchArg<string>(item => item.rlines)
        };

        this.queryModels.sampleModel = new ConcSampleModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            sampleModelProps,
            this.concFormsInitialArgs.sample
        );
        this.miscQueryOpsViews = sampleFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.queryModels.sampleModel,
            switchMcModel
        );
    }

    private initSwitchMainCorpForm():void {
        const concFormsArgs = this.layoutModel.getConf<{[ident:string]:formArgs.ConcFormArgs}>(
            'ConcFormsArgs');
        const fetchArg = <T>(key:(item:formArgs.SwitchMainCorpArgs)=>T):Array<[string, T]>=>
            fetchSwitchMainCorpFormArgs(concFormsArgs, key);

        const switchMainCorpProps:SwitchMainCorpFormProperties = {
            maincorp: fetchArg<string>(item => item.maincorp)
        };

        this.queryModels.switchMcModel = new SwitchMainCorpModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            switchMainCorpProps,
            this.concFormsInitialArgs.switchmc
        );
    }

    private initFirsthitsForm():void {
        this.queryModels.firstHitsModel = new FirstHitsModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.concFormsInitialArgs.firsthits
        );
    }

    /**
     *
     */
    initQueryOverviewArea(taghelperPlugin:PluginInterfaces.TagHelper.IPlugin):void {
        this.queryModels.queryReplayModel = new QueryReplayModel({
            dispatcher: this.layoutModel.dispatcher,
            pageModel: this.layoutModel,
            replayModelDeps: {
                queryModel: this.queryModels.queryModel,
                filterModel: this.queryModels.filterModel,
                sortModel: this.queryModels.sortModel,
                mlConcSortModel: this.queryModels.multiLevelConcSortModel,
                sampleModel: this.queryModels.sampleModel,
                textTypesModel: this.queryModels.textTypesModel,
                switchMcModel: this.queryModels.switchMcModel,
                firstHitsModel: this.queryModels.firstHitsModel
            },
            currentOperations: this.layoutModel.getConf<Array<Kontext.QueryOperation>>(
                'queryOverview') || [],
            concArgsCache: this.layoutModel.getConf<LocalQueryFormData>('ConcFormsArgs')
        });

        this.queryOverviewViews = queryOverviewInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            viewDeps: {
                QueryFormView: this.queryFormViews.QueryFormLite,
                FilterFormView: this.filterFormViews.FilterForm,
                SubHitsForm: this.filterFormViews.SubHitsForm,
                FirstHitsForm: this.filterFormViews.FirstHitsForm,
                SortFormView: this.sortFormViews.SortForm,
                SampleForm: this.miscQueryOpsViews.SampleForm,
                ShuffleForm: this.miscQueryOpsViews.ShuffleForm,
                SwitchMainCorpForm: this.miscQueryOpsViews.SwitchMainCorpForm
            },
            queryReplayModel: this.queryModels.queryReplayModel,
            mainMenuModel: this.layoutModel.getModels().mainMenuModel,
            querySaveAsModel: this.queryModels.saveAsFormModel
        });

        this.layoutModel.renderReactComponent(
            this.queryOverviewViews.QueryToolbar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getCorpusIdent().id,
                humanCorpname: this.layoutModel.getCorpusIdent().name,
                usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                origSubcorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
                foreignSubcorp: this.layoutModel.getCorpusIdent().foreignSubcorp,
                queryFormProps: {
                    formType: Kontext.ConcFormTypes.QUERY,
                    tagHelperView: this.layoutModel.isNotEmptyPlugin(taghelperPlugin) ?
                            taghelperPlugin.getWidgetView(
                                this.layoutModel.getCorpusIdent().id,
                                this.layoutModel.getCorpusIdent().id,
                                this.layoutModel.getNestedConf<
                                    Array<PluginInterfaces.TagHelper.TagsetInfo>>(
                                        'pluginData', 'taghelper', 'corp_tagsets')
                            ) :
                            null,
                    corpname: this.layoutModel.getCorpusIdent().id
                },
                filterFormProps: {
                    formType: Kontext.ConcFormTypes.FILTER,
                    tagHelperView: this.layoutModel.isNotEmptyPlugin(taghelperPlugin) ?
                            taghelperPlugin.getWidgetView(
                                this.layoutModel.getCorpusIdent().id,
                                '__new__',
                                this.layoutModel.getNestedConf<
                                Array<PluginInterfaces.TagHelper.TagsetInfo>>(
                                    'pluginData', 'taghelper', 'corp_tagsets')
                            ) :
                            null,
                    filterId: '__new__',
                    corpname: this.layoutModel.getCorpusIdent().id
                },
                filterSubHitsFormProps: {
                    formType: Kontext.ConcFormTypes.SUBHITS,
                    submitFn:() => {
                        const args = this.layoutModel.getConcArgs();
                        window.location.href = this.layoutModel.createActionUrl(
                            'filter_subhits', args);
                    },
                    opKey: undefined
                },
                filterFirstDocHitsFormProps: {
                    formType: Kontext.ConcFormTypes.FIRSTHITS,
                    opKey: undefined,
                },
                sortFormProps: {
                    formType: Kontext.ConcFormTypes.SORT,
                    sortId: undefined
                },
                shuffleFormProps: {
                    formType: Kontext.ConcFormTypes.SHUFFLE,
                    lastOpSize: 0,
                    shuffleMinResultWarning: this.layoutModel.getConf<number>(
                        'ShuffleMinResultWarning'
                    ),
                    shuffleSubmitFn: () => {
                        const args = this.layoutModel.getConcArgs();
                        window.location.href = this.layoutModel.createActionUrl(
                            'shuffle', args);
                    }
                },
                switchMcFormProps: {
                    formType: Kontext.ConcFormTypes.SWITCHMC,
                    opKey: undefined
                },
                sampleFormProps: {
                    formType: Kontext.ConcFormTypes.SAMPLE,
                    sampleId: undefined
                }
            }
        );
    }

    initAnalysisViews(ttModel:TextTypesModel):void {
        const attrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList');
        // ------------------ coll ------------
        const collFormInputs = this.layoutModel.getConf<CollFormInputs>('CollFormProps');
        this.collFormModel = new CollFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            {
                attrList: attrs,
                cattr: collFormInputs.cattr || attrs[0].n,
                cfromw: collFormInputs.cfromw,
                ctow: collFormInputs.ctow,
                cminfreq: collFormInputs.cminfreq,
                cminbgr: collFormInputs.cminbgr,
                cbgrfns: collFormInputs.cbgrfns,
                csortfn: collFormInputs.csortfn
            }
        );
        this.collFormViews = collFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.collFormModel
        );
        // ------------------ freq ------------
        const structAttrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList');
        const freqFormInputs = this.layoutModel.getConf<FreqFormInputs>('FreqFormProps');
        const initFreqLevel = this.layoutModel.getConf<number>('InitialFreqLevel');

        const freqFormProps:FreqFormProps = {
            structAttrList: structAttrs,
            fttattr: freqFormInputs.fttattr,
            ftt_include_empty: freqFormInputs.ftt_include_empty,
            flimit: freqFormInputs.flimit,
            freq_sort: freqFormInputs.freq_sort,
            attrList: attrs,
            mlxattr: List.repeat(() => attrs[0].n, initFreqLevel),
            mlxicase: List.repeat(() => false, initFreqLevel),
            mlxctx: List.repeat(() => '0>0', initFreqLevel),  // = "Node'"
            alignType: List.repeat(() => AlignTypes.LEFT, initFreqLevel),
        }
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

        // ------------------ contingency table ----------
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
            usesAdHocSubcorpus: ttModel.usesAdHocSubcorpus(),
            selectedTextTypes: ttModel.UNSAFE_exportSelections(false)
        };

        this.ctFreqFormModel = new Freq2DFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps
        );

        this.freqFormViews = freqFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.mlFreqModel,
            this.ttFreqModel,
            this.ctFreqFormModel
        );
        this.analysisViews = analysisFrameInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            collViews: this.collFormViews,
            freqViews: this.freqFormViews,
            mainMenuModel: this.layoutModel.getModels().mainMenuModel
        });
        this.layoutModel.renderReactComponent(
            this.analysisViews.AnalysisFrame,
            window.document.getElementById('analysis-forms-mount'),
            {
                initialFreqFormVariant: 'ml'
            }
        );
    }

    private initTextTypesModel():TextTypesModel {
        const concFormArgs = this.layoutModel.getConf<{[ident:string]:formArgs.ConcFormArgs}>(
            'ConcFormsArgs'
        );
        const queryFormArgs = fetchQueryFormArgs(concFormArgs);
        this.queryModels.textTypesModel = new TextTypesModel(
            this.layoutModel.dispatcher,
            this.layoutModel.pluginApi(),
            this.layoutModel.getConf<TTInitialData>('textTypesData'),
            true
        );

        // we restore checked text types but with no bib-mapping; hidden IDs are enough here as
        // the pop-up query form does not display text-types form (yet the values are still
        // applied thanks to this).
        this.queryModels.textTypesModel.applyCheckedItems(queryFormArgs.selected_text_types, {});
        return this.queryModels.textTypesModel;
    }

    private initTokenConnect():PluginInterfaces.TokenConnect.IPlugin {
        return tokenConnectInit(
            this.layoutModel.pluginApi(),
            this.layoutModel.getConf<Array<string>>('alignedCorpora')
        );
    }

    private initModels(
        queryFormArgs:formArgs.QueryFormArgsResponse,
        syntaxViewer:PluginInterfaces.SyntaxViewer.IPlugin,
        tokenConnect:PluginInterfaces.TokenConnect.IPlugin
    ):ViewConfiguration {

        const concSummaryProps:ConcSummary = {
            concSize: this.layoutModel.getConf<number>('ConcSize'),
            fullSize: this.layoutModel.getConf<number>('FullSize'),
            sampledSize: this.layoutModel.getConf<number>('SampledSize'),
            ipm: this.layoutModel.getConf<number>('ResultIpm'),
            arf: this.layoutModel.getConf<number>('ResultArf'),
            isShuffled: this.layoutModel.getConf<boolean>('ResultShuffled')
        };

        const lineViewProps:ViewConfiguration = {
            basePosAttr: this.layoutModel.getConf<string>('baseAttr'),
            baseViewAttr: this.layoutModel.getConcArgs().base_viewattr,
            activePosAttrs: this.layoutModel.getConcArgs().attrs,
            anonymousUser: this.layoutModel.getConf<boolean>('anonymousUser'),
            ViewMode: this.layoutModel.getConf<'kwic'|'sen'|'align'>('ViewMode'),
            AttrViewMode: this.layoutModel.getConf<ViewOptions.AttrViewMode>('AttrViewMode'),
            ShowLineNumbers: this.layoutModel.getConf<boolean>('ShowLineNumbers'),
            KWICCorps: this.layoutModel.getConf<Array<string>>('KWICCorps'),
            CorporaColumns: List.map(
                v => ({n: v.n, label: v.label, visible: true}),
                this.layoutModel.getConf<Array<Kontext.AttrItem>>('CorporaColumns')
            ),
            SortIdx: this.layoutModel.getConf<Array<{page:number; label:string}>>('SortIdx'),
            NumItemsInLockedGroups: this.layoutModel.getConf<number>('NumLinesInGroups'),
            baseCorpname: this.layoutModel.getCorpusIdent().id,
            subCorpName: this.layoutModel.getCorpusIdent().usesubcorp,
            origSubCorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
            pagination: this.layoutModel.getConf<ServerPagination>('Pagination'),
            currentPage: this.layoutModel.getConf<number>('FromPage'),
            mainCorp: this.layoutModel.getConcArgs().maincorp,
            concSummary: concSummaryProps,
            Unfinished: this.layoutModel.getConf<boolean>('Unfinished'),
            FastAdHocIpm: this.layoutModel.getConf<boolean>('FastAdHocIpm'),
            canSendEmail: this.layoutModel.getConf<boolean>('canSendMail'),
            ShowConcToolbar: this.layoutModel.getConf<boolean>('ShowConcToolbar'),
            SpeakerIdAttr: this.layoutModel.getConf<[string, string]>('SpeakerIdAttr'),
            SpeechSegment: this.layoutModel.getConf<[string, string]>('SpeechSegment'),
            SpeechOverlapAttr: this.layoutModel.getConf<[string, string]>('SpeechOverlapAttr'),
            SpeechOverlapVal: this.layoutModel.getConf<string>('SpeechOverlapVal'),
            SpeechAttrs: this.layoutModel.getConf<Array<string>>('SpeechAttrs'),
            StructCtx: this.layoutModel.getConf<string>('StructCtx'),
            WideCtxGlobals: this.layoutModel.getConf<WideCtxArgs>('WideCtxGlobals'),
            useSafeFont: this.layoutModel.getConf<boolean>('ConcUseSafeFont'),
            supportsSyntaxView: this.layoutModel.pluginTypeIsActive(
                PluginName.SYNTAX_VIEWER),
            supportsTokenConnect: tokenConnect.providesAnyTokenInfo(),
            anonymousUserConcLoginPrompt: this.layoutModel.getConf<boolean>(
                'anonymousUserConcLoginPrompt'
            ),
            onLineSelChartFrameReady:(
                    rootElm:HTMLElement, corpusId:string, size:[number, number]) => {
                this.lineGroupsChart.showGroupsStats(rootElm, corpusId, size);
            }
        };

        this.viewModels = new ViewPageModels();
        this.viewModels.userInfoModel = this.layoutModel.getModels().userInfoModel;
        this.viewModels.mainMenuModel = this.layoutModel.getModels().mainMenuModel;

        this.viewModels.usageTipsModel = new UsageTipsModel(
            this.layoutModel.dispatcher,
            s => this.layoutModel.translate(s)
        );

        const lineSelStorage:ConcLinesStorage<LineSelectionModelState> = openStorage(
            this.layoutModel.dispatcher,
            (err:Error)=>{}
        );

        this.viewModels.lineViewModel = new ConcordanceModel(
            this.layoutModel,
            this.layoutModel.dispatcher,
            new ConcSaveModel({
                dispatcher: this.layoutModel.dispatcher,
                layoutModel: this.layoutModel,
                concSize: this.layoutModel.getConf<number>('ConcSize'),
                saveLinkFn: this.setDownloadLink.bind(this),
                quickSaveRowLimit: this.layoutModel.getConf<number>('QuickSaveRowLimit')
            }),
            syntaxViewer,
            lineViewProps,
            this.layoutModel.getConf<Array<ServerLineData>>('Lines')
        );

        this.viewModels.concSummaryModel = new ConcSummaryModel(
            this.layoutModel,
            this.layoutModel.dispatcher,
            {
                corpname: this.layoutModel.getCorpusIdent().id,
                concSize: lineViewProps.concSummary.concSize,
                fullSize: lineViewProps.concSummary.fullSize,
                isShuffled: lineViewProps.concSummary.isShuffled,
                isUnfinishedConc: this.layoutModel.getConf<boolean>('Unfinished'),
                ipm: null,
                corpusIpm: lineViewProps.concSummary.ipm,
                arf: lineViewProps.concSummary.arf,
                baseCorpname: lineViewProps.baseCorpname,
                fastAdHocIpm: lineViewProps.FastAdHocIpm,
                subCorpName: lineViewProps.subCorpName,
                origSubcorpName: lineViewProps.origSubCorpName,
                providesAdHocIpm: !Dict.empty(queryFormArgs.selected_text_types),
                baseCorpusSize: lineViewProps.concSummary.fullSize,
                isBusy: false
            }
        );

        this.viewModels.syntaxViewModel = syntaxViewer.getModel();

        this.viewModels.lineSelectionModel = new LineSelectionModel({
            layoutModel: this.layoutModel,
            dispatcher: this.layoutModel.dispatcher,
            clStorage: lineSelStorage
        });

        this.viewModels.concDetailModel = new ConcDetailModel(
            this.layoutModel,
            this.layoutModel.dispatcher,
            lineViewProps.StructCtx,
            {
                speakerIdAttr: lineViewProps.SpeakerIdAttr,
                speechSegment: lineViewProps.SpeechSegment,
                speechAttrs: lineViewProps.SpeechAttrs,
                speechOverlapAttr: lineViewProps.SpeechOverlapAttr,
                speechOverlapVal: lineViewProps.SpeechOverlapVal
            },
            lineViewProps.WideCtxGlobals,
            tokenConnect
        );
        this.viewModels.refsDetailModel = new RefsDetailModel(
            this.layoutModel,
            this.layoutModel.dispatcher
        );

        const showFreqInfo = this.layoutModel.getConf<TTCrit>('TTCrit').length > 0 &&
                this.layoutModel.getConf<Array<string>>(
                    'ConcDashboardModules').indexOf('freqs') > -1;
        this.viewModels.dashboardModel = new ConcDashboard(
            this.layoutModel.dispatcher,
            this.layoutModel,
            {
                showFreqInfo,
                hasKwicConnect: this.layoutModel.pluginTypeIsActive(PluginName.KWIC_CONNECT)
            }
        );
        if (showFreqInfo) {
            this.viewModels.ttDistModel = new TextTypesDistModel(
                this.layoutModel.dispatcher,
                this.layoutModel,
                this.viewModels.lineViewModel,
                {
                    ttCrit: this.layoutModel.getConf<TTCrit>('TTCrit')
                }
            );
        }
        return lineViewProps;
    }

    setDownloadLink(filename:string, url:string) {
        this.layoutModel.bgDownload({
            filename,
            type: DownloadType.CONCORDANCE,
            contentType: 'multipart/form-data',
            url
        });
    }

    init():void {
        const numLinesInGroups = this.layoutModel.getConf<number>('NumLinesInGroups');
        const disabledMenuItems = numLinesInGroups > 0 ?
            [
                tuple('menu-filter', null),
                tuple('menu-concordance', 'sorting'),
                tuple('menu-concordance', 'shuffle'),
                tuple('menu-concordance', 'sample')
            ] :
            [
                tuple('menu-concordance', 'sorting'),
                tuple('menu-concordance', 'shuffle'),
                tuple('menu-concordance', 'sample')
            ];

        this.layoutModel.init(true, disabledMenuItems, () => {
            const ttModel = this.initTextTypesModel();
            let syntaxViewerModel:PluginInterfaces.SyntaxViewer.IPlugin =
                syntaxViewerInit(this.layoutModel.pluginApi());
            if (!this.layoutModel.isNotEmptyPlugin(syntaxViewerModel)) {
                syntaxViewerModel = new DummySyntaxViewModel(
                    this.layoutModel.dispatcher,
                    {
                        isBusy: false,
                        kwicLength: 0,
                        tokenNumber: -1,
                        targetHTMLElementID: null
                    }
                );
            }

            const concFormArgs = this.layoutModel.getConf<{[ident:string]:formArgs.ConcFormArgs}>(
                'ConcFormsArgs'
            );
            const queryFormArgs = fetchQueryFormArgs(concFormArgs);

            const lineViewProps = this.initModels(
                queryFormArgs,
                syntaxViewerModel,
                this.initTokenConnect()
            );

            this.concViews = concViewsInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                ...this.viewModels
            });
            const tagHelperPlg = tagHelperPlugin(this.layoutModel.pluginApi());
            this.setupHistoryOnPopState();
            this.initQueryForm(queryFormArgs);
            this.initFirsthitsForm();
            this.initFilterForm(this.layoutModel.qsuggPlugin, this.queryModels.firstHitsModel);
            this.initSortForm();
            this.initSwitchMainCorpForm();
            this.initSampleForm(this.queryModels.switchMcModel);
            this.initQueryOverviewArea(tagHelperPlg);
            this.initAnalysisViews(ttModel);
            this.layoutModel.initKeyShortcuts();
            this.updateHistory();
            if (this.layoutModel.getConf<boolean>('Unfinished')) {
                this.reloadHits();
            }

            this.layoutModel.registerPageLeaveVoters(
                this.viewModels.lineSelectionModel
            );

            this.renderLines(
                {
                    ttModel,
                    lvprops: lineViewProps,
                    tagh: tagHelperPlg
                },
                this.layoutModel.pluginTypeIsActive(PluginName.KWIC_CONNECT) ?
                    kwicConnectInit(
                        this.layoutModel.pluginApi(),
                        this.layoutModel.getConf<Array<string>>('alignedCorpora'),
                        this.layoutModel.getConf<boolean>('Unfinished')
                    ).getWidgetView() :
                    null
            );
        });
    }
}

export function init(conf):void {
    new ViewPage(new KontextPage(conf)).init();
}
