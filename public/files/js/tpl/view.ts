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
/// <reference path="../types/plugins/abstract.d.ts" />
/// <reference path="../../ts/declarations/modernizr.d.ts" />
/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../../ts/declarations/soundmanager.d.ts" />
/// <reference path="../../ts/declarations/d3.d.ts" />
/// <reference path="../../ts/declarations/d3-color.d.ts" />
/// <reference path="../types/views.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />

import * as $ from 'jquery';
import {PageModel} from './document';
import {MultiDict, parseUrlArgs, updateProps} from '../util';
import * as popupBox from '../popupbox';
import * as conclines from '../conclines';
import {init as concViewsInit, ConcordanceView} from 'views/concordance/main';
import {LineSelectionStore} from '../stores/concordance/lineSelection';
import {ConcDetailStore, RefsDetailStore} from '../stores/concordance/detail';
import {ConcLineStore, ServerLineData, ViewConfiguration, ServerPagination, ConcSummary} from '../stores/concordance/lines';
import {QueryFormProperties, QueryFormUserEntries, QueryStore, QueryHintStore} from '../stores/query/main';
import {QueryReplayStore, LocalQueryFormData} from '../stores/query/replay';
import {FilterStore, FilterFormProperties, fetchFilterFormArgs} from '../stores/query/filter';
import {SampleStore, SampleFormProperties, fetchSampleFormArgs} from '../stores/query/sample';
import {TextTypesStore} from '../stores/textTypes/attrValues';
import {WithinBuilderStore} from '../stores/query/withinBuilder';
import {VirtualKeyboardStore} from '../stores/query/virtualKeyboard';
import {QueryContextStore} from '../stores/query/context';
import {SortStore, MultiLevelSortStore, SortFormProperties, fetchSortFormArgs, importMultiLevelArg} from '../stores/query/sort';
import {CollFormStore, CollFormProps} from '../stores/analysis/collForm';
import {MLFreqFormStore, TTFreqFormStore, FreqFormProps} from '../stores/freqs/freqForms';
import {ContingencyTableStore, ContingencyTableFormProperties} from '../stores/freqs/ctable';
import tagHelperPlugin from 'plugins/taghelper/init';
import queryStoragePlugin from 'plugins/queryStorage/init';
import * as SoundManager from 'SoundManager';
import * as d3 from 'vendor/d3';
import * as d3Color from 'vendor/d3-color';
import * as syntaxViewer from 'plugins/syntaxViewer/init';
import {UserSettings} from '../userSettings';
import * as applicationBar from 'plugins/applicationBar/init';
import * as RSVP from 'vendor/rsvp';
import {UserInfo} from '../stores/userStores';
import {ViewOptionsStore} from '../stores/viewOptions';
import {init as queryFormInit, QueryFormViews} from 'views/query/main';
import {init as filterFormInit, FilterFormViews} from 'views/query/filter';
import {init as queryOverviewInit, QueryToolbarViews} from 'views/query/overview';
import {init as sortFormInit, SortFormViews} from 'views/query/sort';
import {init as sampleFormInit, SampleFormViews} from 'views/query/sampleShuffle';
import {init as analysisFrameInit, AnalysisFrameViews} from 'views/analysis/frame';
import {init as collFormInit, CollFormViews} from 'views/analysis/coll';
import {init as freqFormInit, FreqFormViews} from 'views/analysis/freq';
import {init as structsAttrsViewInit, StructsAndAttrsViews} from 'views/options/structsAttrs';

declare var Modernizr:Modernizr.ModernizrStatic;

export class ViewPageStores {
    lineSelectionStore:LineSelectionStore;
    lineViewStore:ConcLineStore;
    concDetailStore:ConcDetailStore;
    refsDetailStore:RefsDetailStore;
    userInfoStore:Kontext.IUserInfoStore;
    viewOptionsStore:ViewOptions.IViewOptionsStore;
    collFormStore:CollFormStore;
    mainMenuStore:Kontext.IMainMenuStore;
}

export class QueryStores {
    queryStore:QueryStore;
    filterStore:FilterStore;
    textTypesStore:TextTypesStore;
    queryHintStore:QueryHintStore;
    withinBuilderStore:WithinBuilderStore;
    virtualKeyboardStore:VirtualKeyboardStore;
    queryContextStore:QueryContextStore;
    queryReplayStore:QueryReplayStore;
    sortStore:SortStore;
    multiLevelSortStore:MultiLevelSortStore;
    sampleStore:SampleStore;
}

type LineGroupChartData = Array<{groupId:number; group:string; count:number}>;

type LineGroupStats = {[groupId:number]:number};

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

    private viewStores:ViewPageStores;

    private queryStores:QueryStores;

    private hasLockedGroups:boolean;

    private concViews:ConcordanceView;

    private analysisViews:AnalysisFrameViews;

    private lastGroupStats:LineGroupStats; // group stats cache

    private queryFormViews:QueryFormViews;

    private queryOverviewViews:QueryToolbarViews;

    private filterFormViews:FilterFormViews;

    private sortFormViews:SortFormViews;

    private sampleFormViews:SampleFormViews;

    private concFormsInitialArgs:AjaxResponse.ConcFormsInitialArgs;

    private collFormStore:CollFormStore;

    private collFormViews:CollFormViews;

    private mlFreqStore:MLFreqFormStore;

    private ttFreqStore:TTFreqFormStore;

    private ctFreqStore:ContingencyTableStore;

    private freqFormViews:FreqFormViews;

    private viewOptionsViews:StructsAndAttrsViews;

    /**
     * Color scheme derived from d3.schemeCategory20
     * by changing the order.
     */
    private static BASE_COLOR_SCHEME = [
        "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
        "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"
    ];

    /**
     *
     * @param layoutModel
     * @param stores
     * @param hasLockedGroups
     */
    constructor(layoutModel:PageModel, hasLockedGroups:boolean) {
        this.layoutModel = layoutModel;
        this.queryStores = new QueryStores();
        this.hasLockedGroups = hasLockedGroups;
        this.concFormsInitialArgs = this.layoutModel.getConf<AjaxResponse.ConcFormsInitialArgs>('ConcFormsInitialArgs');
    }

    /**
     * @todo this must be tuned quite a bit to make
     * categories and chart elements distinguishable
     */
    private extendBaseColorPalette(offset:number=0):Array<string> {
        const ans:Array<string> = ['RGB(0, 0, 0)']; // we don't use the first color
        const coeff = [0, 0.7, 1.2, 1.8, 2.1, 2.2, 2.3, 2.3, 2.3, 2.3];
        for (let i = 0; i < 10; i += 1) {
            ViewPage.BASE_COLOR_SCHEME.forEach((color, j) => {
                const c = d3Color.color(color);
                ans.push(c.brighter(coeff[i]).toString());
            });
        }
        return ans.slice(offset);
    }

    private translate(s:string, values?:any):string {
        return this.layoutModel.translate(s, values);
    }

    private deserializeHashAction(v:string):Kontext.DispatcherPayload {
        const tmp = v.substr(1).split('/');
        const args = tmp[1] ? new MultiDict(parseUrlArgs(tmp[1])) : undefined;
        return this.createFormAction(tmp[0], args);
    }

    private createFormAction(actionName:string, args:Kontext.IMultiDict):Kontext.DispatcherPayload {
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
        const self = this;

        function renderChart(data:LineGroupChartData):Array<string> {
            const width = 200;
            const height = 200;
            const radius = Math.min(width, height) / 2;
            const color = self.extendBaseColorPalette();
            const arc = d3.arc()
                .outerRadius(radius - 10)
                .innerRadius(0);
            const labelArc = d3.arc()
                .outerRadius(radius - 40)
                .innerRadius(radius - 40);
            const pie = d3.pie()
                .value((d) => d['count'])
                .sort(null);

            const pieData = pie(data);
            const wrapper = d3.select(rootElm).append('svg')
                .attr('width', width)
                .attr('height', height)
                .attr('class', 'chart')
                .append('g')
                    .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')')
                    .attr('class', 'chart-wrapper');

            const g = wrapper.selectAll('.arc')
                .data(pieData).enter()
                    .append('g')
                    .attr('class', 'arc');

            g.append('path')
                .attr('d', arc)
                .style('fill', (d:any) => color[d.data['groupId']]);

            if (pieData.length <= 5) { // direct labels only for small num of portions
                g.append('text')
                    .attr('transform', (d:any) => ('translate(' + labelArc.centroid(d) + ')'))
                    .text((d:any) => d.data['group']);
            }
            return color;
        }

        function renderLabels(data:LineGroupChartData, colors:Array<string>, rootElm:HTMLElement):void {
            const labelWrapper:HTMLElement = window.document.createElement('table');
            const tbody:HTMLElement = window.document.createElement('tbody');

            function addElm(name:string, parent:HTMLElement):HTMLElement {
                const elm = window.document.createElement(name);
                $(parent).append(elm);
                return elm;
            }

            const total = data.reduce((prev, curr)=>(prev + curr['count']), 0);

            function percentage(item) {
                return (item['count'] / total * 100).toFixed(1) + '%';
            }

            $(labelWrapper)
                .addClass('chart-label')
                .append(tbody);

            data
                .sort((x1, x2) => x1.groupId > x2.groupId ? 1 : -1)
                .forEach((item, i) => {
                    const trElm = addElm('tr', tbody);
                    const td1Elm = addElm('td', trElm);
                    const td2Elm = addElm('th', trElm);
                    const td3Elm = addElm('td', trElm);
                    const td4Elm = addElm('td', trElm);
                    $(td1Elm)
                        .addClass('label-text')
                        .css({'background-color': colors[item.groupId]})
                        .addClass('color-code')
                        .text('\u00A0');
                    $(td2Elm)
                        .addClass('num')
                        .append(item['group']);
                    $(td3Elm)
                        .addClass('num')
                        .append(percentage(item));
                    $(td4Elm)
                        .addClass('num')
                        .append('(' + item['count'] + 'x)');
                });
            $(rootElm).append(labelWrapper);
        }

        let prom:RSVP.Promise<LineGroupStats>;
        if (this.lastGroupStats && usePrevData) {
            prom = new RSVP.Promise<LineGroupStats>((resolve:(v:any)=>void, reject:(e:any)=>void) => {
                resolve(this.lastGroupStats);
            });

        } else {
            prom = this.layoutModel.ajax<LineGroupStats>(
                'GET',
                this.layoutModel.createActionUrl(
                    'ajax_get_line_groups_stats',
                    this.layoutModel.getConcArgs().items()
                ),
                {},
                {contentType : 'application/x-www-form-urlencoded'}

            ).then(
                (data) => {
                    this.lastGroupStats = data;
                    return data;
                }
            );
        }

        prom.then(
            (data) => {
                const chartData:LineGroupChartData = [];
                for (let p in data) {
                    chartData.push({
                        groupId: parseInt(p, 10),
                        group: `#${p}`,
                        count: data[p]
                    });
                }
                $(rootElm).empty(); // remove loader
                $(rootElm).append(
                    '<legend>' + self.translate('linesel__groups_stats_heading') + '</legend>'
                );
                const colors = renderChart(chartData);
                renderLabels(chartData, colors, rootElm);
            },
            (err) => {
                self.layoutModel.showMessage('error', err);
            }
        );
    }

    /**
     * User must be notified in case he wants to leave the page but at the same time he
     * has selected some concordance lines without using them in a filter.
     */
    private onBeforeUnloadAsk():any {
        let self = this;
        $(window).on('beforeunload.alert_unsaved', function (event:any) {
            if (self.viewStores.lineSelectionStore.size() > 0) {
                event.returnValue = self.translate('global__are_you_sure_to_leave');
                return event.returnValue;
            }
            return undefined; // !! any other value will cause the dialog window to be shown
        });
    }

    /**
     * Let's bother poor user with a notification in
     * case she is not logged-in.
     */
    private anonymousUserWarning():void {
        const self = this;
        const box = popupBox.extended(this.layoutModel).open(
            this.translate('global__anonymous_user_warning',
            {login_url: this.layoutModel.getConf('loginUrl')}),
            {top: 0, left: 0},
            {
                type: 'warning',
                onShow: function () {
                    $(this.getRootElement()).find('a.fast-login').on('click', (evt:JQueryEventObject) => {
                        $(evt.target).attr('href', null);
                        self.layoutModel.dispatcher.dispatch({
                            actionType: 'USER_SHOW_LOGIN_DIALOG',
                            props: {}
                        });
                        evt.preventDefault();
                    });
                }
            }
        );
        const left = $(window).width() / 2 - box.getPosition().width / 2;
        const top = $('#conc-wrapper').offset().top + 40;
        box.setCss('left', left + 'px');
        box.setCss('top', top + 'px');
        box.setCss('font-size', '120%');
        box.setCss('height', '70px');
    }

    attachMouseWheelEvents(area, fn):void {
        area = $(area).get(0);
        area.addEventListener('mousewheel', fn, false);
	    // Firefox
	    area.addEventListener('DOMMouseScroll', fn, false);
    }

    /**
     *
     */
    private setupHistoryOnPopState():void {
        // register event to load lines via ajax in case user hits back
        this.layoutModel.history.setOnPopState((event) => {
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
                this.layoutModel.renderReactComponent(this.concViews.ConcordanceView,
                    window.document.getElementById('conc-wrapper'), props);

            } catch (e) {
                console.error(e.stack);
                throw e;
            }
        });
        return ans;
    }

    /**
     *
     */
    reloadHits():void {
        const loop = (idx:number, delay:number, decay:number) => {
            window.setTimeout(() => {
                this.layoutModel.ajax(
                    'GET',
                    this.layoutModel.createActionUrl('get_cached_conc_sizes'),
                    this.layoutModel.getConcArgs()

                ).then(
                    (data:AjaxResponse.ConcStatus) => {
                        if (data.end) { // TODO what is this for?
                            delay = 5;
                        }

                        $('#result-info span.ipm').html(this.layoutModel.formatNumber(data.relconcsize));
                        this.layoutModel.dispatcher.dispatch({
                            actionType: 'CONCORDANCE_UPDATE_NUM_AVAIL_PAGES',
                            props: {
                                availPages: Math.ceil(data.concsize / this.layoutModel.getConf<number>('numLines'))
                            }
                        });
                        if (!data.finished) {
                            if (data.fullsize > 0) {
                                this.layoutModel.dispatcher.dispatch({
                                    actionType: 'CONCORDANCE_ASYNC_CALCULATION_UPDATED',
                                    props: {
                                        finished: false,
                                        concsize: data.concsize,
                                        fullsize: data.fullsize
                                    }
                                });
                            }
                            if (idx < ViewPage.CHECK_CONC_MAX_ATTEMPTS) {
                                loop(idx + 1, delay * decay, decay);
                            }

                        } else {
                            this.layoutModel.dispatcher.dispatch({
                                actionType: 'CONCORDANCE_ASYNC_CALCULATION_UPDATED',
                                props: {
                                    finished: true,
                                    concsize: data.concsize,
                                    fullsize: data.fullsize
                                }
                            });
                            /* We are unable to update ARF on the fly which means we
                            * have to reload the page after all the server calculations are finished.
                            */
                            //win.location.reload();
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
                this.layoutModel.history.replaceState(
                    'view',
                    this.layoutModel.getConcArgs(),
                    {
                        modalAction: {
                            actionType: 'EDIT_QUERY_OPERATION',
                            props: {
                                operationIdx: this.queryStores.queryReplayStore.getNumOperations() - 1
                            }
                        }
                    },
                    window.document.title
                );
                this.layoutModel.history.pushState(
                    'view',
                    this.layoutModel.getConcArgs(),
                    {
                        pagination: true,
                        pageNum: this.viewStores.lineViewStore.getCurrentPage()
                    },
                    window.document.title
                );
            break;
            default:
                this.layoutModel.history.replaceState(
                    'view',
                    this.layoutModel.getConcArgs(),
                    {
                        pagination: true,
                        pageNum: this.viewStores.lineViewStore.getCurrentPage()
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

    private fetchQueryFormKey(data:{[ident:string]:AjaxResponse.ConcFormArgs}):string {
        for (let p in data) {
            if (data.hasOwnProperty(p) && data[p].form_type === 'query') {
                return p;
            }
        }
        return null;
    }

    private fetchQueryFormArgs(data:{[ident:string]:AjaxResponse.ConcFormArgs}):AjaxResponse.QueryFormArgsResponse {
        const k = this.fetchQueryFormKey(data);
        if (k !== null) {
            return <AjaxResponse.QueryFormArgsResponse>data[k];

        } else {
            return {
                contains_errors: false,
                messages: [],
                form_type: 'query',
                op_key: '__new__',
                curr_query_types: {},
                curr_queries: {},
                curr_pcq_pos_neg_values: {},
                curr_lpos_values: {},
                curr_qmcase_values: {},
                curr_default_attr_values: {},
                tag_builder_support: {}
            };
        }
    }

    private initQueryForm():void {
        const textTypesData = this.layoutModel.getConf<any>('textTypesData');
        this.queryStores.textTypesStore = new TextTypesStore(
            this.layoutModel.dispatcher,
            this.layoutModel.pluginApi(),
            textTypesData,
            this.layoutModel.getConf<TextTypes.ServerCheckedValues>('CheckedSca')
        );

        this.queryStores.queryHintStore = new QueryHintStore(
            this.layoutModel.dispatcher,
            this.layoutModel.getConf<Array<string>>('queryHints')
        );
        this.queryStores.withinBuilderStore = new WithinBuilderStore(this.layoutModel.dispatcher,
                this.layoutModel);
        this.queryStores.virtualKeyboardStore = new VirtualKeyboardStore(this.layoutModel.dispatcher,
                this.layoutModel);
        this.queryStores.queryContextStore = new QueryContextStore(this.layoutModel.dispatcher);

        const concFormArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
        const queryFormArgs = this.fetchQueryFormArgs(concFormArgs);

        const queryFormProps:QueryFormProperties = {
            corpora: this.getActiveCorpora(),
            availableAlignedCorpora: this.layoutModel.getConf<Array<{n:string; label:string}>>('availableAlignedCorpora'),
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
            lposlist: this.layoutModel.getConf<Array<{v:string; n:string}>>('Lposlist'),
            forcedAttr: this.layoutModel.getConf<string>('ForcedAttr'),
            attrList: this.layoutModel.getConf<Array<{n:string; label:string}>>('AttrList'),
            tagsetDocUrl: this.layoutModel.getConf<string>('TagsetDocUrl'),
            lemmaWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
            posWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
            hasLemmaAttr: this.layoutModel.getConf<boolean>('hasLemmaAttr'),
            wPoSList: this.layoutModel.getConf<Array<{v:string; n:string}>>('Wposlist'),
            inputLanguages: this.layoutModel.getConf<{[corpname:string]:string}>('InputLanguages'),
            textTypesNotes: this.layoutModel.getConf<string>('TextTypesNotes')
        };

        this.queryStores.queryStore = new QueryStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.queryStores.textTypesStore,
            this.queryStores.queryContextStore,
            queryFormProps
        );

        this.queryFormViews = queryFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.queryStores.queryStore,
            this.queryStores.textTypesStore,
            this.queryStores.queryHintStore,
            this.queryStores.withinBuilderStore,
            this.queryStores.virtualKeyboardStore,
            this.queryStores.queryContextStore
        );

    }

    private initFilterForm():void {
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
            lposlist: this.layoutModel.getConf<Array<{v:string; n:string}>>('Lposlist'),
            forcedAttr: this.layoutModel.getConf<string>('ForcedAttr'),
            attrList: this.layoutModel.getConf<Array<{n:string; label:string}>>('AttrList'),
            tagsetDocUrl: this.layoutModel.getConf<string>('TagsetDocUrl'),
            lemmaWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
            posWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
            hasLemmaAttr: this.layoutModel.getConf<boolean>('hasLemmaAttr'),
            wPoSList: this.layoutModel.getConf<Array<{v:string; n:string}>>('Wposlist'),
            inputLanguage: this.layoutModel.getConf<{[corpname:string]:string}>('InputLanguages')[this.layoutModel.getConf<string>('corpname')],
            opLocks: fetchArgs<boolean>(item => item.form_type === 'locked')
        }

        this.queryStores.filterStore = new FilterStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.queryStores.textTypesStore,
            this.queryStores.queryContextStore,
            filterFormProps
        );

        this.layoutModel.getStores().mainMenuStore.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_FILTER',
            (args:Kontext.GeneralProps) => {
                if (args['within'] === 1) {
                    this.layoutModel.replaceConcArg('maincorp', [args['maincorp']]);
                }
                return this.queryStores.filterStore.syncFrom(() => {
                    return new RSVP.Promise<AjaxResponse.FilterFormArgs>((resolve:(v)=>void, reject:(err)=>void) => {
                        resolve(updateProps(this.concFormsInitialArgs.filter, args));
                    });
                });
            }
        );

        this.filterFormViews = filterFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.queryStores.filterStore,
            this.queryStores.queryHintStore,
            this.queryStores.withinBuilderStore,
            this.queryStores.virtualKeyboardStore
        );
    }

    private initSortForm():void {
        const concFormsArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
        const fetchArgs = <T>(key:(item:AjaxResponse.SortFormArgs)=>T):Array<[string, T]>=>fetchSortFormArgs(concFormsArgs, key);
        const availAttrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList');

        const sortStoreProps:SortFormProperties = {
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

        this.queryStores.sortStore = new SortStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            sortStoreProps
        );
        this.queryStores.multiLevelSortStore = new MultiLevelSortStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            sortStoreProps
        );
        this.layoutModel.getStores().mainMenuStore.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_SORT',
            (args:Kontext.GeneralProps) => {
                return this.queryStores.sortStore.syncFrom(() => {
                    return new RSVP.Promise<AjaxResponse.SortFormArgs>((resolve:(v)=>void, reject:(err)=>void) => {
                        resolve(updateProps(this.concFormsInitialArgs.sort, args));
                    });
                }).then(
                    () => {
                        this.queryStores.multiLevelSortStore.syncFrom(() => {
                            return new RSVP.Promise<AjaxResponse.SortFormArgs>((resolve:(v)=>void, reject:(err)=>void) => {
                                resolve(updateProps(this.concFormsInitialArgs.sort, args));
                            });
                        });
                    }
                );
            }
        );

        this.sortFormViews = sortFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.queryStores.sortStore,
            this.queryStores.multiLevelSortStore
        );
    }

    private initSampleForm():void {
        const concFormsArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
        const fetchArgs = <T>(key:(item:AjaxResponse.SampleFormArgs)=>T):Array<[string, T]>=>fetchSampleFormArgs(concFormsArgs, key);

        const sampleStoreProps:SampleFormProperties = {
            rlines: fetchArgs<number>(item => item.rlines)
        };

        this.queryStores.sampleStore = new SampleStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            sampleStoreProps
        );
        this.layoutModel.getStores().mainMenuStore.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_SAMPLE',
            (args:Kontext.GeneralProps) => {
                return this.queryStores.sampleStore.syncFrom(() => {
                    return new RSVP.Promise<AjaxResponse.SampleFormArgs>((resolve:(v)=>void, reject:(err)=>void) => {
                        resolve(updateProps(this.concFormsInitialArgs.sample, args));
                    });
                });
            }
        );

        this.sampleFormViews = sampleFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.queryStores.sampleStore
        );
    }

    /**
     *
     */
    initQueryOverviewArea():void {
        this.queryStores.queryReplayStore = new QueryReplayStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            {
                queryStore: this.queryStores.queryStore,
                filterStore: this.queryStores.filterStore,
                sortStore: this.queryStores.sortStore,
                mlSortStore: this.queryStores.multiLevelSortStore,
                sampleStore: this.queryStores.sampleStore
            },
            this.layoutModel.getConf<Array<Kontext.QueryOperation>>('queryOverview') || [],
            this.layoutModel.getConf<LocalQueryFormData>('ConcFormsArgs')
        );
        this.queryOverviewViews = queryOverviewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            {
                QueryFormView: this.queryFormViews.QueryFormLite,
                FilterFormView: this.filterFormViews.FilterForm,
                SortFormView: this.sortFormViews.SortFormView,
                SampleFormView: this.sampleFormViews.SampleFormView,
                ShuffleFormView: this.sampleFormViews.ShuffleFormView
            },
            this.queryStores.queryReplayStore,
            this.layoutModel.getStores().mainMenuStore
        );

        this.layoutModel.renderReactComponent(
            this.queryOverviewViews.QueryToolbar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getConf<string>('corpname'),
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                usesubcorp: this.layoutModel.getConf<string>('subcorpname'),
                queryFormProps: {
                    corpname: this.layoutModel.getConf<string>('corpname'),
                    tagHelperViews: tagHelperPlugin.getViews(),
                    queryStorageViews: queryStoragePlugin.getViews(),
                    allowCorpusSelection: false,
                    actionPrefix: ''
                },
                filterFormProps: {
                    tagHelperViews: tagHelperPlugin.getViews(),
                    queryStorageViews: queryStoragePlugin.getViews(),
                    allowCorpusSelection: false,
                    actionPrefix: 'FILTER_'
                },
                sortFormProps: {
                },
                shuffleFormProps: {
                    shuffleMinResultWarning: this.layoutModel.getConf<number>('ShuffleMinResultWarning'),
                    shuffleSubmitFn: () => {
                        const args = this.layoutModel.getConcArgs();
                        window.location.href = this.layoutModel.createActionUrl('shuffle', args.items());
                    }
                }
            }
        );
    }


    initAnalysisViews():void {
        const attrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList');
        // ------------------ coll ------------
        this.collFormStore = new CollFormStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            {
                attrList: attrs,
                cattr: attrs[0].n,
                cfromw: '-1',
                ctow: '0',
                cminfreq: '5',
                cminbgr: '3',
                cbgrfns: ['t', 'm'],
                csortfn: 't'
            }
        );
        this.collFormViews = collFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.collFormStore
        );
        // ------------------ freq ------------
        const structAttrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList');
        const freqFormProps:FreqFormProps = {
            structAttrList: structAttrs,
            fttattr: [],
            ftt_include_empty: false,
            flimit: '1',
            freq_sort: 'freq',
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

        // ------------------ contingency table ----------
        const ctFormProps:ContingencyTableFormProperties = {
            attrList: attrs,
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
            attr1: attrs[0].n,
            attr2: attrs[0].n
        };


        this.ctFreqStore = new ContingencyTableStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps
        );
        this.freqFormViews = freqFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.mlFreqStore,
            this.ttFreqStore,
            this.ctFreqStore
        );
        this.analysisViews = analysisFrameInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.collFormViews,
            this.freqFormViews,
            this.layoutModel.getStores().mainMenuStore
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
                this.layoutModel.getStores().mainMenuStore.disableMenuItem('menu-filter');
                this.layoutModel.getStores().mainMenuStore.disableMenuItem('menu-concordance', 'sorting');
                this.layoutModel.getStores().mainMenuStore.disableMenuItem('menu-concordance', 'shuffle');
                this.layoutModel.getStores().mainMenuStore.disableMenuItem('menu-concordance', 'sample');

            } else {
                this.layoutModel.getStores().mainMenuStore.enableMenuItem('menu-filter');
                this.layoutModel.getStores().mainMenuStore.enableMenuItem('menu-concordance', 'sorting');
                this.layoutModel.getStores().mainMenuStore.enableMenuItem('menu-concordance', 'shuffle');
                this.layoutModel.getStores().mainMenuStore.enableMenuItem('menu-concordance', 'sample');
            }
        };
        updateMenu(this.layoutModel.getConf<number>('NumLinesInGroups'));
        this.layoutModel.addConfChangeHandler<number>('NumLinesInGroups', updateMenu);
    }

    private initViewOptions():void {
        this.viewOptionsViews = structsAttrsViewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.viewStores.viewOptionsStore,
            this.viewStores.mainMenuStore
        );

        this.layoutModel.renderReactComponent(
            this.viewOptionsViews.StructAttrsViewOptions,
            window.document.getElementById('view-options-mount'),
            {
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                isSubmitMode: true,
                stateArgs: this.layoutModel.getConcArgs().items()
            }
        );

        this.layoutModel.getStores().mainMenuStore.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS',
            (args:Kontext.GeneralProps) => {
                return this.layoutModel.getStores().viewOptionsStore.loadData();
            }
        );
    }

    private initUndoFunction():void {
        this.layoutModel.getStores().mainMenuStore.addItemActionPrerequisite(
            'MAIN_MENU_UNDO_LAST_QUERY_OP',
            (args:Kontext.GeneralProps) => {
                return new RSVP.Promise((resolve:(v)=>void, reject:(e)=>void) => {
                    window.history.back();
                });
            }
        )
    }

    private initStores():ViewConfiguration {
        const concSummaryProps:ConcSummary = {
            concSize: this.layoutModel.getConf<number>('ConcSize'),
            fullSize: this.layoutModel.getConf<number>('FullSize'),
            sampledSize: this.layoutModel.getConf<number>('SampledSize'),
            ipm: this.layoutModel.getConf<number>('ResultIpm'),
            arf: this.layoutModel.getConf<number>('ResultArf'),
            isShuffled: this.layoutModel.getConf<boolean>('ResultShuffled')
        };
        const lineViewProps:ViewConfiguration = {
            ViewMode: this.layoutModel.getConf<string>('ViewMode'),
            ShowLineNumbers: this.layoutModel.getConf<boolean>('ShowLineNumbers'),
            KWICCorps: this.layoutModel.getConf<Array<string>>('KWICCorps'),
            CorporaColumns: this.layoutModel.getConf<Array<{n:string; label:string}>>('CorporaColumns'),
            SortIdx: this.layoutModel.getConf<Array<{page:number; label:string}>>('SortIdx'),
            NumItemsInLockedGroups: this.layoutModel.getConf<number>('NumLinesInGroups'),
            baseCorpname: this.layoutModel.getConf<string>('corpname'),
            subCorpName: this.layoutModel.getConf<string>('subcorpname'),
            pagination: this.layoutModel.getConf<ServerPagination>('Pagination'),
            currentPage: this.layoutModel.getConf<number>('FromPage'),
            mainCorp: this.layoutModel.getConcArgs()['maincorp'],
            concSummary: concSummaryProps,
            Unfinished: this.layoutModel.getConf<boolean>('Unfinished'),
            canSendEmail: this.layoutModel.getConf<boolean>('can_send_mail'),
            ContainsWithin: this.layoutModel.getConf<boolean>('ContainsWithin'),
            ShowConcToolbar: this.layoutModel.getConf<boolean>('ShowConcToolbar'),
            SpeakerIdAttr: this.layoutModel.getConf<[string, string]>('SpeakerIdAttr'),
            SpeakerColors: this.extendBaseColorPalette(1),
            SpeechSegment: this.layoutModel.getConf<[string, string]>('SpeechSegment'),
            SpeechOverlapAttr: this.layoutModel.getConf<[string, string]>('SpeechOverlapAttr'),
            SpeechOverlapVal: this.layoutModel.getConf<string>('SpeechOverlapVal'),
            SpeechAttrs: this.layoutModel.getConf<Array<string>>('SpeechAttrs'),
            StructCtx: this.layoutModel.getConf<string>('StructCtx'),
            WideCtxGlobals: this.layoutModel.getConf<Array<[string, string]>>('WideCtxGlobals'),
            catColors: this.extendBaseColorPalette()
        };
        this.viewStores = new ViewPageStores();
        this.viewStores.userInfoStore = this.layoutModel.getStores().userInfoStore;
        this.viewStores.viewOptionsStore = this.layoutModel.getStores().viewOptionsStore;
        this.viewStores.mainMenuStore = this.layoutModel.getStores().mainMenuStore;
        this.viewStores.lineViewStore = new ConcLineStore(
                this.layoutModel,
                this.layoutModel.dispatcher,
                lineViewProps,
                this.layoutModel.getConf<Array<ServerLineData>>('Lines')
        );
        this.viewStores.viewOptionsStore.addOnSave((_) => this.viewStores.lineViewStore.updateOnViewOptsChange());
        this.viewStores.viewOptionsStore.addOnSave((data) => this.viewStores.concDetailStore.setWideCtxGlobals(data.widectx_globals));
        this.viewStores.lineSelectionStore = new LineSelectionStore(
                this.layoutModel,
                this.layoutModel.dispatcher,
                this.viewStores.lineViewStore,
                conclines.openStorage(()=>{})
        );
        this.viewStores.lineSelectionStore.registerQuery(this.layoutModel.getConf<Array<string>>('compiledQuery'));
        this.viewStores.concDetailStore = new ConcDetailStore(
            this.layoutModel,
            this.layoutModel.dispatcher,
            this.viewStores.lineViewStore,
            lineViewProps.StructCtx,
            {
                speakerIdAttr: lineViewProps.SpeakerIdAttr,
                speechSegment: lineViewProps.SpeechSegment,
                speechAttrs: lineViewProps.SpeechAttrs,
                speechOverlapAttr: lineViewProps.SpeechOverlapAttr,
                speechOverlapVal: lineViewProps.SpeechOverlapVal
            },
            lineViewProps.SpeakerColors,
            lineViewProps.WideCtxGlobals
        );
        this.viewStores.refsDetailStore = new RefsDetailStore(
            this.layoutModel,
            this.layoutModel.dispatcher,
            this.viewStores.lineViewStore
        );
        return lineViewProps;
    }

    /**
     *
     */
    init():RSVP.Promise<any> {
        this.extendBaseColorPalette();
        return this.layoutModel.init().then(
            () => {
                const lineViewProps = this.initStores();
                // we must handle non-React widgets:
                lineViewProps.onChartFrameReady = (usePrevData:boolean) => {
                    let frame = window.document.getElementById('selection-actions');
                    this.showGroupsStats($(frame).find('.chart-area').get(0), usePrevData);
                };
                lineViewProps.onPageUpdate = () => {
                    syntaxViewer.create(this.layoutModel.pluginApi());
                };
                this.initUndoFunction();

            	this.concViews = concViewsInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.exportMixins(),
                    this.layoutModel.layoutViews,
                    this.viewStores
                );

                return this.renderLines(lineViewProps);
            }
        ).then(
            () => {
                this.setupHistoryOnPopState();
                if (this.layoutModel.getConf('anonymousUser')) {
                    this.anonymousUserWarning();
                }
                this.onBeforeUnloadAsk();
                this.updateLocalAlignedCorpora();
                syntaxViewer.create(this.layoutModel.pluginApi());
            }
        ).then(
            () => {
                tagHelperPlugin.create(this.layoutModel.pluginApi());
            }
        ).then(
            () => {
                queryStoragePlugin.create(this.layoutModel.pluginApi());
            }
        ).then(
            () => {
                this.initQueryForm();
                this.initFilterForm();
                this.initSortForm();
                this.initSampleForm();
                this.initQueryOverviewArea();
                this.initAnalysisViews();
                this.updateMainMenu();
                this.initViewOptions();
                this.updateHistory();
            }
        );
    }
}

export function init(conf):ViewPage {
    const layoutModel = new PageModel(conf);
    const pageModel = new ViewPage(
        layoutModel,
        layoutModel.getConf<number>('NumLinesInGroups') > 0
    );
    pageModel.init().then(
        _ => undefined,
        (err) => {
            console.error(err);
            layoutModel.showMessage('error', err);
        }
    )
    return pageModel;
};
