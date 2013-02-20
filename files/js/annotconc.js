/*
 * Copyright (c) 2003-2009 Pavel Rychly
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
define(['jquery', 'win'], function ($, win) {

    var lib = {};


    lib.show_undo_action = function (request) {
        $('#annot_undo').show();
        eval('res=' + request.responseText);
        $('#annot_undo_count').html(res.count);
        $('#groupmenu').attr('actionid', res.actionid);
    };

    lib.assign_group = function (grpid, grplabel) {
        var grpmenu = $('#groupmenu'),
            pars = 'annotconc=' + grpmenu.attr('annotconc') + '&corpname=' +
                grpmenu.attr('corpname') + '&group=' + grpid,
            method = 'setlngroup',
            cmplt_fn = null;

        if ($(win.document).data('param') == 'select') {
	        if ($('#num_of_selected_lines').html() != 0) {
	            pars += '&toknum=' + get_selected_toknums();
	            lib.show_assigned_globally(grplabel, false);

 	        } else {
	            method += 'globally';
	            pars += '&' + grpmenu.attr('queryparams');
	            lib.show_assigned_globally(grplabel, true);
	        }
	        cmplt_fn = lib.show_undo_action;

        } else {
            if ($(win.document).data('param')[0] == 'w' ) {
	            method += 'globally';
	            pars += '&q=' + $(win.document).data('param');
	            cmplt_fn = lib.show_undo_action;

            } else {
                pars += '&toknum=' + $(win.document).data('param');
	            $('#annot_undo').hide();
            }
        }

        $.ajax({ url: method, type: 'GET', data: pars, complete: cmplt_fn});
        $($(win.document).data('sourceel')).html(grplabel);
        lib.close_menu();
        lib.clear_selection();
    };

    lib.close_menu = function () {
        $('#groupmenu').hide();
        $($(win.document).data('sourceel')).closest('tr').removeClass('highlight');
    };

    lib.show_groupmenu = function (element, pos) {
        grpmenu = $('#groupmenu');
        var offset = $(element).offset();
        grpmenu.show();
        grpmenu.offset({ left: offset.left, top: offset.top });
        $(win.document).data('sourceel', element);
        $(win.document).data('param', pos.toString());
        if (pos != 'select') {
            $(element).closest('tr').addClass('highlight');
        }
        return false;
    };

    lib.add_new_annotation_label = function () {
        var grpmenu = $('#groupmenu');
        var newlabelel = $('#newlabel');
        var params = 'annotconc=' + grpmenu.attr('annotconc')
		        + '&corpname=' + grpmenu.attr('corpname')
                + '&newlabel=' + newlabelel.val();
        $.ajax({url: 'addlngrouplabel', data: params, type: 'GET',
            complete: function (data) {
                $('#groupmenu').html(data.responseText);
                $('#newlabel').val('');
            }
        });
    }

    var currline = -1;

    lib.handle_selection = function (event) {
        event.preventDefault();
        event.stopPropagation();
        var line = $(event.target).closest('tr');
        var countel = $('#num_of_selected_lines');
        if (event.shiftKey && currline != -1) {
	        var lines = $('.concline');
	        if (currline > getIndex(line)) {
	            for (var i = getIndex(line); i < currline; i++) {
                    $(lines[i]).addClass('selected');
                }

	        } else {
	            for (var i = getIndex(line); i > currline; i--) {
                    $(lines[i]).addClass('selected');
                }
	        }
            var c = $('tr.selected').length;
	        countel.html(c);
            if (c == 0) {
	            $('#number_selected').hide();
	            $('#number_globally').show();

            } else {
                $('#number_selected').show();
	            $('#number_globally').hide();
	        }

        } else {
            if (line.hasClass('selected')) {
                line.removeClass('selected');
                var c = $('tr.selected').length;
                if (c == 0) {
                    $('#number_selected').hide();
                    $('#number_globally').show();
                }
                countel.html(c);

            } else {
                line.addClass('selected');
                var c = $('tr.selected').length;
                if (c >= 1) {
                    $('#number_selected').show();
                    $('#number_globally').hide();
                }
                countel.html(c);
            }
        }
        currline = getIndex(line);
    };

    lib.getIndex = function (line) {
        return $(line).prevAll().length;
    };

    lib.clear_selection = function () {
        $('.concline').removeClass('selected');
        $('#num_of_selected_lines').html(0);
        $('#number_selected').hide();
        $('#number_globally').show();
    };

    lib.get_selected_toknums = function () {
        var toknums = '';
        $('.concline').each(function () {
            if ($(this).hasClass('selected')) {
                toknums += '+' + $(this).attr('toknum');
            }
        });
        return toknums;
    };

    lib.show_assigned_globally = function (grlabel, alllines) {
        $('.concline').each(function () {
            if (alllines || $(this).hasClass('selected')) {
                if ($(this).find('.groupbox')) {
                    $(this).find('.groupbox').html(grlabel);
                }
	            if (!alllines) {
                    $(this).removeClass('selected');
                }
            }
        });
        $('#num_of_selected_lines').html(0);
        $('#number_selected').hide();
        $('#number_globally').show();
    };

    lib.undo_last_action = function () {
        var grpmenu = $('#groupmenu');
        var params = 'annotconc=' + grpmenu.attr('annotconc') + '&corpname=' +
            grpmenu.attr('corpname') + '&action=' + grpmenu.attr('actionid');
        $.ajax({url: 'undolngroupaction', data: params, type: 'GET'});
        $('#annot_undo').hide();
    };

    return lib;

});
