/**
 * This module contains functionality related directly to the first_form.tmpl template
 */
define(['jquery', 'tpl/document', 'detail', 'annotconc'], function ($, documentPage, detail, annotConc) {
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


    lib.init = function (conf) {
        documentPage.init(conf);
        lib.misc(conf);
        lib.bindClicks(conf);
    };


    return lib;

});