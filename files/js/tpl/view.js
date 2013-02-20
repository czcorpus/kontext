/**
 * This module contains functionality related directly to the first_form.tmpl template
 */
define(['jquery', 'jquery.periodic', 'tpl/document', 'detail', 'annotconc'], function ($, jqueryPeriodic, documentPage,
                                                                                       detail, annotConc) {
    'use strict';

    var lib = {};

    lib.misc = function (conf) {
        $(document).ready(function () {
            $('#groupmenu').attr('annotconc', conf.annotconc);
            $('#groupmenu').attr('corpname', conf.corpname);
            $('#groupmenu').attr('queryparams', conf.q);
            $('#groupmenu').mouseleave(lib.close_menu);
        });

        var callback = function () {
            $('a.expand-link').each(function () {
                $(this).bind('click', function () {
                    detail.showDetail($(this).data('url'), $(this).data('params'), $(this).data('loadtext'), true, callback);
                });
            });
        };

        $('td.kw').bind('click', function (event) {
            detail.showDetail(
                $(event.target).parent().data('url'),
                $(event.target).parent().data('params'),
                $(event.target).parent().data('loadtext'),
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
            $('td.rc span.groupbox').each (function () {
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

            $('#groupmenu .assign-group').each (function () {
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
    lib.addCommas = function(nStr) {
        var x, x1, x2;

        nStr += '';
        x = nStr.split('.');
        x1 = x[0];
        x2 = x.length > 1 ? '.' + x[1] : '';
        var rgx = /(\d+)(\d{3})/;
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

        jqueryPeriodic({ period: freq, decay: 1.2, max_period: 60000 }, function() {
            $.ajax({
                url: 'get_cached_conc_sizes?' + conf.q + ';' + conf.globals,
                type: 'POST',
                periodic: this,
                complete: function(data) {
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
                        nPagesT;

                    sizes = data.responseText.split('\n');
                    if (sizes.length !== 4) {
                        return;
                    }
                    end = parseInt(sizes[0]);
                    newCSize = parseInt(sizes[1]);
                    relCSize = parseFloat(sizes[2]);
                    newFSize = parseInt(sizes[3]);
                    if (end === NaN || newCSize === NaN || relCSize === NaN || newFSize === NaN) {
                        return;
                    }
                    if (end) {
                        freq = 5;
                    }
                    jqCSize = $('#concsize');
                    jqFSize = $('#fullsize');
                    jqNPages = $('.numofpages');
                    jqLPage = $('#lastpage');
                    inc = Math.round((newCSize - parseInt(jqCSize.attr('title'))) /
                        (freq * 1000 / countup));
                    newNPages = Math.ceil(newCSize / conf.numLines);
                    nPagesN = parseInt(jqNPages.attr('title'));
                    pgInc = (newNPages - nPagesN) / (freq * 1000.0 / countup);
                    incConcSize = function (newCSize, newNPages, end, pginc) {
                        var csizen = parseInt(jqCSize.attr('title'));

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
                        setTimeout(function () { incConcSize(newCSize, newNPages, end, pginc); }, countup);
                    }
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
                                setTimeout(this.periodic.cancel, 1000);
                            }
                            return;
                        }
                    }
                    fSizeN = parseInt(jqFSize.attr('title'));
                    inc = (newCSize - fSizeN) / (freq * 1000 / countup);
                    function incSize(newcsize, newnpages, end, inc) {
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
                        setTimeout(function () { incSize(newcsize, newnpages, end, inc); }, countup);
                    }
                    incSize(newCSize, newNPages, end, inc);
                    if (end) {
                        setTimeout(this.periodic.cancel, 1000);
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