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
define(function (require, exports, module) {
    'use strict';

    var win = require('win');
    var $ = require('jquery');
    var jqueryPeriodic = require('vendor/jquery.periodic');
    var documentModule = require('tpl/document');
    var detail = require('detail');
    var popupBox = require('popupbox');
    var conclines = require('conclines');
    var concViews = require('views/concordance');
    var concStores = require('stores/concordance');
    var SoundManager = require('SoundManager');
    var d3 = require('vendor/d3');
    require('vendor/jscrollpane');

    var lib = {};

    lib.layoutModel = null;


    // TODO this is an experimental touch event handler.
    // Default behavior of the 'view' component should be observed carefully first.
    function TouchHandler() {

        this.startX = null;
        this.startY = null;
        this.currX = null;
        this.currY = null;
        this.area = null;

        this._getPos = function (evt) {
            var touch = evt.originalEvent.changedTouches[0];
            if (touch) {
                return [touch.clientX, touch.clientY];

            } else {
                return [null, null];
            }
        }


        this.attachTouchEvents = function (area, fn) {
            var pos;
            var self = this;
            var deltaX = 0;

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

    function getUISelectionMode() {
        var conclines = $('#conclines');
        if (conclines.find('td.manual-selection input[type=\'checkbox\']').length > 0) {
            return 'simple';

        } else if (conclines.find('td.manual-selection input[type=\'text\']').length > 0) {
            return 'groups';
        }
        return null;
    }


    function setDefinedGroups() {
        $('#selection-mode-switch')
            .val('groups')
            .attr('disabled', 'disabled');
        $('#conclines tr').each(function () {
            var elm = $(this).find('.manual-selection');
            var groupElm = window.document.createElement('span');
            var inputElm = elm.find('input');
            var kwiclen = inputElm.attr('data-kwiclen');
            var position = inputElm.attr('data-position');
            var lineNum = inputElm.attr('data-linenum');

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
    function refreshSelection() {
        function applyOn(currMode, setValFn) {
            return function (i, item) {
                rowSelectionEvent(item, currMode);
                if (!lib.lineSelectionStore.supportsSessionStorage()) {
                    $(item).attr('disabled', 'disabled');

                } else {
                    setValFn(item);
                }
            }
        }
        var storeMode = lib.lineSelectionStore.getMode();
        if (getUISelectionMode() !== storeMode) {
            switchSelectionModeUI();
        }
        $('#selection-mode-switch').val(storeMode);
        if (storeMode === 'simple') {
            $('#conclines td.manual-selection input[type=\'checkbox\']').each(applyOn(storeMode, function (item) {
                if (lib.lineSelectionStore.containsLine($(item).attr('data-position'))) {
                    item.checked = true;

                } else {
                    item.checked = false;
                }
            }));

        } else if (storeMode === 'groups') {
            $('#conclines td.manual-selection input[type=\'text\']').each(applyOn(storeMode, function (item) {
                var data = lib.lineSelectionStore.getLine($(item).attr('data-position'));

                if (data) {
                    $(item).val(data[1]);
                }
            }));
        }
        showNumSelectedItems();
    }

    function showGroupsStats(triggerSelect) {
        var jqAnchor = $(triggerSelect);

        function renderChart(data, rootElm) {
            var width = 200,
                height = 200,
                radius = Math.min(width, height) / 2;

            var color = d3.scale.category20();

            var arc = d3.svg.arc()
                .outerRadius(radius - 10)
                .innerRadius(0);

            var labelArc = d3.svg.arc()
                .outerRadius(radius - 40)
                .innerRadius(radius - 40);

            var pie = d3.layout.pie()
                .value(function(d) { return d['count']; });

            data = pie(data);

            var wrapper = d3.select(rootElm).append('svg')
                .attr('width', width)
                .attr('height', height)
                .append('g')
                    .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')')
                    .attr('class', 'chart-wrapper');

            var g = wrapper.selectAll('.arc')
                .data(data).enter()
                    .append('g')
                    .attr('class', 'arc');

            g.append('path')
                .attr('d', arc)
                .style('fill', function(d, i) { return color(i);});
            g.append('text')
                .attr('transform', function(d) {
                        return 'translate(' + labelArc.centroid(d) + ')';
                        }
                    )
                .text(function(d) { return d.data['group']; });
            return color;
        }

        function renderLabels(data, colors, rootElm) {
            var wrapper = window.document.createElement('div');
            var spanElm;

            $(wrapper).addClass('chart-label');

            data.forEach(function (item, i) {
                spanElm = window.document.createElement('span');
                $(spanElm)
                    .css({
                        'background-color': colors(i)
                    })
                    .addClass('color-code')
                    .text('\u00A0');
                $(wrapper).append(spanElm);
                spanElm = window.document.createElement('span');
                $(spanElm)
                    .addClass('label-text')
                    .append('<strong>' + item['group'] + '</strong> (' + item['count'] + 'x)');
                $(wrapper).append(spanElm);
            });
            $(rootElm).append(wrapper);
        }

        function createChart(box, finalize) {

            lib.layoutModel.ajax(
                'GET',
                lib.layoutModel.createActionUrl('ajax_get_line_groups_stats?')
                        + lib.layoutModel.getConf('stateParams'),
                {},
                {contentType : 'application/x-www-form-urlencoded'}
            ).then(
                function (data) {
                    var chartData = [],
                        p,
                        colors;

                    for (p in data) {
                        chartData.push({group: '#' + p, count: data[p]}); // TODO group '#' should be implicit
                    }
                    $(box.getRootElement()).append(
                        '<h3>' + lib.layoutModel.translate('global__groups_stats_heading') + '</h3>'
                    );
                    colors = renderChart(chartData, box.getRootElement());
                    renderLabels(chartData, colors, box.getRootElement());
                    finalize();
                },
                function (err) {
                    finalize();
                    box.close();
                    lib.layoutModel.message('error', err);
                }
            );
        }

        popupBox.open(
            createChart,
            {
                top: jqAnchor.offset().top,
                left: jqAnchor.offset().left,
                height: jqAnchor.height()
            },
            {
                type : 'plain',
                domId : 'line-group-stats',
                calculatePosition: true,
                closeIcon : true,
                timeout : null,
                onClose : function () {
                    $(triggerSelect).val('');
                }
            }
        );
    }

    function reEnableLineGroupEditing() {
        lib.layoutModel.ajax(
            'GET',
            lib.layoutModel.createActionUrl('ajax_get_line_selection?')
                + lib.layoutModel.getConf('stateParams'),
            {},
            {contentType : 'application/x-www-form-urlencoded'}

        ).then(
            function (data) {
                $('#selection-mode-switch')
                    .attr('disabled', null);
                lib.hasLockedGroups = false;
                lib.lineSelectionStore.importData(data);
                switchSelectionModeUI();
                bindSelectionModeSwitch();
                showNumSelectedItems();
                window.foo = lib.lineSelectionStore.clStorage;
            },
            function (err) {
                lib.layoutModel.showMessage('error', err);
            }
        );
    }

    /**
     *
     * @param numSelected
     */
    function showNumSelectedItems() {
        var linesSelectionWrap = $('#result-info .lines-selection'),
            createContent,
            numSelected = lib.lineSelectionStore.size(),
            viewMenuLink,
            groupActionsSelect;

        linesSelectionWrap.empty();

        if (lib.hasLockedGroups) {
            groupActionsSelect = window.document.createElement('select');
            $(groupActionsSelect)
                .append($(window.document.createElement('option'))
                    .attr('value', '')
                    .text('--'))
                .append($(window.document.createElement('option'))
                    .attr('value', 'see-stats')
                    .text(lib.layoutModel.translate('global__see_groups_stats')))
                .append($(window.document.createElement('option'))
                    .attr('value', 'edit-groups')
                    .text(lib.layoutModel.translate('global__continue_editing_groups')))
                .append($(window.document.createElement('option'))
                    .attr('value', 'sort-groups')
                    .text(lib.layoutModel.translate('global__view_sorted_groups')))
                .append($(window.document.createElement('option'))
                    .attr('value', 'clear-groups')
                    .text(lib.layoutModel.translate('global__clear_line_groups')))

            $(groupActionsSelect).on('change', function (evt) {
                if ($(evt.target).val() === 'clear-groups') {
                    lib.lineSelectionStore.resetServerLineGroups();

                } else if ($(evt.target).val() === 'see-stats') {
                    showGroupsStats(groupActionsSelect);

                } else if ($(evt.target).val() === 'edit-groups') {
                    reEnableLineGroupEditing();

                } else {
                    window.location.href = 'view?' + lib.layoutModel.getConf('stateParams') + '&sort_linegroups=1';
                }
            });
            linesSelectionWrap.append(groupActionsSelect);

        } else {
            createContent = function (box, finalize) {
                var actionRegId = lib.layoutModel.dispatcher.register(function (payload) {
                    if (payload.actionType === 'ERROR') {
                        box.close();
                        lib.layoutModel.dispatcher.unregister(actionRegId);
                    }
                });
                lib.lineSelectionStore.addActionFinishHandler(function () {
                    box.close();
                });
                lib.layoutModel.renderReactComponent(lib.views.LineSelectionMenu,
                        box.getRootElement(), {doneCallback: finalize.bind(lib.layoutModel)});
            };

            viewMenuLink = window.document.createElement('a');

            $(viewMenuLink).text('(' + numSelected + ' ' + lib.layoutModel.translate('global__selected_lines') + ')');
            if (!popupBox.hasAttachedPopupBox(viewMenuLink)) {
                popupBox.bind(viewMenuLink, createContent, {
                    type : 'plain',
                    closeIcon : true,
                    timeout: null,
                    onClose: function () {
                        lib.layoutModel.unmountReactComponent(this.getRootElement());
                        lib.lineSelectionStore.removeAllActionFinishHandlers();
                    }
                });
            }
            linesSelectionWrap.append(viewMenuLink);
            if (numSelected === 0) {
                $(viewMenuLink).hide();

            } else if (!linesSelectionWrap.is(':visible')) {
                $(viewMenuLink).show();
            }
        }
    }

    // TODO refactor this (redundant code)
    function switchSelectionModeUI() {
        var mode = lib.lineSelectionStore.getMode();
        function applyStoredValue(jqElm) {
            var line = lib.lineSelectionStore.getLine(jqElm.attr('data-position'));
            if (line && mode === 'groups') {
                jqElm.val(line[1]);

            } else if (line && mode === 'simple') {
                jqElm.prop('checked', true);
            }
        }

        if (mode === 'simple') {
            $('#conclines').find('td.manual-selection > *').each(function (item) {
                var inputElm = window.document.createElement('input');
                var kwiclen = $(this).attr('data-kwiclen');
                var position = $(this).attr('data-position');
                var lineNum = $(this).attr('data-linenum');
                $(inputElm)
                    .attr('type', 'checkbox')
                    .attr('data-kwiclen', kwiclen)
                    .attr('data-position', position)
                    .attr('data-linenum', lineNum);
                $(this).replaceWith(inputElm);
                applyStoredValue($(inputElm));
                rowSelectionEvent(inputElm, 'simple');
            });

        } else if (mode === 'groups') {
            $('#conclines').find('td.manual-selection > *').each(function (item) {
                var inputElm = window.document.createElement('input');
                var kwiclen = $(this).attr('data-kwiclen');
                var position = $(this).attr('data-position');
                var lineNum = $(this).attr('data-linenum');
                var defaultGroupid = 1;
                $(inputElm)
                    .attr('type', 'text')
                    .attr('data-kwiclen', kwiclen)
                    .attr('data-position', position)
                    .attr('data-linenum', lineNum)
                    .css('width', '2em');
                $(this).replaceWith(inputElm);
                applyStoredValue($(inputElm));
                rowSelectionEvent(inputElm, 'groups');
            });
        }
    }


    function bindSelectionModeSwitch() {
        $('#selection-mode-switch')
            .off('change')
            .on('change', function (evt) {
                var mode = $(evt.currentTarget).val();
                lib.lineSelectionStore.setMode(mode);
                switchSelectionModeUI();
                showNumSelectedItems();
            }
        );
    }


    /**
     * Handles clicking on concordance line checkbox
     */
    function rowSelectionEvent(elm, mode) {
        if (mode === 'simple') {
            $(elm).on('click', function (e) {
                var id = $(e.currentTarget).attr('data-position'),
                    kwiclen = parseInt($(e.currentTarget).attr('data-kwiclen') || 1, 10);
                if ($(e.currentTarget).is(':checked')) {
                    lib.lineSelectionStore.addLine(id, kwiclen, null);

                } else {
                    lib.lineSelectionStore.removeLine(id);
                }
                showNumSelectedItems();
            });

        } else if (mode === 'groups') {
            $(elm).on('change keyup', function (e) {
                var id = $(e.currentTarget).attr('data-position'),
                    kwiclen = parseInt($(e.currentTarget).attr('data-kwiclen') || 1, 10),
                    groupId = parseInt($(e.currentTarget).val() || 0, 10);

                if ($(e.currentTarget).val() !== '') {
                    lib.lineSelectionStore.addLine(id, kwiclen, groupId);

                } else {
                    lib.lineSelectionStore.removeLine(id);
                }
                showNumSelectedItems();
            });
        }
    }

    /**
     * Ensures that concordance lines are serialized once user leaves the page.
     */
    function onUnloadSerialize() {
        $(win).on('unload', function () {
            lib.lineSelectionStore.serialize();
        });
    }

    /**
     * User must be notified in case he wants to leave the page but at the same time he
     * has selected some concordance lines without using them in a filter.
     */
    function onBeforeUnloadAsk() {
        $(win).on('beforeunload.alert_unsaved', function (event) {
            if (lib.lineSelectionStore.size() > 0) {
                event.returnValue = lib.layoutModel.translate('global__are_you_sure_to_leave');
                return event.returnValue;
            }
            return undefined; // !! any other value will cause the dialog window to be shown
        });
    }

    /**
     * Some links/forms must be allowed to avoid beforeunload check (e.g. pagination)
     */
    function grantPaginationPageLeave() {
        $('.bonito-pagination form').on('submit', function () {
            $(win).off('beforeunload.alert_unsaved');
        });

        $('.bonito-pagination a').on('click', function () {
            $(win).off('beforeunload.alert_unsaved');
        });
    }

    /**
     *
     */
    function anonymousUserWarning() {
        var left,
            box,
            top;

        box = popupBox.open(lib.layoutModel.translate('global__anonymous_user_warning',
                {login_url: lib.layoutModel.getConf('loginUrl')}),
                {top: 0, left: 0}, {type: 'warning'});
        left = $(win).width() / 2 - box.getPosition().width / 2;
        top = $('#conc-wrapper').offset().top + 40;
        box.setCss('left', left + 'px');
        box.setCss('top', top + 'px');
        box.setCss('font-size', '120%');
        box.setCss('height', '70px');
    }

    function attachMouseWheelEvents(area, fn) {
        area = $(area).get(0);
        area.addEventListener("mousewheel", fn, false);
	    // Firefox
	    area.addEventListener("DOMMouseScroll", fn, false);
    }

    /**
     * This function is taken from jscrollpane demo page
     */
    function initConcViewScrollbar() {
        var elm = $('#conclines-wrapper'),
            api;

        elm.jScrollPane();
        api = elm.data('jsp');
        $(win).on('resize', function () {
            api.reinitialise();
        });
        $(win).on('keydown', function (event) {
            if ($('#conclines-wrapper:visible').length > 0 && [37, 39].indexOf(event.keyCode) > -1) {
                event.preventDefault();
            }
            if ($('input:focus').length === 0) {
                if (event.keyCode === 37) {
                    api.scrollToPercentX(Math.max(api.getPercentScrolledX() - 0.2, 0));

                } else if (event.keyCode === 39) {
                    api.scrollToPercentX(Math.min(api.getPercentScrolledX() + 0.2, 1));
                }
            }
        });

        attachMouseWheelEvents(elm, function (evt) {
            if (evt.shiftKey) {
                var delta = Math.max(-1, Math.min(1, (evt.wheelDelta || -evt.detail)));
                api.scrollBy(delta * 40, 0, false);
                evt.preventDefault();
            }
        });

        lib.touchHandler.attachTouchEvents(elm, function (delta) {
            api.scrollBy(-delta, 0, false);
        });
    }

    /**
     * Fills in thousands separator ',' (comma) character into a number string
     *
     * @param {string|number} nStr number string (/\d+(.\d*)?)
     * @return {string} number string with thousands separated by the ',' (comma) character
     */
    function addCommas(nStr) {
        var x,
            x1,
            x2,
            rgx = /(\d+)(\d{3})/;

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
    function misc() {
        $('#groupmenu').attr('corpname', lib.layoutModel.conf.corpname);
        $('#groupmenu').attr('queryparams', lib.layoutModel.conf.q);
        $('#groupmenu').mouseleave(lib.close_menu);

        $('td.kw b,td.par b,td.coll b,td.par span.no-kwic-text').bind('click', function (event) {
            var jqRealTarget = null;

            if ($(event.target).data('url')) {
                jqRealTarget = $(event.target);

            } else if ($(event.target).parent().data('url')) {
                jqRealTarget = $(event.target).parent();
            }

            detail.showDetail(
                event.currentTarget,
                jqRealTarget.data('url'),
                jqRealTarget.data('params'),
                lib.layoutModel,
                lib.viewDetailDoneCallback
            );
            event.stopPropagation();
        });

        $('td.ref').bind('click', function (event) {
            $(event.target).closest('tr').addClass('active');
            detail.showRefDetail(
                event.target,
                $(event.target).data('url'),
                $(event.target).data('params'),
                function (jqXHR, textStatus, errorThrown) {
                    lib.layoutModel.showMessage('error', errorThrown);
                },
                lib.layoutModel
            );
            event.stopPropagation();
        });

        $('#hideel').bind('click', detail.closeDetail);

        $('a.speech-link').each(function () {
            $(this).bind('click', function (event) {
                detail.openSpeech(this);
                event.stopPropagation();
                event.preventDefault();
                return false;
            });
        });
    }

    function addWarnings() {
        var jqTriggerElm;

        jqTriggerElm = $('#result-info').find('.size-warning');
        popupBox.bind(
            jqTriggerElm,
            lib.layoutModel.translate('global__size_warning', {size: jqTriggerElm.data('size-limit')}),
            {
                type: 'warning',
                width: 'nice'
            }
        );
    }

    function soundManagerInit() {
        SoundManager.soundManager.setup({
            url: '../files/misc/soundmanager2/',
            flashVersion: 9,
            debugMode : false,
            preferFlash : false
        });
    }

    /**
     *
     * @param boxInst
     */
    lib.viewDetailDoneCallback = function (boxInst) {
        $('a.expand-link').each(function () {
            $(this).one('click', function (event) {
                detail.showDetail(
                    event.currentTarget,
                    $(this).data('url'),
                    $(this).data('params'),
                    lib.layoutModel,
                    // Expand link, when clicked, must bind the same event handler
                    // for the new expand link. That's why this 'callback recursion' is present.
                    lib.viewDetailDoneCallback
                );
                event.preventDefault();
            });
        });
        lib.layoutModel.mouseOverImages(boxInst.getRootElement());
    };

    /**
     *
     */
    lib.reloadHits = function () {
        var freq = 500;

        $('#conc-loader').empty().append('<img src="../files/img/ajax-loader.gif" alt="'
            + lib.layoutModel.translate('global__calculating')
            + '" title="' + lib.layoutModel.translate('global__calculating')
            + '" style="width: 24px; height: 24px" />');
        $('#arf').empty().html(lib.layoutModel.translate('global__calculating'));
        /*
         * Checks periodically for the current state of a concordance calculation
         */
        jqueryPeriodic({ period: freq, decay: 1.2, max_period: 60000 }, function () {
            $.ajax({
                url: 'get_cached_conc_sizes?' + lib.layoutModel.conf.q + '&' + lib.layoutModel.conf.globals,
                type: 'POST',
                periodic: this,
                success: function (data) {
                    var num2Str;

                    num2Str = function (n) {
                        return lib.layoutModel.formatNum(n, data.thousandsSeparator, data.decimalSeparator);
                    };

                    if (data.end) {
                        freq = 5;
                    }

                    $('#result-info span.ipm').html(num2Str(data.relconcsize.toFixed(2)));
                    $('.numofpages').html(num2Str(Math.ceil(data.concsize / lib.layoutModel.conf.numLines)));

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
    function makePageReusable(conf) {
        if (Modernizr.history) {
            window.history.replaceState({}, window.document.title, '/view?' + conf.stateParams);

        } else if (!conf.replicableQuery) {
            window.location.href = '/view?' + conf.stateParams;
        }
    }

    function attachIpmCalcTrigger(layoutModel) {
        $('#conc-top-bar').find('.calculate-ipm').on('click', function (event) {
            var q = '[] ' + decodeURIComponent($(event.target).data('query')),
                totalHits = parseInt($(event.target).data('total-hits')),
                prom,
                loaderBox = window.document.createElement('span'),
                loaderImg = window.document.createElement('img'),
                userConfirm;

            userConfirm = window.confirm(layoutModel.translate('global__ipm_calc_may_take_time'));

            if (userConfirm) {
                $(loaderImg)
                    .attr('src', layoutModel.createStaticUrl('img/ajax-loader.gif'));

                prom = $.ajax(
                        layoutModel.createActionUrl('ajax_get_within_max_hits'),
                        {
                            data: {
                                query: q,
                                corpname: layoutModel.getConf('corpname')
                            },
                            dataType: 'json'
                        }
                );
                $(loaderBox)
                    .attr('id', 'ipm-loader')
                    .css('position', 'inherit')
                    .append(loaderImg)
                    .append(layoutModel.translate('global__calculating'));
                $(event.target).replaceWith(loaderBox);

                prom.then(
                    function (data) {
                        var ipm = (totalHits / data.total * 1e6).toFixed(2);
                        $(loaderBox).replaceWith('<span class="ipm">' + ipm + '</span>');
                    },
                    function (err) {
                        $(loaderBox).remove();
                        layoutModel.showMessage('error', layoutModel.translate('global__failed_to_calc_ipm'));
                    }
                );
            }
        });
    }

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        lib.layoutModel = new documentModule.PageModel(conf);
        lib.layoutModel.init();
        lib.touchHandler = new TouchHandler();
        lib.lineSelectionStore = new concStores.LineSelectionStore(lib.layoutModel,
                lib.layoutModel.dispatcher, conclines.openStorage(), 'simple');

        lib.lineSelectionStore.addClearSelectionHandler(refreshSelection);

        lib.views = concViews.init(lib.layoutModel.dispatcher, lib.layoutModel.exportMixins(),
                lib.lineSelectionStore);

        lib.hasLockedGroups = lib.layoutModel.getConf('containsLinesGroups');

        if (lib.hasLockedGroups) {
            setDefinedGroups();

        } else {
            bindSelectionModeSwitch();
            refreshSelection();
        }
        showNumSelectedItems();

        misc();
        addWarnings();
        initConcViewScrollbar();
        if (conf.anonymousUser) {
            anonymousUserWarning();
        }

        onBeforeUnloadAsk();
        onUnloadSerialize();
        grantPaginationPageLeave();
        soundManagerInit();
        makePageReusable(conf);
        attachIpmCalcTrigger(lib.layoutModel);
    };

    module.exports = lib;

});