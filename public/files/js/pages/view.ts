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

/// <reference path="../types/plugins.d.ts" />
/// <reference path="../vendor.d.ts/soundmanager.d.ts" />
/// <reference path="../types/views.d.ts" />

import * as SoundManager from 'vendor/SoundManager';
import RSVP from 'rsvp';

import {Kontext, TextTypes} from '../types/common';
import {AjaxResponse} from '../types/ajaxResponses';
import {PageModel} from '../app/main';
import {PluginInterfaces} from '../types/plugins';
import {parseUrlArgs} from '../app/navigation';
import {ActionPayload} from '../app/dispatcher';
import {MultiDict, updateProps} from '../util';
import * as conclines from '../conclines';
import {init as concViewsInit, ConcordanceViews} from 'views/concordance/main';
import {LineSelectionModel} from '../models/concordance/lineSelection';
import {ConcDetailModel, RefsDetailModel} from '../models/concordance/detail';
import {ConcLineModel, CorpColumn, ServerLineData, ViewConfiguration, ServerPagination, ConcSummary, DummySyntaxViewModel} from '../models/concordance/lines';
import {QueryFormProperties, QueryFormUserEntries, QueryModel, QueryHintModel, fetchQueryFormArgs} from '../models/query/main';
import {CQLEditorModel} from '../models/query/cqleditor/model';
import {QueryReplayModel, LocalQueryFormData} from '../models/query/replay';
import {FilterModel, FilterFormProperties, fetchFilterFormArgs} from '../models/query/filter';
import {ConcSampleModel, SampleFormProperties, fetchSampleFormArgs} from '../models/query/sample';
import {SwitchMainCorpModel, SwitchMainCorpFormProperties, fetchSwitchMainCorpFormArgs} from '../models/query/switchmc';
import {QuerySaveAsFormModel} from '../models/query/save';
import {TextTypesModel} from '../models/textTypes/attrValues';
import {WithinBuilderModel} from '../models/query/withinBuilder';
import {VirtualKeyboardModel} from '../models/query/virtualKeyboard';
import {QueryContextModel} from '../models/query/context';
import {ConcSortModel, MultiLevelConcSortModel, SortFormProperties, fetchSortFormArgs, importMultiLevelArg} from '../models/query/sort';
import {CollFormModel, CollFormProps, CollFormInputs} from '../models/coll/collForm';
import {MLFreqFormModel, TTFreqFormModel, FreqFormInputs, FreqFormProps} from '../models/freqs/freqForms';
import {Freq2DTableModel} from '../models/freqs/ctable';
import {Freq2DFlatViewModel} from '../models/freqs/flatCtable';
import {FirstHitsModel} from '../models/query/firstHits';
import {Freq2DFormModel, CTFormInputs, CTFormProperties} from '../models/freqs/ctFreqForm';
import {ConcSaveModel} from '../models/concordance/save';
import {ConcDashboard} from '../models/concordance/dashboard';
import tagHelperPlugin from 'plugins/taghelper/init';
import queryStoragePlugin from 'plugins/queryStorage/init';
import syntaxViewerInit from 'plugins/syntaxViewer/init';
import {UserSettings} from '../app/userSettings';
import * as applicationBar from 'plugins/applicationBar/init';
import {UserInfo} from '../models/user/info';
import {TextTypesDistModel, TextTypesDistModelProps, TTCrit} from '../models/concordance/ttDistModel';
import {init as queryFormInit, MainViews as QueryMainViews} from '../views/query/main';
import {init as filterFormInit, FilterFormViews} from '../views/query/filter';
import {init as queryOverviewInit, OverviewViews as QueryOverviewViews} from '../views/query/overview';
import {init as sortFormInit, SortViews} from '../views/query/sort';
import {init as sampleFormInit, SampleFormViews} from '../views/query/miscActions';
import {init as analysisFrameInit, AnalysisFrameViews} from 'views/analysis';
import {init as collFormInit, CollFormViews} from 'views/coll/forms';
import {init as freqFormInit, FreqFormViews} from '../views/freqs/forms';
import {LineSelGroupsRatiosChart} from '../charts/lineSelection';
import tokenDetailInit from 'plugins/tokenDetail/init';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/view.less');

export class ViewPageModels {
    lineSelectionModel:LineSelectionModel;
    lineViewModel:ConcLineModel;
    concDetailModel:ConcDetailModel;
    refsDetailModel:RefsDetailModel;
    userInfoModel:Kontext.IUserInfoModel;
    collFormModel:CollFormModel;
    mainMenuModel:Kontext.IMainMenuModel;
    ttDistModel:TextTypesDistModel;
    dashboardModel:ConcDashboard;
}

export class QueryModels {
    queryModel:QueryModel;
    filterModel:FilterModel;
    textTypesModel:TextTypesModel;
    queryHintModel:QueryHintModel;
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
    cqlEditorModel:CQLEditorModel;
    filterCqlEditorModel:CQLEditorModel;
}


/**
 * This is the concordance viewing and operating model with
 * all attached subsequent form components (filters, sorting,...)
 * and manual line selection functionality.
 */
export class ViewPage {

    private static CHECK_CONC_DELAY = 700;

    private static CHECK_CONC_DECAY = 1.1;

    private static CHECK_CONC_MAX_ATTEMPTS = 500;

    private layoutModel:PageModel;

    private viewModels:ViewPageModels;

    private queryModels:QueryModels;

    private hasLockedGroups:boolean;

    private concViews:ConcordanceViews;

    private analysisViews:AnalysisFrameViews;

    private lineGroupsChart:LineSelGroupsRatiosChart;

    private queryFormViews:QueryMainViews;

    private queryOverviewViews:QueryOverviewViews;

    private filterFormViews:FilterFormViews;

    private sortFormViews:SortViews;

    private miscQueryOpsViews:SampleFormViews;

    private concFormsInitialArgs:AjaxResponse.ConcFormsInitialArgs;

    private collFormModel:CollFormModel;

    private collFormViews:CollFormViews;

    private mlFreqModel:MLFreqFormModel;

    private ttFreqModel:TTFreqFormModel;

    private ctFreqFormModel:Freq2DFormModel;

    private freqFormViews:FreqFormViews;

    /**
     *
     * @param layoutModel
     * @param hasLockedGroups
     */
    constructor(layoutModel:PageModel, hasLockedGroups:boolean) {
        this.layoutModel = layoutModel;
        this.queryModels = new QueryModels();
        this.hasLockedGroups = hasLockedGroups;
        this.concFormsInitialArgs = this.layoutModel.getConf<AjaxResponse.ConcFormsInitialArgs>('ConcFormsInitialArgs');
        this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
        this.lineGroupsChart = new LineSelGroupsRatiosChart(
            this.layoutModel,
            this.layoutModel.getConf<Array<string>>('ChartExportFormats')
        );
    }

    private translate(s:string, values?:any):string {
        return this.layoutModel.translate(s, values);
    }

    private deserializeHashAction(v:string):ActionPayload {
        const tmp = v.substr(1).split('/');
        const args = tmp[1] ? new MultiDict(parseUrlArgs(tmp[1])) : undefined;
        return this.createFormAction(tmp[0], args);
    }

    private createFormAction(actionName:string, args:Kontext.IMultiDict):ActionPayload {
        switch (actionName) {
            case 'filter':
                return {
                    actionType: 'MAIN_MENU_SHOW_FILTER',
                    props: args.toDict()
                };
            case 'sort':
            case 'sortx':
                return {
                    actionType: 'MAIN_MENU_SHOW_SORT',
                    props: args.toDict()
                };
            case 'sample':
                return {
                    actionType: 'MAIN_MENU_SHOW_SAMPLE',
                    props: args.toDict()
                };
            case 'shuffle':
                return {
                    actionType: 'MAIN_MENU_APPLY_SHUFFLE',
                    props: args.toDict()
                };
            case 'edit_op':
                return {
                    actionType: 'EDIT_QUERY_OPERATION',
                    props: {operationIdx: Number(args['operationIdx'])}
                };
            default:
                return null;
        }
    }

    /**
     *
     * @param rootElm
     * @param usePrevData
     */
    showGroupsStats(rootElm:HTMLElement, usePrevData:boolean):void {
        this.lineGroupsChart.showGroupsStats(
            rootElm,
            usePrevData,
            this.layoutModel.getConf<Kontext.FullCorpusIdent>('corpusIdent').id,
            [200, 200]
        );
    }

    private handleBeforeUnload(event:any):void {
        if (this.viewModels.lineSelectionModel.size() > 0) {
            event.returnValue = this.translate('global__are_you_sure_to_leave');
            return event.returnValue;
        }
        return undefined; // !! any other value will cause the dialog window to be shown
    }

    /**
     * User must be notified in case he wants to leave the page but at the same time he
     * has selected some concordance lines without using them in a filter.
     */
    private onBeforeUnloadAsk():void {
        window.addEventListener('beforeunload', this.handleBeforeUnload);
    }

    /**
     *
     */
    private setupHistoryOnPopState():void {
        // register event to load lines via ajax in case user hits back
        this.layoutModel.getHistory().setOnPopState((event) => {
            if (event.state) {
                if (event.state['modalAction']) {
                    this.layoutModel.dispatcher.dispatch(event.state['modalAction']);

                } else if (event.state['pagination']) {
                    this.layoutModel.dispatcher.dispatch({
                        actionType: 'CONCORDANCE_REVISIT_PAGE',
                        props: {
                            action: 'customPage',
                            pageNum: event.state['pageNum']
                        }
                    });
                }
            }
        });
    }

    renderLines(props:ViewConfiguration):RSVP.Promise<any> {
        let ans = new RSVP.Promise((resolve:(v:any)=>void, reject:(e:any)=>void) => {
            props.onReady = () => resolve(null);
            try {
                this.layoutModel.renderReactComponent(
                    this.concViews.ConcordanceDashboard,
                    window.document.getElementById('conc-dashboard-mount'),
                    {
                        concViewProps: props
                    }
                );

            } catch (e) {
                console.error(e.stack);
                throw e;
            }
        });
        return ans;
    }

    reloadHits():void {
        const linesPerPage = this.layoutModel.getConf<number>('numLines');
        const applyData = (data:AjaxResponse.ConcStatus) => {
            this.layoutModel.dispatcher.dispatch({
                actionType: 'CONCORDANCE_ASYNC_CALCULATION_UPDATED',
                props: {
                    finished: !!data.finished,
                    concsize: data.concsize,
                    relconcsize: data.relconcsize,
                    arf: data.arf,
                    fullsize: data.fullsize,
                    availPages: Math.ceil(data.concsize / linesPerPage)
                }
            });
        };
        const loop = (idx:number, delay:number, decay:number) => {
            window.setTimeout(() => {
                this.layoutModel.ajax(
                    'GET',
                    this.layoutModel.createActionUrl('get_cached_conc_sizes'),
                    this.layoutModel.getConcArgs()

                ).then(
                    (data:AjaxResponse.ConcStatus) => {
                        if (!data.finished) {
                            if (data.fullsize > 0) {
                                applyData(data); // partial result
                            }
                            if (idx < ViewPage.CHECK_CONC_MAX_ATTEMPTS) {
                                loop(idx + 1, delay * decay, decay);
                            }

                        } else {
                            applyData(data);
                        }
                    }
                );
            }, delay);
        }
        loop(0, ViewPage.CHECK_CONC_DELAY, ViewPage.CHECK_CONC_DECAY);
    }

    /**
     * Ensures that view's URL is always reusable (which is not always
     * guaranteed implicitly - e.g. in case the form was submitted via POST
     * method).
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
            case 'filter':
            case 'sortx':
            case 'shuffle':
            case 'reduce':
                const formArgs = this.layoutModel.getConf<AjaxResponse.ConcFormArgs>('ConcFormsArgs')['__latest__'];
                this.layoutModel.getHistory().replaceState(
                    'view',
                    this.layoutModel.getConcArgs(),
                    {
                        modalAction: {
                            actionType: 'EDIT_QUERY_OPERATION',
                            props: {
                                operationIdx: this.queryModels.queryReplayModel.getNumOperations() - 1
                            }
                        }
                    },
                    window.document.title
                );
                this.layoutModel.getHistory().pushState(
                    'view',
                    this.layoutModel.getConcArgs(),
                    {
                        pagination: true,
                        pageNum: this.viewModels.lineViewModel.getCurrentPage()
                    },
                    window.document.title
                );
            break;
            default:
                this.layoutModel.getHistory().replaceState(
                    'view',
                    this.layoutModel.getConcArgs(),
                    {
                        pagination: true,
                        pageNum: this.viewModels.lineViewModel.getCurrentPage()
                    },
                    window.document.title
                );
            break;
        }
    }

    private updateLocalAlignedCorpora():void {
        let serverSideAlignedCorpora = this.layoutModel.getConf<Array<string>>('alignedCorpora').slice();
        this.layoutModel.userSettings.set(UserSettings.ALIGNED_CORPORA_KEY, serverSideAlignedCorpora);
    }

    private getActiveCorpora():Array<string> {
        return [this.layoutModel.getConf<string>('corpname')].concat(
                this.layoutModel.getConf<Array<string>>('alignedCorpora') || []);
    }

    /**
     *
     */
    private initQueryForm():void {
        const concFormArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
        const queryFormArgs = fetchQueryFormArgs(concFormArgs);

        this.queryModels.queryHintModel = new QueryHintModel(
            this.layoutModel.dispatcher,
            ['query__tip_01', 'query__tip_02', 'query__tip_03', 'query__tip_04'],
            this.layoutModel.translate.bind(this.layoutModel)
        );
        this.queryModels.withinBuilderModel = new WithinBuilderModel(this.layoutModel.dispatcher,
                this.layoutModel);
        this.queryModels.virtualKeyboardModel = new VirtualKeyboardModel(this.layoutModel.dispatcher,
                this.layoutModel);
        this.queryModels.queryContextModel = new QueryContextModel(this.layoutModel.dispatcher);
        this.queryModels.saveAsFormModel = new QuerySaveAsFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.layoutModel.getConf<string>('concPersistenceOpId')
        );

        const queryFormProps:QueryFormProperties = {
            corpora: this.getActiveCorpora(),
            availableAlignedCorpora: this.layoutModel.getConf<Array<Kontext.AttrItem>>('availableAlignedCorpora'),
            currQueryTypes: queryFormArgs.curr_query_types,
            currQueries: queryFormArgs.curr_queries,
            currPcqPosNegValues: queryFormArgs.curr_pcq_pos_neg_values,
            currLposValues: queryFormArgs.curr_lpos_values,
            currQmcaseValues: queryFormArgs.curr_qmcase_values,
            currDefaultAttrValues: queryFormArgs.curr_default_attr_values,
            subcorpList: this.layoutModel.getConf<Array<string>>('SubcorpList'),
            currentSubcorp: this.layoutModel.getConf<string>('CurrentSubcorp'),
            tagBuilderSupport: queryFormArgs.tag_builder_support,
            shuffleConcByDefault: this.layoutModel.getConf<boolean>('ShuffleConcByDefault'),
            forcedAttr: this.layoutModel.getConf<string>('ForcedAttr'),
            attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
            lemmaWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
            posWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
            hasLemma: queryFormArgs.has_lemma,
            tagsetDocs: queryFormArgs.tagset_docs,
            wPoSList: this.layoutModel.getConf<Array<{v:string; n:string}>>('Wposlist'),
            inputLanguages: this.layoutModel.getConf<{[corpname:string]:string}>('InputLanguages'),
            textTypesNotes: this.layoutModel.getConf<string>('TextTypesNotes'),
            selectedTextTypes: queryFormArgs.selected_text_types,
            useCQLEditor:this.layoutModel.getConf<boolean>('UseCQLEditor'),
            tagAttr: this.layoutModel.getConf<string>('tagAttr')
        };

        this.queryModels.queryModel = new QueryModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.queryModels.textTypesModel,
            this.queryModels.queryContextModel,
            queryFormProps
        );
        this.layoutModel.getModels().generalViewOptionsModel.addOnSubmitResponseHandler(model => {
            this.queryModels.queryModel.onSettingsChange(model);
        });

        this.queryModels.cqlEditorModel = new CQLEditorModel({
            dispatcher: this.layoutModel.dispatcher,
            pageModel: this.layoutModel,
            attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
            tagAttr: this.layoutModel.getConf<string>('tagAttr'),
            actionPrefix: ''
        });

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
            cqlEditorModel: this.queryModels.cqlEditorModel
        });
    }

    private initFilterForm(firstHitsModel:FirstHitsModel):void {
        const concFormsArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
        const fetchArgs = <T>(key:(item:AjaxResponse.FilterFormArgs)=>T)=>fetchFilterFormArgs(concFormsArgs, key);
        const filterFormProps:FilterFormProperties = {
            filters: Object.keys(concFormsArgs)
                        .filter(k => concFormsArgs[k].form_type === 'filter'),
            maincorps: fetchArgs<string>(item => item.maincorp),
            currPnFilterValues: fetchArgs<string>(item => item.pnfilter),
            currQueryTypes: fetchArgs<string>(item => item.query_type),
            currQueries: fetchArgs<string>(item => item.query),
            currQmcaseValues: fetchArgs<boolean>(item => item.qmcase),
            currDefaultAttrValues: fetchArgs<string>(item => item.default_attr_value),
            currLposValues: fetchArgs<string>(item => item.lpos),
            currFilflVlaues: fetchArgs<string>(item => item.filfl),
            currFilfposValues: fetchArgs<string>(item => item.filfpos),
            currFiltposValues: fetchArgs<string>(item => item.filtpos),
            currInclkwicValues: fetchArgs<boolean>(item => item.inclkwic),
            tagBuilderSupport: fetchArgs<boolean>(item => item.tag_builder_support),
            withinArgValues: fetchArgs<number>(item => item.within),
            forcedAttr: this.layoutModel.getConf<string>('ForcedAttr'),
            attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
            lemmaWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
            posWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
            hasLemma: fetchArgs<boolean>(item => item.has_lemma),
            tagsetDoc: fetchArgs<string>(item => item.tagset_doc),
            wPoSList: this.layoutModel.getConf<Array<{v:string; n:string}>>('Wposlist'),
            inputLanguage: this.layoutModel.getConf<{[corpname:string]:string}>('InputLanguages')[this.layoutModel.getConf<string>('corpname')],
            opLocks: fetchArgs<boolean>(item => item.form_type === 'locked'),
            useCQLEditor: this.layoutModel.getConf<boolean>('UseCQLEditor'),
            tagAttr: this.layoutModel.getConf<string>('tagAttr')
        }

        this.queryModels.filterModel = new FilterModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.queryModels.textTypesModel,
            this.queryModels.queryContextModel,
            filterFormProps
        );

        this.queryModels.filterCqlEditorModel = new CQLEditorModel({
            dispatcher: this.layoutModel.dispatcher,
            pageModel: this.layoutModel,
            attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
            tagAttr: this.layoutModel.getConf<string>('tagAttr'),
            actionPrefix: 'FILTER_'
        });

        this.layoutModel.getModels().generalViewOptionsModel.addOnSubmitResponseHandler(model => {
            this.queryModels.filterModel.notifyChangeListeners();
        });

        this.layoutModel.getModels().mainMenuModel.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_FILTER',
            (args:Kontext.GeneralProps) => {
                if (args['within'] === 1) {
                    this.layoutModel.replaceConcArg('maincorp', [args['maincorp']]);
                }
                return this.queryModels.filterModel.syncFrom(() => {
                    return new RSVP.Promise<AjaxResponse.FilterFormArgs>((resolve:(v)=>void, reject:(err)=>void) => {
                        resolve(updateProps(this.concFormsInitialArgs.filter, args));
                    });
                });
            }
        );

        this.filterFormViews = filterFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.queryModels.filterModel,
            this.queryModels.queryHintModel,
            this.queryModels.withinBuilderModel,
            this.queryModels.virtualKeyboardModel,
            firstHitsModel,
            this.queryModels.filterCqlEditorModel
        );
    }

    private initSortForm():void {
        const concFormsArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
        const fetchArgs = <T>(key:(item:AjaxResponse.SortFormArgs)=>T):Array<[string, T]>=>fetchSortFormArgs(concFormsArgs, key);
        const availAttrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList');

        const sortModelProps:SortFormProperties = {
            attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
            sattr: fetchArgs<string>(item => item.sattr),
            sbward: fetchArgs<string>(item => item.sbward),
            sicase: fetchArgs<string>(item => item.sicase),
            skey: fetchArgs<string>(item => item.skey),
            spos: fetchArgs<string>(item => item.spos),
            sortlevel : fetchArgs<number>(item => item.sortlevel),
            defaultFormAction : fetchSortFormArgs<string>(concFormsArgs, item => item.form_action),
            mlxattr : fetchArgs<Array<string>>(item => importMultiLevelArg<string>('mlxattr', item, (n)=>availAttrs[0].n)),
            mlxicase : fetchArgs<Array<string>>(item => importMultiLevelArg<string>('mlxicase', item)),
            mlxbward : fetchArgs<Array<string>>(item => importMultiLevelArg<string>('mlxbward', item)),
            mlxctx : fetchArgs<Array<string>>(item => importMultiLevelArg<string>('mlxctx', item)),
            mlxpos : fetchArgs<Array<number>>(item => importMultiLevelArg<number>('mlxpos', item)),
        };

        this.queryModels.sortModel = new ConcSortModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            sortModelProps
        );
        this.queryModels.multiLevelConcSortModel = new MultiLevelConcSortModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            sortModelProps
        );
        this.layoutModel.getModels().mainMenuModel.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_SORT',
            (args:Kontext.GeneralProps) => {
                return this.queryModels.sortModel.syncFrom(() => {
                    return new RSVP.Promise<AjaxResponse.SortFormArgs>((resolve:(v)=>void, reject:(err)=>void) => {
                        resolve(updateProps(this.concFormsInitialArgs.sort, args));
                    });
                }).then(
                    () => {
                        this.queryModels.multiLevelConcSortModel.syncFrom(() => {
                            return new RSVP.Promise<AjaxResponse.SortFormArgs>((resolve:(v)=>void, reject:(err)=>void) => {
                                resolve(updateProps(this.concFormsInitialArgs.sort, args));
                            });
                        });
                    }
                );
            }
        );

        this.sortFormViews = sortFormInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            sortModel: this.queryModels.sortModel,
            multiLevelConcSortModel: this.queryModels.multiLevelConcSortModel
        });
    }

    private initSampleForm(switchMcModel:SwitchMainCorpModel):void {
        const concFormsArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
        const fetchArg = <T>(key:(item:AjaxResponse.SampleFormArgs)=>T):Array<[string, T]>=>fetchSampleFormArgs(concFormsArgs, key);

        const sampleModelProps:SampleFormProperties = {
            rlines: fetchArg<string>(item => item.rlines)
        };

        this.queryModels.sampleModel = new ConcSampleModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            sampleModelProps
        );
        this.layoutModel.getModels().mainMenuModel.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_SAMPLE',
            (args:Kontext.GeneralProps) => {
                return this.queryModels.sampleModel.syncFrom(() => {
                    return new RSVP.Promise<AjaxResponse.SampleFormArgs>((resolve:(v)=>void, reject:(err)=>void) => {
                        resolve(updateProps(this.concFormsInitialArgs.sample, args));
                    });
                });
            }
        );
        this.miscQueryOpsViews = sampleFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.queryModels.sampleModel,
            switchMcModel
        );
    }

    private initSwitchMainCorpForm():void {
        const concFormsArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
        const fetchArg = <T>(key:(item:AjaxResponse.SwitchMainCorpArgs)=>T):Array<[string, T]>=>fetchSwitchMainCorpFormArgs(concFormsArgs, key);

        const switchMainCorpProps:SwitchMainCorpFormProperties = {
            maincorp: fetchArg<string>(item => item.maincorp)
        };

        this.queryModels.switchMcModel = new SwitchMainCorpModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            switchMainCorpProps
        );

        this.layoutModel.getModels().mainMenuModel.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_SWITCHMC',
            (args:Kontext.GeneralProps) => {
                return this.queryModels.switchMcModel.syncFrom(() => {
                    return new RSVP.Promise<AjaxResponse.SwitchMainCorpArgs>((resolve:(v)=>void, reject:(err)=>void) => {
                        resolve(updateProps(this.concFormsInitialArgs.sample, args));
                    });
                });
            }
        );
    }

    private initFirsthitsForm():void {
        this.queryModels.firstHitsModel = new FirstHitsModel(
            this.layoutModel.dispatcher,
            this.layoutModel
        );
        this.layoutModel.getModels().mainMenuModel.addItemActionPrerequisite(
            'MAIN_MENU_FILTER_APPLY_FIRST_OCCURRENCES',
            (args:Kontext.GeneralProps) => {
                return this.queryModels.firstHitsModel.syncFrom(() => {
                    return new RSVP.Promise<AjaxResponse.FirstHitsFormArgs>((resolve:(v)=>void, reject:(err)=>void) => {
                        resolve(updateProps(this.concFormsInitialArgs.firsthits, args));
                    });
                });
            }
        );
    }

    /**
     *
     */
    initQueryOverviewArea(taghelperPlugin:PluginInterfaces.ITagHelper, queryStoragePlugin:PluginInterfaces.IQueryStorage):void {
        this.queryModels.queryReplayModel = new QueryReplayModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            {
                queryModel: this.queryModels.queryModel,
                filterModel: this.queryModels.filterModel,
                sortModel: this.queryModels.sortModel,
                mlConcSortModel: this.queryModels.multiLevelConcSortModel,
                sampleModel: this.queryModels.sampleModel,
                textTypesModel: this.queryModels.textTypesModel,
                switchMcModel: this.queryModels.switchMcModel,
                firstHitsModel: this.queryModels.firstHitsModel
            },
            this.layoutModel.getConf<Array<Kontext.QueryOperation>>('queryOverview') || [],
            this.layoutModel.getConf<LocalQueryFormData>('ConcFormsArgs')
        );

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
                corpname: this.layoutModel.getConf<string>('corpname'),
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                usesubcorp: this.layoutModel.getConf<string>('subcorpname'),
                queryFormProps: {
                    formType: Kontext.ConcFormTypes.QUERY,
                    tagHelperView: this.layoutModel.isNotEmptyPlugin(taghelperPlugin) ?
                            taghelperPlugin.getWidgetView() : null,
                    queryStorageView: queryStoragePlugin.getWidgetView(),
                    actionPrefix: '',
                    corpname: this.layoutModel.getConf<string>('corpname')
                },
                filterFormProps: {
                    formType: Kontext.ConcFormTypes.FILTER,
                    tagHelperView: this.layoutModel.isNotEmptyPlugin(taghelperPlugin) ?
                            taghelperPlugin.getWidgetView() : null,
                    queryStorageView: queryStoragePlugin.getWidgetView(),
                    actionPrefix: 'FILTER_',
                    filterId: '__new__'
                },
                filterSubHitsFormProps: {
                    formType: Kontext.ConcFormTypes.FILTER,
                    submitFn:() => {
                        const args = this.layoutModel.getConcArgs();
                        window.location.href = this.layoutModel.createActionUrl('filter_subhits', args.items());
                    }
                },
                filterFirstDocHitsFormProps: {
                    formType: Kontext.ConcFormTypes.FIRSTHITS
                },
                sortFormProps: {
                    formType: Kontext.ConcFormTypes.SORT
                },
                shuffleFormProps: {
                    formType: Kontext.ConcFormTypes.SHUFFLE,
                    lastOpSize: 0,
                    shuffleMinResultWarning: this.layoutModel.getConf<number>('ShuffleMinResultWarning'),
                    shuffleSubmitFn: () => {
                        const args = this.layoutModel.getConcArgs();
                        window.location.href = this.layoutModel.createActionUrl('shuffle', args.items());
                    }
                },
                switchMcFormProps: {
                    formType: Kontext.ConcFormTypes.SWITCHMC
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
            this.layoutModel.layoutViews,
            this.collFormModel
        );
        // ------------------ freq ------------
        const structAttrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList');
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
            multiSattrAllowedStructs: this.layoutModel.getConf<Array<string>>('multiSattrAllowedStructs'),
            ctminfreq: ctFormInputs.ctminfreq,
            ctminfreq_type: ctFormInputs.ctminfreq_type
        };

        this.ctFreqFormModel = new Freq2DFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps,
            ttModel
        );

        this.freqFormViews = freqFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.mlFreqModel,
            this.ttFreqModel,
            this.ctFreqFormModel
        );
        this.analysisViews = analysisFrameInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.layoutModel.layoutViews,
            this.collFormViews,
            this.freqFormViews,
            this.layoutModel.getModels().mainMenuModel
        );
        this.layoutModel.renderReactComponent(
            this.analysisViews.AnalysisFrame,
            window.document.getElementById('analysis-forms-mount'),
            {
                initialFreqFormVariant: 'ml'
            }
        );
    }

    private updateMainMenu():void {
        const updateMenu = (numLinesInGroups) => {
            if (numLinesInGroups > 0) {
                this.layoutModel.getModels().mainMenuModel.disableMenuItem('menu-filter');
                this.layoutModel.getModels().mainMenuModel.disableMenuItem('menu-concordance', 'sorting');
                this.layoutModel.getModels().mainMenuModel.disableMenuItem('menu-concordance', 'shuffle');
                this.layoutModel.getModels().mainMenuModel.disableMenuItem('menu-concordance', 'sample');

            } else {
                this.layoutModel.getModels().mainMenuModel.enableMenuItem('menu-filter');
                this.layoutModel.getModels().mainMenuModel.enableMenuItem('menu-concordance', 'sorting');
                this.layoutModel.getModels().mainMenuModel.enableMenuItem('menu-concordance', 'shuffle');
                this.layoutModel.getModels().mainMenuModel.enableMenuItem('menu-concordance', 'sample');
            }
        };
        updateMenu(this.layoutModel.getConf<number>('NumLinesInGroups'));
        this.layoutModel.addConfChangeHandler<number>('NumLinesInGroups', updateMenu);
    }

    private initKeyShortcuts():void {
        const actionMap = this.layoutModel.getModels().mainMenuModel.exportKeyShortcutActions();
        this.layoutModel.addGlobalKeyEventHandler((evt:KeyboardEvent) => {
            if (document.activeElement === document.body &&
                    !evt.ctrlKey && !evt.altKey && !evt.shiftKey && !evt.metaKey) {
                const action = actionMap.get(evt.keyCode);
                if (action) {
                    this.layoutModel.dispatcher.dispatch({
                        actionType: action.actionName,
                        props: action.actionArgs
                    });
                }
            }
        });
    }

    private initUndoFunction():void {
        this.layoutModel.getModels().mainMenuModel.addItemActionPrerequisite(
            'MAIN_MENU_UNDO_LAST_QUERY_OP',
            (args:Kontext.GeneralProps) => {
                return new RSVP.Promise((resolve:(v)=>void, reject:(e)=>void) => {
                    window.history.back();
                });
            }
        )
    }

    private initTextTypesModel():TextTypes.ITextTypesModel {
        this.queryModels.textTypesModel = new TextTypesModel(
            this.layoutModel.dispatcher,
            this.layoutModel.pluginApi(),
            this.layoutModel.getConf<any>('textTypesData')
        );
        const concFormArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
        const queryFormArgs = fetchQueryFormArgs(concFormArgs);
        // we restore checked text types but with no bib-mapping; hidden IDs are enough here as
        // the pop-up query form does not display text-types form (yet the values are still
        // applied thanks to this).
        this.queryModels.textTypesModel.applyCheckedItems(queryFormArgs.selected_text_types, {});
        return this.queryModels.textTypesModel;
    }

    private initTokenDetail():RSVP.Promise<PluginInterfaces.TokenDetail.IPlugin> {
        if (this.layoutModel.pluginIsActive('token_detail')) {
            return tokenDetailInit(
                this.layoutModel.pluginApi(),
                this.layoutModel.getConf<Array<string>>('alignedCorpora')
            );

        } else {
            return new RSVP.Promise<any>(
                (resolve:(d)=>void, reject:(err)=>void) => {
                    resolve(null); // TODO is 'null' enough?
                }
            );
        }
    }

    private initModels(ttModel:TextTypes.ITextTypesModel, syntaxViewer:PluginInterfaces.ISyntaxViewer,
                tokenDetail:PluginInterfaces.TokenDetail.IPlugin):ViewConfiguration {

        const concSummaryProps:ConcSummary = {
            concSize: this.layoutModel.getConf<number>('ConcSize'),
            fullSize: this.layoutModel.getConf<number>('FullSize'),
            sampledSize: this.layoutModel.getConf<number>('SampledSize'),
            ipm: this.layoutModel.getConf<number>('ResultIpm'),
            arf: this.layoutModel.getConf<number>('ResultArf'),
            isShuffled: this.layoutModel.getConf<boolean>('ResultShuffled')
        };
        const corpIdent = this.layoutModel.getConf<Kontext.FullCorpusIdent>('corpusIdent');
        const lineViewProps:ViewConfiguration = {
            anonymousUser: this.layoutModel.getConf<boolean>('anonymousUser'),
            ViewMode: this.layoutModel.getConf<string>('ViewMode'),
            ShowLineNumbers: this.layoutModel.getConf<boolean>('ShowLineNumbers'),
            KWICCorps: this.layoutModel.getConf<Array<string>>('KWICCorps'),
            CorporaColumns: this.layoutModel.getConf<Array<Kontext.AttrItem>>('CorporaColumns').map(v =>
                        ({n: v.n, label: v.label, visible: true})),
            SortIdx: this.layoutModel.getConf<Array<{page:number; label:string}>>('SortIdx'),
            NumItemsInLockedGroups: this.layoutModel.getConf<number>('NumLinesInGroups'),
            baseCorpname: corpIdent.id,
            subCorpName: this.layoutModel.getConf<string>('subcorpname'),
            pagination: this.layoutModel.getConf<ServerPagination>('Pagination'),
            currentPage: this.layoutModel.getConf<number>('FromPage'),
            mainCorp: this.layoutModel.getConcArgs()['maincorp'],
            concSummary: concSummaryProps,
            Unfinished: this.layoutModel.getConf<boolean>('Unfinished'),
            FastAdHocIpm: this.layoutModel.getConf<boolean>('FastAdHocIpm'),
            canSendEmail: this.layoutModel.getConf<boolean>('canSendMail'),
            ShowConcToolbar: this.layoutModel.getConf<boolean>('ShowConcToolbar'),
            SpeakerIdAttr: this.layoutModel.getConf<[string, string]>('SpeakerIdAttr'),
            SpeakerColors: this.lineGroupsChart.extendBaseColorPalette(1),
            SpeechSegment: this.layoutModel.getConf<[string, string]>('SpeechSegment'),
            SpeechOverlapAttr: this.layoutModel.getConf<[string, string]>('SpeechOverlapAttr'),
            SpeechOverlapVal: this.layoutModel.getConf<string>('SpeechOverlapVal'),
            SpeechAttrs: this.layoutModel.getConf<Array<string>>('SpeechAttrs'),
            StructCtx: this.layoutModel.getConf<string>('StructCtx'),
            WideCtxGlobals: this.layoutModel.getConf<Array<[string, string]>>('WideCtxGlobals'),
            catColors: this.lineGroupsChart.extendBaseColorPalette(),
            useSafeFont: this.layoutModel.getConf<boolean>('ConcUseSafeFont'),
            supportsSyntaxView: this.layoutModel.pluginIsActive('syntax_viewer'),
            onSyntaxPaneReady: (tokenNumber, kwicLength) => {
                syntaxViewer.render(
                    document.getElementById('syntax-view-pane'),
                    tokenNumber,
                    kwicLength
                );
            },
            onSyntaxPaneClose: () => {
                syntaxViewer.close();
            }
        };

        this.viewModels = new ViewPageModels();
        this.viewModels.userInfoModel = this.layoutModel.getModels().userInfoModel;
        this.viewModels.mainMenuModel = this.layoutModel.getModels().mainMenuModel;
        this.viewModels.lineViewModel = new ConcLineModel(
                this.layoutModel,
                this.layoutModel.dispatcher,
                new ConcSaveModel(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    this.layoutModel.getConf<number>('ConcSize'),
                    s=>this.setDownloadLink(s)
                ),
                syntaxViewer,
                ttModel,
                lineViewProps,
                this.layoutModel.getConf<Array<ServerLineData>>('Lines')
        );
        this.layoutModel.getModels().corpusViewOptionsModel.addOnSave(
            (_) => this.viewModels.lineViewModel.updateOnCorpViewOptsChange());
        this.layoutModel.getModels().corpusViewOptionsModel.addOnSave(
            (data) => this.viewModels.concDetailModel.setWideCtxGlobals(data.widectx_globals));
        this.viewModels.lineSelectionModel = new LineSelectionModel(
                this.layoutModel,
                this.layoutModel.dispatcher,
                this.viewModels.lineViewModel,
                this.layoutModel.getModels().userInfoModel,
                conclines.openStorage(()=>{}),
                () => {
                    window.removeEventListener('beforeunload', this.handleBeforeUnload);
                }
        );
        this.viewModels.lineSelectionModel.registerQuery(this.layoutModel.getConf<Array<string>>('compiledQuery'));
        this.viewModels.concDetailModel = new ConcDetailModel(
            this.layoutModel,
            this.layoutModel.dispatcher,
            this.viewModels.lineViewModel,
            lineViewProps.StructCtx,
            {
                speakerIdAttr: lineViewProps.SpeakerIdAttr,
                speechSegment: lineViewProps.SpeechSegment,
                speechAttrs: lineViewProps.SpeechAttrs,
                speechOverlapAttr: lineViewProps.SpeechOverlapAttr,
                speechOverlapVal: lineViewProps.SpeechOverlapVal
            },
            lineViewProps.SpeakerColors,
            lineViewProps.WideCtxGlobals,
            tokenDetail
        );
        this.viewModels.refsDetailModel = new RefsDetailModel(
            this.layoutModel,
            this.layoutModel.dispatcher,
            this.viewModels.lineViewModel
        );
        this.viewModels.dashboardModel = new ConcDashboard(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.layoutModel.getModels().generalViewOptionsModel,
            {
                showTTOverview: !!this.layoutModel.getConf<number>('ShowTTOverview'),
                hasTTCrit: this.layoutModel.getConf<TTCrit>('TTCrit').length > 0
            }
        );
        this.viewModels.ttDistModel = new TextTypesDistModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.viewModels.lineViewModel,
            {
                ttCrit: this.layoutModel.getConf<TTCrit>('TTCrit')
            }
        );
        return lineViewProps;
    }

    setDownloadLink(url:string):void {
        const iframe = <HTMLIFrameElement>document.getElementById('download-frame');
        iframe.src = url;
    }

    /**
     *
     */
    init():void {
        const ttProm = this.layoutModel.init().then(
            () => {
                this.layoutModel.getModels().generalViewOptionsModel.addOnSubmitResponseHandler(
                    (optsModel) => {
                        this.viewModels.lineViewModel.updateOnGlobalViewOptsChange(optsModel);
                        this.viewModels.dashboardModel.updateOnGlobalViewOptsChange(optsModel);
                    }
                );
                return this.initTextTypesModel();
            }
        );
        const syntaxViewerProm = ttProm.then(
            () => {
                const sv = syntaxViewerInit(this.layoutModel.pluginApi());
                if (sv) {
                    return sv;
                }
                return new RSVP.Promise((resolve:(v)=>void, reject:(err)=>void) => {
                    resolve(new DummySyntaxViewModel(this.layoutModel.dispatcher));
                });
            }
        );

        const tokenDetailProp = ttProm.then(
            () => {
                return this.initTokenDetail()
            }
        );

        const p2 = RSVP.all([ttProm, syntaxViewerProm, tokenDetailProp]).then(
            (args) => {
                const [ttModel, sv, tokenDetailPlg] = args;
                const lineViewProps = this.initModels(
                    <TextTypesModel>ttModel,
                    <PluginInterfaces.ISyntaxViewer>sv,
                    <PluginInterfaces.TokenDetail.IPlugin>tokenDetailPlg
                );
                // we must handle non-React widgets:
                lineViewProps.onChartFrameReady = (usePrevData:boolean) => {
                    this.showGroupsStats(
                        <HTMLElement>document.querySelector('#selection-actions .chart-area'),
                        usePrevData
                    );
                };
                this.initUndoFunction();

            	this.concViews = concViewsInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.getComponentHelpers(),
                    this.viewModels
                );
                return lineViewProps;
            }
        );

        const p3 = p2.then(
            (lineViewProps) => {
                return this.renderLines(
                    lineViewProps
                );
            }
        );

        const p4 = p3.then(
            () => {
                this.setupHistoryOnPopState();
                this.onBeforeUnloadAsk();
                this.updateLocalAlignedCorpora();
            }
        );

        const queryStorageProm = p4.then(
            () => {
                const pageSize = this.layoutModel.getConf<number>('QueryHistoryPageNumRecords');
                return queryStoragePlugin(this.layoutModel.pluginApi(), 0, pageSize, pageSize);
            }
        );

        const tagHelperProm = p4.then(
            () => {
                return tagHelperPlugin(this.layoutModel.pluginApi());
            }
        );

        RSVP.all([ttProm, p2, queryStorageProm, tagHelperProm]).then(
            (args:any) => {
                const [ttModel, lvprops, qs, tagh] = args;
                this.initQueryForm();
                this.initFirsthitsForm();
                this.initFilterForm(this.queryModels.firstHitsModel);
                this.initSortForm();
                this.initSwitchMainCorpForm();
                this.initSampleForm(this.queryModels.switchMcModel);
                this.initQueryOverviewArea(tagh, qs);
                this.initAnalysisViews(<TextTypesModel>ttModel);
                this.updateMainMenu();
                this.initKeyShortcuts();
                this.updateHistory();
                if (this.layoutModel.getConf<boolean>('Unfinished')) {
                    this.reloadHits();
                }
            }

        ).then(
            this.layoutModel.addUiTestingFlag

        ).catch(
            (err) => console.error(err)
        );
    }
}

export function init(conf):void {
    const layoutModel = new PageModel(conf);
    const pageModel = new ViewPage(
        layoutModel,
        layoutModel.getConf<number>('NumLinesInGroups') > 0
    );
    pageModel.init();
};
