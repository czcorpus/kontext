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
define(['win', 'jquery', 'jquery.periodic', 'tpl/document', 'detail', 'simplemodal'], function (win, $,
            jqueryPeriodic, documentPage, detail, _sm) {
    'use strict';

    var lib = {};

    lib.misc = function (conf) {
        var callback;

        $('#groupmenu').attr('corpname', conf.corpname);
        $('#groupmenu').attr('queryparams', conf.q);
        $('#groupmenu').mouseleave(lib.close_menu);

        callback = function () {
            $('a.expand-link').each(function () {
                $(this).bind('click', function () {
                    detail.showDetail($(this).data('url'), $(this).data('params'), $(this).data('loadtext'), true, callback);
                });
            });
        };

        $('td.kw b,td.par b,td.coll b,td.par span.no-kwic-text').bind('click', function (event) {
            var jqRealTarget = null;

            if ($(event.target).data('url')) {
                jqRealTarget = $(event.target);

            } else if ($(event.target).parent().data('url')) {
                jqRealTarget = $(event.target).parent();
            }

            detail.showDetail(
                jqRealTarget.data('url'),
                jqRealTarget.data('params'),
                jqRealTarget.data('loadtext'),
                true,
                callback
            );
        });

        $('td.ref').bind('click', function (event) {
            detail.showDetail(
                $(event.target).data('url'),
                $(event.target).data('params'),
                $(event.target).data('loadtext'),
                true
            );
        });

        $('#conclines a.copy-button').on('click', function (event) {
            var url = $(event.target).data('url'),
                data = $(event.target).data('params');

            $('#content #copy-conc-modal').remove();
            $('#content').append('<div id="copy-conc-modal">'
                + '<strong>' + conf.messages.ctrlc_to_copy + '</strong><br />'
                + '<textarea id="text-to-copy" rows="8" cols="70"></textarea>'
                + '</div>');

            $('#copy-conc-modal').modal({
                onShow : function () {
                    $.ajax({
                        url: url,
                        type: 'GET',
                        data: data,
                        dataType : 'json',
                        success: function (data) {
                            var rawText = '...';
                            $.each(data.content, function (i, item) {
                                rawText += item.str;
                            });
                            rawText += '...';
                            $('#text-to-copy').val(rawText).select();
                        }
                    });
                },
                onClose : function () {
                    $.modal.close();
                    $('#content #copy-conc-modal').remove();
                }
            });
        });

        $('#hideel').bind('click', detail.closeDetail);
        $('#detailframe').data('corpname', conf.corpname);

        $('a.speech-link').each(function () {
            $(this).bind('click', function (event) {
                detail.openSpeech(this);
                event.stopPropagation();
                return false;
            });
        });
    };

    /**
     * Fills in thousands separator ',' (comma) character into a number string
     *
     * @param {string|number} nStr number string (/\d+(.\d*)?)
     * @return {string} number string with thousands separated by the ',' (comma) character
     */
    lib.addCommas = function (nStr) {
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
    };

    /**
     *
     */
    lib.reloadHits = function (conf) {
        var freq = 500;

        $('#loader').empty().append('<img src="../files/img/ajax-loader.gif" alt="' + conf.messages.calculating + '" title="' + conf.messages.calculating + '" style="width: 24px; height: 24px" />');
        $('#arf').empty().html(conf.messages.calculating);

        /*
         * Checks periodically for the current state of a concordance calculation
         */
        jqueryPeriodic({ period: freq, decay: 1.2, max_period: 60000 }, function () {
            $.ajax({
                url: 'get_cached_conc_sizes?' + conf.q + ';' + conf.globals,
                type: 'POST',
                periodic: this,
                success: function (data) {
                    var l,
                        num2Str;

                    num2Str = function (n) {
                        return documentPage.formatNum(n, data.thousandsSeparator, data.radixSeparator);
                    };

                    if (data.end) {
                        freq = 5;
                    }

                    $('#result-info span.ipm').html(num2Str(data.relconcsize.toFixed(2)));
                    $('.numofpages').html(num2Str(Math.ceil(data.concsize / conf.numLines)));

                    if (data.fullsize > 0) {
                        $('#fullsize').html(num2Str(data.fullsize));
                        $('#toolbar-hits').html(num2Str(data.fullsize));

                    } else {
                        $('#fullsize').html(num2Str(data.concsize));
                        $('#toolbar-hits').html(num2Str(data.concsize));
                    }

                    if (data.fullsize > 0 && conf.q2 !== "R") {
                        l = lib.addCommas(data.concsize);
                        $('#conc-calc-info').html(conf.messages.using_first + ' ' + l +
                            conf.messages.lines_only + ' <a href="view?' +
                            'q=R' + conf.q2toEnd + ';' + conf.globals + '">' + conf.messages.use_random + ' ' +
                            l + ' ' + conf.messages.instead + '.</a>');
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
        documentPage.init(conf);
        lib.misc(conf);
    };


    return lib;

});