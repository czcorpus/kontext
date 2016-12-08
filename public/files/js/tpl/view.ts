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

/**
 * This module contains functionality related directly to the first_form.tmpl template
 */

/// <reference path="../types/common.d.ts" />
/// <reference path="../types/ajaxResponses.d.ts" />
/// <reference path="../types/plugins/abstract.d.ts" />
/// <reference path="../../ts/declarations/modernizr.d.ts" />
/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../../ts/declarations/soundmanager.d.ts" />
/// <reference path="../../ts/declarations/d3.d.ts" />
/// <reference path="../types/views.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />

import * as $ from 'jquery';
import {PageModel} from './document';
import * as popupBox from '../popupbox';
import * as conclines from '../conclines';
import {init as concViewsInit, ConcordanceView} from 'views/concordance/main';
import {LineSelectionStore} from '../stores/concordance/lineSelection';
import {ConcDetailStore, RefsDetailStore} from '../stores/concordance/detail';
import {ConcLineStore, ServerLineData, ViewConfiguration, ServerPagination, ConcSummary} from '../stores/concordance/lines';
import {QueryFormProperties, QueryStore, QueryHintStore} from '../stores/query/main';
import {TextTypesStore} from '../stores/textTypes/attrValues';
import {WithinBuilderStore} from '../stores/query/withinBuilder';
import {VirtualKeyboardStore} from '../stores/query/virtualKeyboard';
import {QueryContextStore} from '../stores/query/context';
import tagHelperPlugin from 'plugins/taghelper/init';
import queryStoragePlugin from 'plugins/queryStorage/init';
import * as SoundManager from 'SoundManager';
import * as d3 from 'vendor/d3';
import * as syntaxViewer from 'plugins/syntaxViewer/init';
import {UserSettings} from '../userSettings';
import * as applicationBar from 'plugins/applicationBar/init';
import * as RSVP from 'vendor/rsvp';
import {UserInfo} from '../stores/userStores';
import {ViewOptionsStore} from '../stores/viewOptions';
import {init as queryFormInit, QueryFormViews} from 'views/query/main';

declare var Modernizr:Modernizr.ModernizrStatic;

export class ViewPageStores {
    lineSelectionStore:LineSelectionStore;
    lineViewStore:ConcLineStore;
    concDetailStore:ConcDetailStore;
    refsDetailStore:RefsDetailStore;
    userInfoStore:Kontext.IUserInfoStore;
    viewOptionsStore:ViewOptions.IViewOptionsStore;
}

export class QueryStores {
    queryStore:QueryStore;
    textTypesStore:TextTypesStore;
    queryHintStore:QueryHintStore;
    withinBuilderStore:WithinBuilderStore;
    virtualKeyboardStore:VirtualKeyboardStore;
    queryContextStore:QueryContextStore;
}


export class ViewPage {

    private static CHECK_CONC_DELAY = 700;

    private static CHECK_CONC_DECAY = 1.1;

    private static CHECK_CONC_MAX_ATTEMPTS = 500;

    private layoutModel:PageModel;

    private stores:ViewPageStores;

    private hasLockedGroups:boolean;

    private concViews:any; // TODO

    private lastGroupStats:any; // group stats cache

    private queryFormViews:QueryFormViews;

    constructor(layoutModel:PageModel, stores:ViewPageStores, hasLockedGroups:boolean) {
        this.layoutModel = layoutModel;
        this.stores = stores;
        this.hasLockedGroups = hasLockedGroups;
    }


    private translate(s:string, values?:any):string {
        return this.layoutModel.translate(s, values);
    }

    showGroupsStats(rootElm:HTMLElement, usePrevData:boolean):void {
        let self = this;

        function renderChart(data):Array<string> {
            const width = 200;
            const height = 200;
            const radius = Math.min(width, height) / 2;
            const color = d3.schemeCategory20;
            const arc = d3.arc()
                .outerRadius(radius - 10)
                .innerRadius(0);
            const labelArc = d3.arc()
                .outerRadius(radius - 40)
                .innerRadius(radius - 40);
            const pie = d3.pie()
                .value((d) => d['count'])
                .sort(null);

            data = pie(data);
            const wrapper = d3.select(rootElm).append('svg')
                .attr('width', width)
                .attr('height', height)
                .attr('class', 'chart')
                .append('g')
                    .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')')
                    .attr('class', 'chart-wrapper');

            const g = wrapper.selectAll('.arc')
                .data(data).enter()
                    .append('g')
                    .attr('class', 'arc');

            g.append('path')
                .attr('d', arc)
                .style('fill', (d, i:any) => color[i]);

            if (data.length <= 5) { // direct labels only for small num of portions
                g.append('text')
                    .attr('transform', (d:any) => ('translate(' + labelArc.centroid(d) + ')'))
                    .text((d:any) => d.data['group']);
            }
            return color;
        }

        function renderLabels(data, colors, rootElm):void {
            let labelWrapper:HTMLElement = window.document.createElement('table');
            let tbody:HTMLElement = window.document.createElement('tbody');
            let innerSpanElm:HTMLElement;

            function addElm(name:string, parent:HTMLElement):HTMLElement {
                let elm = window.document.createElement(name);
                $(parent).append(elm);
                return elm;
            }

            let total = data.reduce((prev, curr)=>(prev + curr['count']), 0);

            function percentage(item) {
                return (item['count'] / total * 100).toFixed(1) + '%';
            }

            $(labelWrapper)
                .addClass('chart-label')
                .append(tbody);

            data.forEach((item, i) => {
                let trElm = addElm('tr', tbody);
                let td1Elm = addElm('td', trElm);
                let td2Elm = addElm('th', trElm);
                let td3Elm = addElm('td', trElm);
                let td4Elm = addElm('td', trElm);

                $(td1Elm)
                    .addClass('label-text')
                    .css({'background-color': colors(i)})
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

        let prom;

        if (this.lastGroupStats && usePrevData) {
            prom = new RSVP.Promise((resolve:(v:any)=>void, reject:(e:any)=>void) => {
                resolve(this.lastGroupStats);
            });

        } else {
            prom = this.layoutModel.ajax(
                'GET',
                this.layoutModel.createActionUrl('ajax_get_line_groups_stats?')
                        + this.layoutModel.encodeURLParameters(this.layoutModel.getConcArgs()),
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
                const chartData = [];
                for (let p in data) {
                    chartData.push({group: '#' + p, count: data[p]}); // TODO group '#' should be implicit
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
            if (self.stores.lineSelectionStore.size() > 0) {
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
        let left:number;
        let top:number;
        let box:popupBox.TooltipBox;
        let self = this;

        box = popupBox.open(
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
        left = $(window).width() / 2 - box.getPosition().width / 2;
        top = $('#conc-wrapper').offset().top + 40;
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
     * Fills in thousands separator ',' (comma) character into a number string
     *
     * @param {string|number} nStr number string (/\d+(.\d*)?)
     * @return {string} number string with thousands separated by the ',' (comma) character
     */
    addCommas(nStr:string):string {
        let x;
        let x1;
        let x2;
        const rgx = /(\d+)(\d{3})/;

        nStr += '';
        x = nStr.split('.');
        x1 = x[0];
        x2 = x.length > 1 ? '.' + x[1] : '';
        while (rgx.test(x1)) {
            x1 = x1.replace(rgx, '$1' + ',' + '$2');
        }
        return x1 + x2;
    }

    /**
     * @todo refactor this
     */
    private setupLineActions():void {
        // register event to load lines via ajax in case user hits back
        this.layoutModel.history.setOnPopState((event) => {
            if (event.state && event.state['pagination']) {
                this.layoutModel.dispatcher.dispatch({
                    actionType: 'CONCORDANCE_REVISIT_PAGE',
                    props: {
                        action: 'customPage',
                        pageNum: event.state['pageNum']
                    }
                });
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
    private setStateUrl():void {
        this.layoutModel.history.replaceState(
            'view',
            this.layoutModel.getConcArgs(),
            {
                pagination: true,
                pageNum: this.stores.lineViewStore.getCurrentPage()
            },
            window.document.title
        );
    }

    private updateLocalAlignedCorpora():void {
        let serverSideAlignedCorpora = this.layoutModel.getConf<Array<string>>('alignedCorpora').slice();
        this.layoutModel.userSettings.set(UserSettings.ALIGNED_CORPORA_KEY, serverSideAlignedCorpora);
    }


    private initPipelineEdit():void {
        const showQueryForm = () => {
            const targetElm = window.document.getElementById('popup-query-form-mount');
            this.layoutModel.renderReactComponent(
                this.queryFormViews.QueryFormLite,
                targetElm,
                {
                    corpname: this.layoutModel.getConf<string>('corpname'),
                    tagHelperViews: tagHelperPlugin.getViews(),
                    queryStorageViews: queryStoragePlugin.getViews(),
                    allowCorpusSelection: false,
                    actionPrefix: '',
                    onCloseClick: () => {
                        this.layoutModel.unmountReactComponent(targetElm);
                    }
                }
            );
        };

        this.layoutModel.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'TRIGGER_QUERY_LITE_FORM':
                    showQueryForm();
                break;
            }
        });
        $(window.document.getElementById('edit-query-trigger')).on('click', showQueryForm);
    }

    private initQueryForm():void {
        const queryStores = new QueryStores();
        const textTypesData = this.layoutModel.getConf<any>('textTypesData');
        queryStores.textTypesStore = new TextTypesStore(
            this.layoutModel.dispatcher,
            this.layoutModel.pluginApi(),
            textTypesData,
            this.layoutModel.getConf<TextTypes.ServerCheckedValues>('CheckedSca')
        );

        queryStores.queryHintStore = new QueryHintStore(
            this.layoutModel.dispatcher,
            this.layoutModel.getConf<Array<string>>('queryHints')
        );
        queryStores.withinBuilderStore = new WithinBuilderStore(this.layoutModel.dispatcher,
                this.layoutModel);
        queryStores.virtualKeyboardStore = new VirtualKeyboardStore(this.layoutModel.dispatcher,
                this.layoutModel);
        queryStores.queryContextStore = new QueryContextStore(this.layoutModel.dispatcher);

        const queryFormProps = {
            currentArgs: this.layoutModel.getConf<Kontext.MultiDictSrc>('currentArgs'),
            corpora: [this.layoutModel.getConf<string>('corpname')].concat(
                this.layoutModel.getConf<Array<string>>('alignedCorpora') || []),
            availableAlignedCorpora: this.layoutModel.getConf<Array<{n:string; label:string}>>('availableAlignedCorpora'),
            currQueryTypes: this.layoutModel.getConf<{[corpname:string]:string}>('CurrQueryTypes'),
            currQueries: this.layoutModel.getConf<{[corpname:string]:string}>('CurrQueries'),
            currPcqPosNegValues: this.layoutModel.getConf<{[corpname:string]:string}>('CurrPcqPosNegValues'),
            subcorpList: this.layoutModel.getConf<Array<string>>('SubcorpList'),
            currentSubcorp: this.layoutModel.getConf<string>('CurrentSubcorp'),
            tagBuilderSupport: this.layoutModel.getConf<{[corpname:string]:boolean}>('TagBuilderSupport'),
            shuffleConcByDefault: this.layoutModel.getConf<boolean>('ShuffleConcByDefault'),
            lposlist: this.layoutModel.getConf<Array<{v:string; n:string}>>('Lposlist'),
            currLposValues: this.layoutModel.getConf<{[corpname:string]:string}>('CurrLposValues'),
            currQmcaseValues: this.layoutModel.getConf<{[corpname:string]:boolean}>('CurrQmcaseValues'),
            currDefaultAttrValues: this.layoutModel.getConf<{[corpname:string]:string}>('CurrDefaultAttrValues'),
            forcedAttr: this.layoutModel.getConf<string>('ForcedAttr'),
            attrList: this.layoutModel.getConf<Array<{n:string; label:string}>>('AttrList'),
            tagsetDocUrl: this.layoutModel.getConf<string>('TagsetDocUrl'),
            lemmaWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
            posWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
            hasLemmaAttr: this.layoutModel.getConf<boolean>('hasLemmaAttr'),
            wPoSList: this.layoutModel.getConf<Array<{v:string; n:string}>>('Wposlist'),
            inputLanguages: this.layoutModel.getConf<{[corpname:string]:string}>('InputLanguages')
        };

        queryStores.queryStore = new QueryStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            queryStores.textTypesStore,
            queryStores.queryContextStore,
            queryFormProps
        );

        this.queryFormViews = queryFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            queryStores.queryStore,
            queryStores.textTypesStore,
            queryStores.queryHintStore,
            queryStores.withinBuilderStore,
            queryStores.virtualKeyboardStore,
            queryStores.queryContextStore
        );
    }

    init(lineViewProps:ViewConfiguration):RSVP.Promise<any> {
        return this.layoutModel.init().then(
            () => {
                // we must handle non-React widgets:
                lineViewProps.onChartFrameReady = (usePrevData:boolean) => {
                    let frame = window.document.getElementById('selection-actions');
                    this.showGroupsStats($(frame).find('.chart-area').get(0), usePrevData);
                };
                lineViewProps.onPageUpdate = () => {
                    syntaxViewer.create(this.layoutModel.pluginApi());
                };

            	this.concViews = concViewsInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.exportMixins(),
                    this.layoutModel.layoutViews,
                    this.stores
                );

                return this.renderLines(lineViewProps);
            }
        ).then(
            () => {
                this.setupLineActions();
                if (this.layoutModel.getConf('anonymousUser')) {
                    this.anonymousUserWarning();
                }
                this.onBeforeUnloadAsk();
                this.setStateUrl();
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
                this.initPipelineEdit();
            }
        );
    }
}

export function init(conf):ViewPage {
    const layoutModel = new PageModel(conf);

    const concSummaryProps:ConcSummary = {
        concSize: layoutModel.getConf<number>('ConcSize'),
        fullSize: layoutModel.getConf<number>('FullSize'),
        sampledSize: layoutModel.getConf<number>('SampledSize'),
        ipm: layoutModel.getConf<number>('ResultIpm'),
        arf: layoutModel.getConf<number>('ResultArf'),
        isShuffled: layoutModel.getConf<boolean>('ResultShuffled')
    };
    const lineViewProps:ViewConfiguration = {
        ViewMode: layoutModel.getConf<string>('ViewMode'),
        ShowLineNumbers: layoutModel.getConf<boolean>('ShowLineNumbers'),
        KWICCorps: layoutModel.getConf<Array<string>>('KWICCorps'),
        CorporaColumns: layoutModel.getConf<Array<{n:string; label:string}>>('CorporaColumns'),
        WideCtxGlobals: layoutModel.getConf<Array<Array<string>>>('WideCtxGlobals'),
        SortIdx: layoutModel.getConf<Array<{page:number; label:string}>>('SortIdx'),
        NumItemsInLockedGroups: layoutModel.getConf<number>('NumLinesInGroups'),
        baseCorpname: layoutModel.getConf<string>('corpname'),
        subCorpName: layoutModel.getConf<string>('subcorpname'),
        pagination: layoutModel.getConf<ServerPagination>('Pagination'),
        currentPage: layoutModel.getConf<number>('FromPage'),
        mainCorp: layoutModel.getConcArgs()['maincorp'],
        concSummary: concSummaryProps,
        Unfinished: layoutModel.getConf<boolean>('Unfinished'),
        canSendEmail: layoutModel.getConf<boolean>('can_send_mail'),
        ContainsWithin: layoutModel.getConf<boolean>('ContainsWithin'),
        ShowConcToolbar: layoutModel.getConf<boolean>('ShowConcToolbar'),
        SpeakerIdAttr: layoutModel.getConf<[string, string]>('SpeakerIdAttr'),
        SpeakerColors: d3.schemeCategory20,
        SpeechSegment: layoutModel.getConf<[string, string]>('SpeechSegment'),
        SpeechOverlapAttr: layoutModel.getConf<[string, string]>('SpeechOverlapAttr'),
        SpeechOverlapVal: layoutModel.getConf<string>('SpeechOverlapVal'),
        SpeechAttrs: layoutModel.getConf<Array<string>>('SpeechAttrs'),
        StructCtx: layoutModel.getConf<string>('StructCtx')
    };
    const stores = new ViewPageStores();
    stores.userInfoStore = layoutModel.getStores().userInfoStore;
    stores.viewOptionsStore = layoutModel.getStores().viewOptionsStore;
    stores.lineViewStore = new ConcLineStore(
            layoutModel,
            layoutModel.dispatcher,
            lineViewProps,
            layoutModel.getConf<Array<ServerLineData>>('Lines')
    );
    stores.lineSelectionStore = new LineSelectionStore(
            layoutModel,
            layoutModel.dispatcher,
            stores.lineViewStore,
            conclines.openStorage(()=>{}),
            'simple'
    );
    stores.concDetailStore = new ConcDetailStore(
        layoutModel,
        layoutModel.dispatcher,
        stores.lineViewStore,
        lineViewProps.StructCtx,
        {
            speakerIdAttr: lineViewProps.SpeakerIdAttr,
            speechSegment: lineViewProps.SpeechSegment,
            speechAttrs: lineViewProps.SpeechAttrs,
            speechOverlapAttr: lineViewProps.SpeechOverlapAttr,
            speechOverlapVal: lineViewProps.SpeechOverlapVal
        },
        lineViewProps.SpeakerColors
    );
    stores.refsDetailStore = new RefsDetailStore(
        layoutModel,
        layoutModel.dispatcher,
        stores.lineViewStore
    );

    const pageModel = new ViewPage(
        layoutModel,
        stores,
        layoutModel.getConf<number>('NumLinesInGroups') > 0
    );
    pageModel.init(lineViewProps).then(
        () => {},
        (err) => {
            console.error(err);
            layoutModel.showMessage('error', err);
        }
    )
    return pageModel;
};
