/*
 * Copyright (c) 2013 Institute of the Czech National Corpus
 * Copyright (c) 2003-2009  Pavel Rychly
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
/// <reference path="../../ts/declarations/popupbox.d.ts" />
/// <reference path="../../ts/declarations/modernizr.d.ts" />
/// <reference path="../../ts/declarations/soundmanager.d.ts" />
/// <reference path="../../ts/declarations/d3.d.ts" />
/// <reference path="../../ts/declarations/jquery-plugins.d.ts" />
/// <reference path="../../ts/declarations/detail.d.ts" />
/// <reference path="../types/views.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />

import win = require('win');
import $ = require('jquery');
import jqueryPeriodic = require('vendor/jquery.periodic');
import documentModule = require('./document');
import detail = require('detail');
import popupBox = require('popupbox');
import conclines = require('../conclines');
import {init as lineSelViewsInit} from 'views/concordance/lineSelection';
import {init as linesViewInit} from 'views/concordance/lines';
import lineSelStores = require('../stores/concordance/lineSelection');
import {ConcLineStore, ServerLineData} from '../stores/concordance/lines';
import SoundManager = require('SoundManager');
import d3 = require('vendor/d3');
import syntaxViewer = require('plugins/syntaxViewer/init');
import userSettings = require('../userSettings');
import applicationBar = require('plugins/applicationBar/init');
import RSVP = require('vendor/rsvp');
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

    private lineSelViews:any; // TODO

    private lineViews:any; // TODO

    private touchHandler:TouchHandler;

    constructor(layoutModel:documentModule.PageModel, lineSelViews:any, lineSelectionStore:lineSelStores.LineSelectionStore,
            lineViews:any, lineViewStore:ConcLineStore, hasLockedGroups:boolean) {
        this.layoutModel = layoutModel;
        this.lineSelViews = lineSelViews;
        this.lineSelectionStore = lineSelectionStore;
        this.lineViews = lineViews;
        this.lineViewStore = lineViewStore;
        this.hasLockedGroups = hasLockedGroups;
        this.touchHandler = new TouchHandler();
    }


    private translate(s:string, values?:any):string {
        return this.layoutModel.translate(s, values);
    }


    getUISelectionMode():string {
        let conclines = $('#conclines');
        if (conclines.find('td.manual-selection input[type=\'checkbox\']').length > 0) {
            return 'simple';

        } else if (conclines.find('td.manual-selection input[type=\'text\']').length > 0) {
            return 'groups';
        }
        return null;
    }


    private setDefinedGroups():void {
        $('#selection-mode-switch')
            .val('groups')
            .attr('disabled', 'disabled');
        $('#conclines tr').each(function () {
            let elm = $(this).find('.manual-selection');
            let groupElm = window.document.createElement('span');
            let inputElm = elm.find('input');
            let kwiclen = inputElm.attr('data-kwiclen');
            let position = inputElm.attr('data-position');
            let lineNum = inputElm.attr('data-linenum');

            $(groupElm)
                .attr('data-kwiclen', kwiclen)
                .attr('data-position', position)
                .attr('data-linenum', lineNum)
                .text($(this).attr('data-linegroup'))
                .addClass('group-id');
            elm.empty().append(groupElm);
        });
    }


    /**
     * According to the data found in sessionStorage iterates over current page's
     * lines and (un)checks them appropriately. In case sessionStorage is not
     * supported all the checkboxes are disabled.
     */
    refreshSelection():void {
        let self = this;
        function applyOn(currMode, setValFn) {
            return function (i, item) {
                self.rowSelectionEvent(item, currMode);
                if (!self.lineSelectionStore.supportsSessionStorage()) {
                    $(item).attr('disabled', 'disabled');

                } else {
                    setValFn(item);
                }
            }
        }
        let storeMode = this.lineSelectionStore.getMode();
        if (this.getUISelectionMode() !== storeMode) {
            self.updateUISelectionMode();
        }
        $('#selection-mode-switch').val(storeMode);
        if (storeMode === 'simple') {
            $('#conclines td.manual-selection input[type=\'checkbox\']').each(applyOn(storeMode, (item) => {
                if (self.lineSelectionStore.containsLine($(item).attr('data-position'))) {
                    item.checked = true;

                } else {
                    item.checked = false;
                }
            }));

        } else if (storeMode === 'groups') {
            $('#conclines td.manual-selection input[type=\'text\']').each(applyOn(storeMode, (item) => {
                let data = self.lineSelectionStore.getLine($(item).attr('data-position'));
                $(item).val(data ? data[1] : null);
            }));
        }
        self.reinitSelectionMenuLink();
    }

    showGroupsStats(rootElm):void {
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

        this.layoutModel.ajax(
            'GET',
            this.layoutModel.createActionUrl('ajax_get_line_groups_stats?')
                    + this.layoutModel.getConf('stateParams'),
            {},
            {contentType : 'application/x-www-form-urlencoded'}
        ).then(
            function (data) {
                let chartData = [];
                let colors:any;

                for (let p in data) {
                    chartData.push({group: '#' + p, count: data[p]}); // TODO group '#' should be implicit
                }
                $(rootElm).append(
                    '<legend>' + self.translate('linesel__groups_stats_heading') + '</legend>'
                );
                colors = renderChart(chartData);
                renderLabels(chartData, colors, rootElm);
            },
            function (err) {
                self.layoutModel.showMessage('error', err);
            }
        );
    }

    getNumSelectedItems():number {
        if (this.hasLockedGroups) {
            return this.layoutModel.getConf<number>('numLinesInGroups');

        } else {
            return this.lineSelectionStore.size();
        }
    }

    toggleWarning(targetElm):void {
        if (this.hasLockedGroups) {
            targetElm.addClass('info');
            targetElm.attr('title', this.translate('linesel__you_have_saved_line_groups'));

        } else if (this.getNumSelectedItems() > 0) {
            targetElm.addClass('warn');
            targetElm.attr('title', this.translate('linesel__you_have_unsaved_line_sel'));

        } else {
            targetElm.removeClass('warn');
            targetElm.attr('title', null);
        }
    }

    /**
     *
     * @param numSelected
     */
    private reinitSelectionMenuLink():void {
        let linesSelectionWrap = $('#result-info .lines-selection');
        let createContent:(box:popupBox.TooltipBox, finalize:()=>void)=>void;
        let createContentChecked:(box:popupBox.TooltipBox, finalize:()=>void)=>void;
        let self = this;

        linesSelectionWrap.empty();

        if (this.hasLockedGroups) {
            createContent = function (box, finalize) {
                let actionRegId = self.layoutModel.dispatcher.register((payload) => {
                    if (payload.actionType === 'ERROR') {
                        box.close();
                        self.layoutModel.dispatcher.unregister(actionRegId);
                    }
                });
                self.lineSelectionStore.addActionFinishHandler(() => {
                    box.close();
                });
                self.layoutModel.renderReactComponent(
                    self.lineSelViews.LockedLineGroupsMenu,
                    box.getRootElement(),
                    {
                        doneCallback: () => {
                            finalize.call(self.layoutModel);
                        },
                        chartCallback: () => {
                            $(box.getRootElement()).find('.chart-area').empty();
                            self.showGroupsStats($(box.getRootElement()).find('.chart-area').get(0));
                        },
                        checkpointUrl: window.location.href,
                        canSendMail: self.layoutModel.getConf<boolean>('can_send_mail')
                     }
                 );
            };

        } else {
            createContent = function (box, finalize) {
                var actionRegId = self.layoutModel.dispatcher.register(function (payload) {
                    if (payload.actionType === 'ERROR') {
                        box.close();
                        self.layoutModel.dispatcher.unregister(actionRegId);
                    }
                });
                self.lineSelectionStore.addActionFinishHandler(function () {
                    box.close();
                });
                self.layoutModel.renderReactComponent(
                    self.lineSelViews.LineSelectionMenu,
                    box.getRootElement(),
                    {
                        doneCallback: finalize.bind(self.layoutModel)
                    }
                 );
            };
        }

        createContentChecked = function (box, finalize) {
            if (self.getNumSelectedItems() > 0) {
                createContent(box, finalize);

            } else {
                $(box.getRootElement()).append(self.translate('linesel__you_have_no_sel_lines'));
                finalize();
            }
        }

        let numSelected = this.getNumSelectedItems();
        let viewMenuLink:HTMLElement = window.document.createElement('a');
        $(viewMenuLink).append('<span class="value">' + numSelected + '</span> '
                + self.translate('global__selected_lines'));
        if (!popupBox.hasAttachedPopupBox(viewMenuLink)) {
            popupBox.bind(viewMenuLink, createContentChecked, {
                type : 'plain',
                closeIcon : true,
                timeout: null,
                onClose: function () { // beware - 'this' refers to the popupbox instance
                    self.layoutModel.unmountReactComponent(this.getRootElement());
                    self.lineSelectionStore.removeAllActionFinishHandlers();
                }
            });
        }
        linesSelectionWrap
            .append('(')
            .append(viewMenuLink)
            .append(')');
        self.toggleWarning(linesSelectionWrap);
    }

    /**
     * Updates selection mode (group vs. simple) in UI according
     * to a state in the lineSelectionStore.
     */
    updateUISelectionMode():void {
        let self = this;
        let mode = this.lineSelectionStore.getMode();

        function applyStoredValue(jqElm) {
            let line = self.lineSelectionStore.getLine(jqElm.attr('data-position'));
            if (line && mode === 'groups') {
                jqElm.val(line[1]);

            } else if (line && mode === 'simple') {
                jqElm.prop('checked', true);
            }
        }

        $('#conclines').find('td.manual-selection > *').each(function (item) {
            let inputElm = window.document.createElement('input');
            let kwiclen = $(this).attr('data-kwiclen');
            let position = $(this).attr('data-position');
            let lineNum = $(this).attr('data-linenum');
            $(inputElm)
                .attr('type', mode === 'simple' ? 'checkbox' : 'text')
                .attr('data-kwiclen', kwiclen)
                .attr('data-position', position)
                .attr('data-linenum', lineNum);
            if (mode === 'groups') {
                $(inputElm)
                    .attr('inputmode', 'numeric')
                    .css('width', '1.4em');
            }
            $(this).replaceWith(inputElm);
            applyStoredValue($(inputElm));
            self.rowSelectionEvent(inputElm, mode);
        });
    }

    /**
     * Handle manual mode selection
     */
    private bindSelectionModeSwitch():void {
        $('#selection-mode-switch')
            .off('change')
            .on('change', (evt) => {
                let mode = $(evt.currentTarget).val();
                this.lineSelectionStore.setMode(mode);
                this.updateUISelectionMode();
                this.reinitSelectionMenuLink();
                let realHeight = $('#conclines').height();
            }
        );
    }

    private getMaxGroupId():number {
        return this.layoutModel.getConf<number>('concLineMaxGroupNum');
    }

    private validateGroupNameInput(s):boolean {
        let v = parseInt(s);
        if (!isNaN(v) && v <= this.getMaxGroupId()) {
            return true;
        }
        return false;
    }

    /**
     * Handle click on concordance line checkboxes or change in line group text input fields
     */
    rowSelectionEvent(elm, mode):void {
        let self = this;
        let jqLineSel = $('.lines-selection');

        if (mode === 'simple') {
            $(elm).on('click', function (e) {
                let id = $(e.currentTarget).attr('data-position');
                let kwiclen:number = parseInt($(e.currentTarget).attr('data-kwiclen') || '1', 10);

                if ($(e.currentTarget).is(':checked')) {
                    self.lineSelectionStore.addLine(id, kwiclen, null);

                } else {
                    self.lineSelectionStore.removeLine(id);
                }
                jqLineSel.find('.value').text(String(self.getNumSelectedItems()));
                self.toggleWarning(jqLineSel);
            });

        } else if (mode === 'groups') {
            $(elm).on('change keyup', function (e) {
                let id = $(e.currentTarget).attr('data-position');
                let kwiclen = parseInt($(e.currentTarget).attr('data-kwiclen') || '1', 10);
                let groupId = parseInt($(e.currentTarget).val() || 0, 10);
                let inputValue = $(e.currentTarget).val();

                if (inputValue !== '') {
                    if (self.validateGroupNameInput(inputValue)) {
                        $(e.currentTarget)
                            .removeClass('error')
                            .attr('title', null);
                        self.lineSelectionStore.addLine(id, kwiclen, groupId);

                    } else {
                        $(e.currentTarget)
                            .addClass('error')
                            .attr('title', self.translate('linesel__error_group_name_please_use{max_group}',
                                    {max_group: self.getMaxGroupId()}));
                    }

                } else {
                    $(e.currentTarget)
                        .removeClass('error')
                        .attr('title', null);
                    self.lineSelectionStore.removeLine(id);
                }
                jqLineSel.find('.value').text(String(self.getNumSelectedItems()));
                self.toggleWarning(jqLineSel);
            });
        }
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
     * Some links/forms must be allowed to avoid beforeunload check (e.g. pagination)
     */
    private grantPaginationPageLeave():void {
        $('.bonito-pagination form').on('submit', function () {
            $(win).off('beforeunload.alert_unsaved');
        });

        $('.bonito-pagination a').on('click', function () {
            $(win).off('beforeunload.alert_unsaved');
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
                        self.layoutModel.getPlugin<applicationBar.Toolbar>('applicationBar').openLoginDialog();
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
    private misc():void {
        let self = this;

        $('#groupmenu').attr('corpname', this.layoutModel.getConf<string>('corpname'));
        $('#groupmenu').attr('queryparams', this.layoutModel.getConf<string>('q'));

        $('td.kw strong,td.par strong,td.coll strong,td.par span.no-kwic-text').bind('click', function (event) {
            let jqRealTarget = null;

            if ($(event.target).data('action')) {
                jqRealTarget = $(event.target);

            } else if ($(event.target).parent().data('action')) {
                jqRealTarget = $(event.target).parent();
            }

            detail.showDetail(
                event.currentTarget,
                jqRealTarget.data('action'),
                jqRealTarget.data('params'),
                self.layoutModel,
                self.viewDetailDoneCallback.bind(self)
            );
            event.stopPropagation();
        });

        $('td.ref').bind('click', function (event) {
            $(event.target).closest('tr').addClass('active');
            detail.showRefDetail(
                event.target,
                $(event.target).data('action'),
                $(event.target).data('params'),
                function (jqXHR, textStatus, errorThrown) {
                    self.layoutModel.showMessage('error', errorThrown);
                },
                self.layoutModel
            );
            event.stopPropagation();
        });

        $('a.speech-link').each(function () {
            $(this).bind('click', function (event) {
                detail.openSpeech(this);
                event.stopPropagation();
                event.preventDefault();
                return false;
            });
        });
    }

    private addWarnings():void {
        let jqTriggerElm;

        jqTriggerElm = $('#result-info').find('.size-warning');
        popupBox.bind(
            jqTriggerElm,
            this.translate('global__size_warning', {size: jqTriggerElm.data('size-limit')}),
            {
                type: 'warning',
                width: 'nice'
            }
        );
    }

    private soundManagerInit():void {
        SoundManager.getInstance().setup({
            url: this.layoutModel.createStaticUrl('misc/soundmanager2/'),
            flashVersion: 9,
            debugMode : false,
            preferFlash : false
        });
    }

    /**
     *
     * @param boxInst
     */
    viewDetailDoneCallback(boxInst):void {
        let self = this;
        $('a.expand-link').each(function () {
            $(this).one('click', function (event) {
                detail.showDetail(
                    event.currentTarget,
                    $(this).data('action'),
                    $(this).data('params'),
                    self.layoutModel,
                    // Expand link, when clicked, must bind the same event handler
                    // for the new expand link. That's why this 'callback recursion' is present.
                    self.viewDetailDoneCallback.bind(self)
                );
                event.preventDefault();
            });
        });
        this.layoutModel.mouseOverImages(boxInst.getRootElement());
    }

    renderLines():RSVP.Promise<any> {
        let ans = new RSVP.Promise((resolve:(v:any)=>void, reject:(e:any)=>void) => {
            let props = {
                ViewMode: this.layoutModel.getConf<string>('ViewMode'),
                KWICCorps: this.layoutModel.getConf<Array<string>>('KWICCorps'),
                CorporaColumns: this.layoutModel.getConf<Array<string>>('CorporaColumns'),
                WideCtxGlobals: this.layoutModel.getConf<Array<Array<string>>>('WideCtxGlobals'),
                corpname: this.layoutModel.getConf<string>('corpname'),
                onReady: () => {
                    resolve(null);
                }
            };
            this.layoutModel.renderReactComponent(this.lineViews.ConcLines,
                window.document.getElementById('conclines-wrapper'), props);
        });
        return ans;
    }

    /**
     *
     */
    reloadHits():void {
        let self = this;
        let freq = 500;

        $('#conc-loader').empty().append('<img src="' + this.layoutModel.createStaticUrl('img/ajax-loader.gif') + '" alt="'
            + this.translate('global__calculating')
            + '" title="' + this.translate('global__calculating')
            + '" style="width: 24px; height: 24px" />');
        $('#arf').empty().html(this.translate('global__calculating'));
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
                        return self.layoutModel.formatNum(n, data.thousandsSeparator, data.decimalSeparator);
                    };

                    if (data.end) {
                        freq = 5;
                    }

                    $('#result-info span.ipm').html(num2Str(data.relconcsize.toFixed(2)));
                    $('.numofpages').html(num2Str(Math.ceil(data.concsize / self.layoutModel.getConf<number>('numLines'))));

                    if (data.fullsize > 0) {
                        $('#fullsize').html(num2Str(data.fullsize));
                        $('#toolbar-hits').html(num2Str(data.fullsize));

                    } else {
                        $('#fullsize').html(num2Str(data.concsize));
                        $('#toolbar-hits').html(num2Str(data.concsize));
                    }

                    if (data.finished) {
                        win.setTimeout(this.periodic.cancel, 1000);
                        $('#conc-loader').empty();
                        /* We are unable to update ARF on the fly which means we
                         * have to reload the page after all the server calculations are finished.
                         */
                        win.location.reload();
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
        let stateParams = this.layoutModel.getConf('stateParams');
        if (Modernizr.history) {
            window.history.replaceState(
                {},
                window.document.title,
                this.layoutModel.createActionUrl('view') + '?' + stateParams
            );

        } else if (!this.layoutModel.getConf('replicableQuery')) {
            window.location.href = '/view?' + stateParams;
        }
    }

    private attachIpmCalcTrigger():void {
        let self = this;
        $('#conc-top-bar').find('.calculate-ipm').on('click', function (event) {
            let q = '[] ' + decodeURIComponent($(event.target).data('query'));
            let totalHits = parseInt($(event.target).data('total-hits'));
            let prom;
            let loaderBox = window.document.createElement('span');
            let loaderImg = window.document.createElement('img');
            let userConfirm;

            userConfirm = window.confirm(self.translate('global__ipm_calc_may_take_time'));

            if (userConfirm) {
                $(loaderImg)
                    .attr('src', self.layoutModel.createStaticUrl('img/ajax-loader.gif'));

                prom = $.ajax(
                        self.layoutModel.createActionUrl('ajax_get_within_max_hits') +
                                '?' + self.layoutModel.getConf('stateParams'),
                        {
                            data: {},
                            dataType: 'json'
                        }
                );
                $(loaderBox)
                    .attr('id', 'ipm-loader')
                    .css('position', 'inherit')
                    .append(loaderImg)
                    .append(self.translate('global__calculating'));
                $(event.target).replaceWith(loaderBox);

                prom.then(
                    function (data) {
                        var ipm = (totalHits / data.total * 1e6).toFixed(2);
                        $(loaderBox).replaceWith('<span class="ipm">' + ipm + '</span>');
                    },
                    function (err) {
                        $(loaderBox).remove();
                        self.layoutModel.showMessage('error', self.translate('global__failed_to_calc_ipm'));
                    }
                );
            }
        });
    }

    private initLineSelection():void {
        this.lineSelectionStore.addOnReenableEdit(() => {
            $('#selection-mode-switch').attr('disabled', null);
            this.hasLockedGroups = false;
            $(win).off('beforeunload.alert_unsaved');
        });
        if (this.hasLockedGroups) {
            this.setDefinedGroups();

        } else {
            this.bindSelectionModeSwitch();
            this.refreshSelection();
        }
        this.reinitSelectionMenuLink();
    }

    private updateLocalAlignedCorpora():void {
        let serverSideAlignedCorpora = this.layoutModel.getConf<Array<string>>('alignedCorpora').slice();
        this.layoutModel.userSettings.set(userSettings.UserSettings.ALIGNED_CORPORA_KEY, serverSideAlignedCorpora);
    }

    init():void {
        this.layoutModel.init().then(
            () => {
                return this.renderLines();
            }
        ).then(
            () => {
                this.lineSelectionStore.addClearSelectionHandler(this.refreshSelection.bind(this));
                this.initLineSelection();
                this.misc();
                this.addWarnings();
                if (this.layoutModel.getConf('anonymousUser')) {
                    this.anonymousUserWarning();
                }
                this.onBeforeUnloadAsk();
                this.grantPaginationPageLeave();
                this.soundManagerInit();
                this.setStateUrl();
                this.attachIpmCalcTrigger();
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
    let lineSelectionStore = new lineSelStores.LineSelectionStore(layoutModel,
            layoutModel.dispatcher, conclines.openStorage(()=>{}), 'simple');
    let lineSelViews = lineSelViewsInit(layoutModel.dispatcher, layoutModel.exportMixins(),
            lineSelectionStore, layoutModel.getStores().userInfoStore);

    let lineViewStore = new ConcLineStore(layoutModel, layoutModel.dispatcher,
            layoutModel.getConf<Array<ServerLineData>>('Lines'));
    let concLinesViews = linesViewInit(layoutModel.dispatcher, layoutModel.exportMixins(),
            lineViewStore);

    let hasLockedGroups = layoutModel.getConf('numLinesInGroups') > 0;
    let pageModel = new ViewPage(layoutModel, lineSelViews, lineSelectionStore, concLinesViews,
            lineViewStore, hasLockedGroups);
    pageModel.init();
    return pageModel;
};
