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
/// <reference path="../types/plugins/abstract.d.ts" />
/// <reference path="../../ts/declarations/modernizr.d.ts" />
/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../../ts/declarations/soundmanager.d.ts" />
/// <reference path="../../ts/declarations/d3.d.ts" />
/// <reference path="../../ts/declarations/jquery-plugins.d.ts" />
/// <reference path="../types/views.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />

import win = require('win');
import $ = require('jquery');
import jqueryPeriodic = require('vendor/jquery.periodic');
import documentModule = require('./document');
import popupBox = require('../popupbox');
import conclines = require('../conclines');
import {init as concViewsInit} from 'views/concordance/main';
import lineSelStores = require('../stores/concordance/lineSelection');
import {ConcLineStore, ServerLineData, ViewConfiguration, ServerPagination, ConcSummary} from '../stores/concordance/lines';
import SoundManager = require('SoundManager');
import d3 = require('vendor/d3');
import syntaxViewer = require('plugins/syntaxViewer/init');
import userSettings = require('../userSettings');
import applicationBar = require('plugins/applicationBar/init');
import RSVP = require('vendor/rsvp');
import {ConcDetail} from '../detail';
declare var Modernizr:Modernizr.ModernizrStatic;
declare var jqueryPeriodic:any;

// TODO this is an experimental touch event handler.
// Default behavior of the 'view' component should be observed carefully first.
class TouchHandler {

    startX = null;
    startY = null;
    currX = null;
    currY = null;
    area = null;

    private _getPos;

    constructor() {
        this._getPos = function (evt) {
            let touch = evt.originalEvent.changedTouches[0];
            if (touch) {
                return [touch.clientX, touch.clientY];

            } else {
                return [null, null];
            }
        }
    }

    attachTouchEvents(area, fn):void {
        let pos;
        let self = this;
        let deltaX = 0;

        this.area = area;

        $(area).on('touchstart', function (evt) {
            pos = self._getPos(evt);
            this.startX = pos.clientX;
            this.startY = pos.clientY;
            this.currX = this.startX;
            this.currY = this.startY;
        });
        $(area).on('touchmove', function (evt) {
            pos = self._getPos(evt);
            deltaX = pos[0] - this.currX;
            fn(deltaX);
            this.currX = pos[0];
            this.currY = pos[1];
            evt.preventDefault();
        });
        $(area).on('touchend', function (evt) {
            pos = self._getPos(evt);
            this.startX = null;
            this.startY = null;
        });
    }
}


export class ViewPage {

    private layoutModel:documentModule.PageModel;

    private lineSelectionStore:lineSelStores.LineSelectionStore;

    private lineViewStore:ConcLineStore;

    private hasLockedGroups:boolean;

    private concViews:any; // TODO

    private touchHandler:TouchHandler;

    private lastGroupStats:any; // group stats cache

    private concDetail:ConcDetail;

    constructor(layoutModel:documentModule.PageModel, lineSelectionStore:lineSelStores.LineSelectionStore,
            lineViewStore:ConcLineStore, hasLockedGroups:boolean) {
        this.layoutModel = layoutModel;
        this.lineSelectionStore = lineSelectionStore;
        this.lineViewStore = lineViewStore;
        this.hasLockedGroups = hasLockedGroups;
        this.touchHandler = new TouchHandler();
        this.concDetail = new ConcDetail(layoutModel.pluginApi());
    }


    private translate(s:string, values?:any):string {
        return this.layoutModel.translate(s, values);
    }

    showGroupsStats(rootElm:HTMLElement, usePrevData:boolean):void {
        let self = this;

        function renderChart(data):d3.scale.Ordinal<string, string> {
            let width = 200;
            let height = 200;
            let radius = Math.min(width, height) / 2;
            let color = d3.scale.category20();

            let arc = d3.svg.arc()
                .outerRadius(radius - 10)
                .innerRadius(0);

            let labelArc = d3.svg.arc()
                .outerRadius(radius - 40)
                .innerRadius(radius - 40);

            let pie = d3.layout.pie()
                .value((d) => d['count'])
                .sort(null);

            data = pie(data);

            let wrapper = d3.select(rootElm).append('svg')
                .attr('width', width)
                .attr('height', height)
                .attr('class', 'chart')
                .append('g')
                    .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')')
                    .attr('class', 'chart-wrapper');

            let g = wrapper.selectAll('.arc')
                .data(data).enter()
                    .append('g')
                    .attr('class', 'arc');

            g.append('path')
                .attr('d', arc)
                .style('fill', (d, i:any) => color(i));

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
        $(win).on('beforeunload.alert_unsaved', function (event:any) {
            if (self.lineSelectionStore.size() > 0) {
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
        left = $(win).width() / 2 - box.getPosition().width / 2;
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
        let rgx = /(\d+)(\d{3})/;

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

        this.lineViewStore.bindExternalRefsDetailFn((corpusId:string, tokenNum:number, lineIdx:number) => {
            this.concDetail.showRefDetail(
                this.layoutModel.createActionUrl('fullref'),
                {corpname: corpusId, pos: tokenNum},
                () => {
                    // TODO
                    // here we're doing a dirty hack to glue
                    // the old code in detail.js with newer Flux store
                    this.lineViewStore.setLineFocus(lineIdx, true);
                    this.lineViewStore.notifyChangeListeners();
                },
                () => {
                    this.lineViewStore.setLineFocus(lineIdx, false);
                    this.lineViewStore.notifyChangeListeners();
                    // TODO dtto
                },
                (error) => {
                    // TODO dtto
                    this.lineViewStore.setLineFocus(lineIdx, false);
                    this.lineViewStore.notifyChangeListeners();
                    this.layoutModel.showMessage('error', error);
                }
            );
        });

        this.lineViewStore.bindExternalKwicDetailFn((corpusId:string, tokenNum:number, lineIdx:number) => {
            let args = this.layoutModel.getConcArgs().toDict();
            args['corpname'] = corpusId; // just for sure (is should be already in args)
            args['pos'] = String(tokenNum);
            this.concDetail.showDetail(
                this.layoutModel.createActionUrl('widectx'),
                args,
                (popupBox) => {
                    // TODO
                    // here we're doing a dirty hack to glue
                    // the old code in detail.js with newer Flux store
                    this.lineViewStore.setLineFocus(lineIdx, true);
                    this.viewDetailDoneCallback(popupBox);
                    this.lineViewStore.notifyChangeListeners();
                },
                () => {
                    this.lineViewStore.setLineFocus(lineIdx, false);
                    this.lineViewStore.notifyChangeListeners();
                    // TODO dtto
                },
                (error) => {
                    // TODO dtto
                    this.lineViewStore.setLineFocus(lineIdx, false);
                    this.lineViewStore.notifyChangeListeners();
                    this.layoutModel.showMessage('error', error);
                }
            );
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

    viewDetailDoneCallback(boxInst):void {
        let self = this;
        $('a.expand-link').each(function () {
            $(this).one('click', function (event) {
                self.concDetail.showDetail(
                    self.layoutModel.createActionUrl($(this).data('action')),
                    $(this).data('params'),
                    // Expand link, when clicked, must bind the same event handler
                    // for the new expand link. That's why this 'callback recursion' is present.
                    self.viewDetailDoneCallback.bind(self),
                    () => {},
                    (err) => {
                        self.layoutModel.showMessage('error', err);
                    }
                );
                event.preventDefault();
            });
        });
        this.layoutModel.mouseOverImages(boxInst.getRootElement());
    }

    /**
     *
     */
    reloadHits():void {
        const self = this;
        let freq = 500;
        /*
         * Checks periodically for the current state of a concordance calculation
         */
        jqueryPeriodic({ period: freq, decay: 1.2, max_period: 60000 }, function () {
            $.ajax('get_cached_conc_sizes?' + self.layoutModel.getConf('q')
                    + '&' + self.layoutModel.getConf('globals'),
            {
                type: 'POST',
                periodic: this,
                success: function (data) {
                    var num2Str;

                    num2Str = function (n) {
                        return self.layoutModel.formatNumber(n);
                    };

                    if (data.end) {
                        freq = 5;
                    }

                    $('#result-info span.ipm').html(num2Str(data.relconcsize.toFixed(2)));
                    self.layoutModel.dispatcher.dispatch({
                        actionType: 'CONCORDANCE_UPDATE_NUM_AVAIL_PAGES',
                        props: {
                            availPages: Math.ceil(data.concsize / self.layoutModel.getConf<number>('numLines'))
                        }
                    });
                    if (!data.finished) {
                        if (data.fullsize > 0) {
                            self.layoutModel.dispatcher.dispatch({
                                actionType: 'CONCORDANCE_ASYNC_CALCULATION_UPDATED',
                                props: {
                                    finished: false,
                                    concsize: data.concsize,
                                    fullsize: data.fullsize
                                }
                            });
                        }

                    } else {
                        win.setTimeout(this.periodic.cancel, 1000);
                        self.layoutModel.dispatcher.dispatch({
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
                },
                dataType: 'json'
            });
        });
    };

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
                pageNum: this.lineViewStore.getCurrentPage()
            },
            window.document.title
        );
    }

    private updateLocalAlignedCorpora():void {
        let serverSideAlignedCorpora = this.layoutModel.getConf<Array<string>>('alignedCorpora').slice();
        this.layoutModel.userSettings.set(userSettings.UserSettings.ALIGNED_CORPORA_KEY, serverSideAlignedCorpora);
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
                    this.lineViewStore,
                    this.lineSelectionStore,
                    this.layoutModel.getStores().userInfoStore,
                    this.layoutModel.getStores().viewOptionsStore,
                    this.layoutModel.layoutViews
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
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }
}

export function init(conf):ViewPage {
    let layoutModel = new documentModule.PageModel(conf);

    let concSummaryProps:ConcSummary = {
        concSize: layoutModel.getConf<number>('ConcSize'),
        fullSize: layoutModel.getConf<number>('FullSize'),
        sampledSize: layoutModel.getConf<number>('SampledSize'),
        ipm: layoutModel.getConf<number>('ResultIpm'),
        arf: layoutModel.getConf<number>('ResultArf'),
        isShuffled: layoutModel.getConf<boolean>('ResultShuffled')
    };
    let lineViewProps:ViewConfiguration = {
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
        ContainsWithin: layoutModel.getConf<boolean>('ContainsWithin')
    };
    let lineViewStore = new ConcLineStore(
            layoutModel,
            layoutModel.dispatcher,
            lineViewProps,
            layoutModel.getConf<Array<ServerLineData>>('Lines')
    );
    let lineSelectionStore = new lineSelStores.LineSelectionStore(
            layoutModel,
            layoutModel.dispatcher,
            lineViewStore,
            conclines.openStorage(()=>{}),
            'simple'
    );
    let pageModel = new ViewPage(
            layoutModel,
            lineSelectionStore,
            lineViewStore,
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
