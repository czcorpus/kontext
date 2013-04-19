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
define(['win', 'jquery', 'jquery.periodic', 'tpl/document', 'detail', 'annotconc', 'simplemodal'], function (win, $,
            jqueryPeriodic, documentPage, detail, annotConc, _sm) {
    'use strict';

    var lib = {};

    lib.misc = function (conf) {
        var callback;

        $('#groupmenu').attr('annotconc', conf.annotconc);
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
        if (conf.canAnnotate && conf.annotConc) {
            $('#conclines').observe('mousedown', annotConc.handle_selection);
        }
        $('a.speech-link').each(function () {
            $(this).bind('click', function (event) {
                detail.openSpeech(this);
                event.stopPropagation();
                return false;
            });
        });
    };

    lib.bindClicks = function (conf) {
        if (conf.canAnnotate) {
            $('td.par span.groupbox').each(function () {
                $(this).bind('click', function (event) {
                    annotConc.show_groupmenu(event.target, $(this).data('pos'));
                });
            });
        }

        if (conf.annotConc) {
            $('td.rc span.groupbox').each(function () {
                $(this).bind('click', function (event) {
                    annotConc.show_groupmenu(event.target, $(this).data('pos'));
                });
            });

            $('.add-new-annotation-label').bind('click', function () {
                annotConc.add_new_annotation_label();
            });

            $('#number_globally span.groupbox').each(function () {
                $(this).bind('click', function (event) {
                    annotConc.show_groupmenu(event.target, $(this).data('pos'));
                });
            });

            $('#number_selected span.groupbox').each(function () {
                $(this).bind('click', function (event) {
                    annotConc.show_groupmenu(event.target, $(this).data('pos'));
                });
            });

            $('#number_selected a.clear_selection').bind('click', function () {
                annotConc.clear_selection();
            });

            $('#annot_undo').bind('click', function () {
                annotConc.undo_last_action();
            });

            $('#groupmenu .assign-group').each(function () {
                $(this).bind('click', function (event) {
                    annotConc.assign_group($(this).data('grpid'), $(this).data('grplabel'));
                });
            });
        }
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
        var freq = 100,
            countup = 30;

        jqueryPeriodic({ period: freq, decay: 1.2, max_period: 60000 }, function () {
            $.ajax({
                url: 'get_cached_conc_sizes?' + conf.q + ';' + conf.globals,
                type: 'POST',
                periodic: this,
                complete: function (data) {
                    var sizes,
                        end,
                        newCSize,
                        relCSize,
                        newFSize,
                        jqCSize,
                        jqFSize,
                        jqNPages,
                        jqLPage,
                        inc,
                        newNPages,
                        nPagesN,
                        pgInc,
                        incConcSize,
                        l,
                        fSizeN,
                        nPagesT,
                        incSize;

                    sizes = data.responseText.split('\n');
                    if (sizes.length !== 4) {
                        return;
                    }
                    end = parseInt(sizes[0], 10);
                    newCSize = parseInt(sizes[1], 10);
                    relCSize = parseFloat(sizes[2]);
                    newFSize = parseInt(sizes[3], 10);
                    if (isNaN(end) || isNaN(newCSize) || isNaN(relCSize) || isNaN(newFSize)) {
                        return;
                    }
                    if (end) {
                        freq = 5;
                    }
                    jqCSize = $('#concsize');
                    jqFSize = $('#fullsize');
                    jqNPages = $('.numofpages');
                    jqLPage = $('#lastpage');
                    inc = Math.round((newCSize - parseInt(jqCSize.attr('title'), 10)) /
                        (freq * 1000 / countup));
                    newNPages = Math.ceil(newCSize / conf.numLines);
                    nPagesN = parseInt(jqNPages.attr('title'), 10);
                    pgInc = (newNPages - nPagesN) / (freq * 1000.0 / countup);
                    incConcSize = function (newCSize, newNPages, end, pginc) {
                        var csizen = parseInt(jqCSize.attr('title'), 10);

                        jqCSize.html(conf.messages.using_random);
                        if (csizen >= newCSize) {
                            jqCSize.attr('title', newCSize);
                            jqCSize.append(lib.addCommas(newCSize));
                            if (!end) {
                                jqCSize.append(conf.messages.counting);
                            }
                            jqCSize.append(conf.messages.lines_only);
                            jqLPage.attr('href', "view?" + conf.q + ";" + conf.globals + ";fromp=" + newNPages);
                            jqNPages.attr('title', lib.addCommas(newNPages));
                            return;
                        }
                        jqCSize.attr('title', (csizen + inc).toString());
                        jqCSize.append(lib.addCommas(jqCSize.attr('title')) + ' ' + conf.messages.counting
                                + ' ' + conf.messages.lines_only + '.');
                        nPagesN += pginc;
                        nPagesT = Math.ceil(nPagesN).toString();
                        jqLPage.attr('href', "view?" + conf.q + ";" + conf.globals + ";fromp=" + nPagesT);
                        jqNPages.attr('title', nPagesT);
                        nPagesT = lib.addCommas(nPagesT);
                        jqNPages.text(nPagesT);
                        win.setTimeout(function () { incConcSize(newCSize, newNPages, end, pginc); }, countup);
                    };
                    if (newFSize > 0) {
                        if (conf.q2 !== "R") {
                            l = lib.addCommas(newCSize);
                            jqCSize.html(conf.messages.using_first + l +
                                conf.messages.lines_only + '. <a href="view?' +
                                'q=R' + conf.q2toEnd + ';' + conf.globals + '">' + conf.messages.use_random + ' ' +
                                l + ' ' + conf.messages.instead + '.</a>');
                            newCSize = newFSize;

                        } else {
                            incConcSize(newCSize, newNPages, end, pgInc);
                            if (end) {
                                win.setTimeout(this.periodic.cancel, 1000);
                            }
                            return;
                        }
                    }
                    fSizeN = parseInt(jqFSize.attr('title'), 10);
                    inc = (newCSize - fSizeN) / (freq * 1000 / countup);
                    incSize = function (newcsize, newnpages, end, inc) {
                        fSizeN += inc;
                        if (fSizeN >= newcsize) {
                            jqFSize.attr('title', newcsize);
                            jqFSize.html(lib.addCommas(newcsize));
                            if (!end) {
                                jqFSize.append(' (' + conf.messages.counting + ')');
                            }
                            $('#relconcsize').html('('
                                + lib.addCommas(relCSize.toFixed(1).toString())
                                + ' ' + conf.messages.per_million + ')');
                            jqLPage.attr('href', "view?' + conf.q + ';' + conf.globals + ';fromp=" + newnpages);
                            jqNPages.attr('title', newnpages);
                            newnpages = lib.addCommas(newnpages);
                            jqNPages.text(newnpages);
                            return;
                        }
                        jqFSize.attr('title', Math.ceil(fSizeN));
                        jqFSize.html(lib.addCommas(jqFSize.attr('title')) + ' (' + conf.messages.counting + ')');
                        nPagesN += pgInc;
                        nPagesT = Math.ceil(nPagesN).toString();
                        jqLPage.attr('href', "view?" + conf.q + ";" + conf.globals + ";fromp=" + nPagesT);
                        jqNPages.attr('title', nPagesT);
                        nPagesT = lib.addCommas(nPagesT);
                        jqNPages.text(nPagesT);
                        win.setTimeout(function () { incSize(newcsize, newnpages, end, inc); }, countup);
                    };
                    incSize(newCSize, newNPages, end, inc);
                    if (end) {
                        win.setTimeout(this.periodic.cancel, 1000);
                    }
                },
                dataType: 'text'
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
        lib.bindClicks(conf);
    };


    return lib;

});