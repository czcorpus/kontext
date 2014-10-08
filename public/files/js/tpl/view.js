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
        'SoundManager', 'vendor/jscrollpane'], function (win, $, jqueryPeriodic, layoutModel, detail,
                                                                popupBox, conclines, SoundManager) {
    'use strict';

    var lib = {},
        clStorage = conclines.openStorage();


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
                    prom = $.ajax('ajax_remove_selected_lines?pnfilter=' + pnfilter + '&' + layoutModel.conf.stateParams,
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
                                layoutModel.showMessage('error', data.error);
                            }
                        },
                        function (jqXHR, textStatus) {
                            box.close();
                            layoutModel.showMessage('error', textStatus);
                        }
                    );
                }
            });
            box.importElement(formElm);
            finalize();
        };

        linesSelection.text(layoutModel.translate('selected lines') + ': ' + numSelected);
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
            var id = $(e.currentTarget).attr('value');

            if ($(e.currentTarget).is(':checked')) {
                clStorage.addLine(id);

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
                event.returnValue = layoutModel.translate('are_you_sure_to_leave');
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

        box = popupBox.open(layoutModel.conf.messages.anonymous_user_warning,
            {top: 0, left: 0}, {type: 'warning'});
        left = $(win).width() / 2 - box.getPosition().width / 2;
        top = $('#conc-wrapper').offset().top + 40;
        box.setCss('left', left + 'px');
        box.setCss('top', top + 'px');
        box.setCss('font-size', '120%');
        box.setCss('height', '70px');
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
            if ($('#conclines-wrapper:focus').length > 0 && [37, 39].indexOf(event.keyCode) > -1) {
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
        $('#groupmenu').attr('corpname', layoutModel.conf.corpname);
        $('#groupmenu').attr('queryparams', layoutModel.conf.q);
        $('#groupmenu').mouseleave(lib.close_menu);

        $('td.kw b,td.par b,td.coll b,td.par span.no-kwic-text').bind('click', function (event) {
            var jqRealTarget = null;

            if ($(event.target).data('url')) {
                jqRealTarget = $(event.target);

            } else if ($(event.target).parent().data('url')) {
                jqRealTarget = $(event.target).parent();
            }

            detail.showDetail(
                event.target,
                jqRealTarget.data('url'),
                jqRealTarget.data('params'),
                function (jqXHR, textStatus, error) {
                    layoutModel.showMessage('error', error);
                },
                lib.viewDetailDoneCallback,
                layoutModel.createAjaxLoader()
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
                    layoutModel.showMessage('error', errorThrown);
                },
                layoutModel.createAjaxLoader()
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

        popupBox.bind(
            $('.calc-warning'),
            layoutModel.conf.messages.calc_warning,
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
                    event.target,
                    $(this).data('url'),
                    $(this).data('params'),
                    function (jqXHR, textStatus, errorThrown) {
                        layoutModel.showMessage('error', errorThrown);
                    },
                    // Expand link, when clicked, must bind the same event handler
                    // for the new expand link. That's why this 'callback recursion' is present.
                    lib.viewDetailDoneCallback,
                    layoutModel.createAjaxLoader()
                );
                event.preventDefault();
            });
        });
        layoutModel.mouseOverImages(boxInst.getRootElement());
    };

    /**
     *
     */
    lib.reloadHits = function () {
        var freq = 500;

        $('#loader').empty().append('<img src="../files/img/ajax-loader.gif" alt="'
            + layoutModel.conf.messages.calculating + '" title="' + layoutModel.conf.messages.calculating
            + '" style="width: 24px; height: 24px" />');
        $('#arf').empty().html(layoutModel.conf.messages.calculating);

        /*
         * Checks periodically for the current state of a concordance calculation
         */
        jqueryPeriodic({ period: freq, decay: 1.2, max_period: 60000 }, function () {
            $.ajax({
                url: 'get_cached_conc_sizes?' + layoutModel.conf.q + ';' + layoutModel.conf.globals,
                type: 'POST',
                periodic: this,
                success: function (data) {
                    var l,
                        num2Str;

                    num2Str = function (n) {
                        return layoutModel.formatNum(n, data.thousandsSeparator, data.decimalSeparator);
                    };

                    if (data.end) {
                        freq = 5;
                    }

                    $('#result-info span.ipm').html(num2Str(data.relconcsize.toFixed(2)));
                    $('.numofpages').html(num2Str(Math.ceil(data.concsize / layoutModel.conf.numLines)));

                    if (data.fullsize > 0) {
                        $('#fullsize').html(num2Str(data.fullsize));
                        $('#toolbar-hits').html(num2Str(data.fullsize));

                    } else {
                        $('#fullsize').html(num2Str(data.concsize));
                        $('#toolbar-hits').html(num2Str(data.concsize));
                    }

                    if (data.fullsize > 0 && layoutModel.conf.q2 !== "R") {
                        l = addCommas(data.concsize);
                        $('#conc-calc-info').html(layoutModel.conf.messages.using_first + ' ' + l +
                            layoutModel.conf.messages.lines_only + ' <a href="view?' +
                            'q=R' + layoutModel.conf.q2toEnd + ';' + layoutModel.conf.globals + '">'
                            + layoutModel.conf.messages.use_random + ' ' +
                            l + ' ' + layoutModel.conf.messages.instead + '.</a>');
                    }

                    if (data.finished) {
                        win.setTimeout(this.periodic.cancel, 1000);
                        $('#loader').empty();
                        /* TODO: Currently, we are unable to update ARF on the fly which means we
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
     *
     * @param conf
     */
    lib.init = function (conf) {
        layoutModel.init(conf);
        misc();
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
    };

    return lib;

});