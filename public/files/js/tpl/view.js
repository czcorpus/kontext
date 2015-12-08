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
define(['win', 'jquery', 'vendor/jquery.periodic', 'tpl/document', 'detail', 'popupbox', 'conclines',
        'SoundManager', 'vendor/jscrollpane'], function (win, $, jqueryPeriodic, documentModule, detail,
                                                                popupBox, conclines, SoundManager) {
    'use strict';

    var lib = {},
        clStorage = conclines.openStorage();

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


    /**
     * According to the data found in sessionStorage iterates over current page's
     * lines and (un)checks them appropriately. In case sessionStorage is not
     * supported all the checkboxes are disabled.
     */
    function refreshSelection() {
        $('#conclines tr input[type=\'checkbox\']').each(function () {
            if (!clStorage.supportsSessionStorage()) {
                $(this).attr('disabled', 'disabled');

            } else if (clStorage.containsLine($(this).val())) {
                this.checked = true;

            } else {
                this.checked = false;
            }
        });
    }

    /**
     *
     * @param numSelected
     */
    function showNumSelectedItems(numSelected) {
        var linesSelection = $('#result-info .lines-selection'),
            createContent;

        createContent = function (box, finalize) {
            var formElm = $('#selection-actions'),
                getAction;

            getAction = function () {
                return formElm.find('select[name=\'actions\']').val();
            };

            formElm.find('button.confirm').off('click').on('click', function () {
                var action = getAction(),
                    prom,
                    pnfilter,
                    filterCodeMapping = {'remove' : 'n', 'remove_inverted' : 'p'};

                if (action === 'clear') {
                    clStorage.clear();
                    refreshSelection();
                    box.close();

                } else {
                    pnfilter = filterCodeMapping[action];
                    prom = $.ajax('ajax_remove_selected_lines?pnfilter=' + pnfilter + '&' + lib.layoutModel.conf.stateParams,
                        {
                            dataType : 'json',
                            type : 'POST',
                            data : { rows : JSON.stringify(clStorage.getAll())}
                        }).promise();

                    prom.then(
                        function (data) {
                            box.close();
                            if (!data.error) {
                                clStorage.clear();
                                $(win).off('beforeunload.alert_unsaved');
                                win.location = data.next_url;

                            } else {
                                lib.layoutModel.showMessage('error', data.error);
                            }
                        },
                        function (jqXHR, textStatus) {
                            box.close();
                            lib.layoutModel.showMessage('error', textStatus);
                        }
                    );
                }
            });
            box.importElement(formElm);
            finalize();
        };

        linesSelection.text(lib.layoutModel.translate('global__selected_lines') + ': ' + numSelected);
        if (!popupBox.hasAttachedPopupBox(linesSelection)) {
            popupBox.bind(linesSelection, createContent, {
                type : 'plain',
                closeIcon : true
            });
        }
        if (numSelected === 0) {
            linesSelection.hide();
            linesSelection.prev('span.separ').hide();

        } else if (!linesSelection.is(':visible')) {
            linesSelection.show();
            linesSelection.prev('span.separ').show();
        }
    }


    /**
     * Handles clicking on concordance line checkbox
     */
    function rowSelectionEvent() {
        $('#conc-wrapper').on('click', 'input[type=\'checkbox\']', function (e) {
            var id = $(e.currentTarget).attr('value'),
                kwiclen = parseInt($(e.currentTarget).attr('data-kwiclen') || 1, 10);

            if ($(e.currentTarget).is(':checked')) {
                clStorage.addLine(id, kwiclen);

            } else {
                clStorage.removeLine(id);
            }
            showNumSelectedItems(clStorage.size());
        });
    }

    /**
     * Ensures that concordance lines are serialized once user leaves the page.
     */
    function onUloadSerialize() {
        $(win).on('unload', function () {
            clStorage.serialize();
        });
    }

    /**
     * User must be notified in case he wants to leave the page but at the same time he
     * has selected some concordance lines without using them in a filter.
     */
    function onBeforeUnloadAsk() {
        $(win).on('beforeunload.alert_unsaved', function (event) {
            if (clStorage.size() > 0) {
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
                {login_url: lib.layoutModel.getConf('login_url')}),
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
                lib.layoutModel.createAjaxLoader()
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
        misc();
        addWarnings();
        initConcViewScrollbar();
        if (conf.anonymousUser) {
            anonymousUserWarning();
        }
        rowSelectionEvent();
        refreshSelection();
        showNumSelectedItems(clStorage.size());
        onBeforeUnloadAsk();
        onUloadSerialize();
        grantPaginationPageLeave();
        soundManagerInit();
        makePageReusable(conf);
        attachIpmCalcTrigger(lib.layoutModel);
    };

    return lib;

});