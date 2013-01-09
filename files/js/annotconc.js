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

function show_undo_action(request) {
    Element.show($('annot_undo'));
    eval('res=' + request.responseText);
    $('annot_undo_count').innerHTML = res.count;
    $('groupmenu').actionid = res.actionid;
}

function assing_group(grpid, grplabel) {
    var grpmenu=$('groupmenu');
    var params = 'annotconc=' + grpmenu.annotconc
		 + '&corpname=' + grpmenu.corpname + '&group=' + grpid;
    var method_name = 'setlngroup';
    var onCompletefn = null;
    if (grpmenu.firstparam == 'select') {
	if ($('num_of_selected_lines').innerHTML != 0) {
	    params += '&toknum=' + get_selected_toknums();
	    show_assigned_globally(grplabel, false);
 	} else {
	    method_name += 'globally';
	    params += '&' + grpmenu.queryparams;
	    show_assigned_globally(grplabel, true);
	}
	onCompletefn = show_undo_action;
    } else if (grpmenu.firstparam[0] == 'w' ) {
	// word sketch annotation -> from conc
	method_name += 'globally';
	params += '&q=' + grpmenu.firstparam;
	onCompletefn = show_undo_action;
    } else {
            params += '&toknum=' + grpmenu.firstparam;
	    Element.hide($('annot_undo'));
    }
    $.ajax({
        url : method_name,
        data : params,
        method: 'get',
	    complete: onCompletefn
    });
    grpmenu.sourceel.innerHTML = grplabel;
    close_menu(grpmenu);
}

function assigned_callback(request) {
}


function close_menu(grpmenu) {
    grpmenu.style.visibility = 'hidden';
    $(grpmenu.sourceel).unbind('mouseout', cancel_menu)
    var element = grpmenu.sourceel;
    while (element.parentNode && (!element.tagName || element.tagName != 'TR'))
        element = element.parentNode;
    if (element.tagName && element.tagName == 'TR')
        Element.removeClassName(element, 'highlight');
}

function highlight_parent_row(element) {
    while (element.parentNode && (!element.tagName || element.tagName != 'TR'))
        element = element.parentNode;
    Element.addClassName(element, 'highlight');
}


function cancel_menu(event) {
     var grpmenu = $('groupmenu');
     if (!grpmenu || !grpmenu.sourceel){ return;}
     var x = Event.pointerX(event);
     var y = Event.pointerY(event);
     if (!Position.within(grpmenu.sourceel, x, y)
         && !Position.within(grpmenu, x, y)) {
	 close_menu(grpmenu);
     }
}

function show_groupmenu(element, pos) {
    grpmenu = $('groupmenu');  
    if(!grpmenu.style.position || grpmenu.style.position == 'absolute') {
        var offsets = Position.cumulativeOffset(element);
        grpmenu.style.left = offsets[0] + 'px';
        grpmenu.style.top  = (offsets[1] + element.offsetHeight) + 'px';
        grpmenu.style.position = 'absolute';
	grpmenu.style.visibility = 'visible';
	grpmenu.sourceel = element;
	grpmenu.firstparam = pos;
	$(element).bind('mouseout', cancel_menu);
	if (pos != 'select') {
	    highlight_parent_row(element);
        }
	return false;
    }
}

function update_groupmenu(request) {
    $('groupmenu').innerHTML = request.responseText;
    $('newlabel').value = '';
}

function add_new_annotation_label() {
    var grpmenu=$('groupmenu');
    var newlabelel = $('newlabel');
    var params = 'annotconc=' + grpmenu.annotconc 
		 + '&corpname=' + grpmenu.corpname
                 + '&newlabel=' + newlabelel.value;
    $.ajax({
        url : 'addlngrouplabel',
        data: params,
        method:'get',
        complete: update_groupmenu
    });
}

var current_line;
function handle_selection(event) {
    event = event || window.event;
    var column = Event.findElement(event, 'TD');
    if (!column.className || Element.hasClassName(column, 'ref')
        || Element.hasClassName(column, 'kw'))
	return;
    if (column.className && Element.hasClassName(column, 'rc')) {
	column = Event.findElement(event, 'SPAN');
	if (column.className && Element.hasClassName(column, 'groupbox'))
	    return;
    }
    var line = Event.findElement(event, 'TR');
    var count = $('num_of_selected_lines');
    if (event.shiftKey && current_line) {
	var lines = $('conclines').rows;
	if (current_line > line.rowIndex) {
	    for (var i=line.rowIndex; i < current_line; i++)
		Element.addClassName(lines[i], 'selected');
	} else {
	    for (var i=line.rowIndex; i > current_line; i--)
		Element.addClassName(lines[i], 'selected');
	}
	count.innerHTML = 0;
	for (var i=0; i < lines.length; i++) {
            if (Element.hasClassName(lines[i], 'selected'))
		count.innerHTML++;
	}
        if (count.innerHTML == 0) {
	    Element.hide($('number_selected'));
	    Element.show($('number_globally'));
        } else {
	    Element.show($('number_selected'));
	    Element.hide($('number_globally'));
	}
    } else {
        if (Element.hasClassName(line, 'selected')) {
            Element.removeClassName(line, 'selected');
            count.innerHTML--;
            if (count.innerHTML == 0) {
	        Element.hide($('number_selected'));
                Element.show($('number_globally'));
            }
        } else {
            Element.addClassName(line, 'selected');
            if (count.innerHTML == 0) {
	        Element.show($('number_selected'));
                Element.hide($('number_globally'));
            }
            count.innerHTML++;
        }
    }
    current_line = line.rowIndex;
    Event.stop(event);
}

function clear_selection() {
    var lines = $('conclines').rows;
    for (var i=0; i < lines.length; i++)
 	Element.removeClassName(lines[i], 'selected');
    $('num_of_selected_lines').innerHTML = 0;
    Element.hide($('number_selected'));
    Element.show($('number_globally'));
}

function get_selected_toknums() {
    var lines = $('conclines').rows;
    var toknums = '';
    for (var i=0; i < lines.length; i++)
	if (Element.hasClassName(lines[i], 'selected'))
	     toknums += '+' + lines[i].getAttribute('toknum');
    return toknums;
}

function show_assigned_globally(grlabel, alllines) {
    var lines = $('conclines').rows;
    for (var i=0; i < lines.length; i++)
        if (alllines || Element.hasClassName(lines[i], 'selected')) {
	    var el = findElementWithClass (lines[i], 'groupbox');
            if (el) el.innerHTML = grlabel;
	    if (! alllines)
	        Element.removeClassName(lines[i], 'selected');
        }
    $('num_of_selected_lines').innerHTML = 0;
    Element.hide($('number_selected'));
    Element.show($('number_globally'));
}

function findElementWithClass(element, className) {
    if (element.tagName && Element.hasClassName(element, className)) {
	return element;
    }
    var childs = element.childNodes;
    for (var i=0; i < childs.length; i++) {
	var c = findElementWithClass(childs.item(i), className);
	if (c) return c;
    }
    return false;
}


function undo_last_action() {
    var grpmenu=$('groupmenu');
    var params = 'annotconc=' + grpmenu.annotconc 
		 + '&corpname=' + grpmenu.corpname
                 + '&action=' + grpmenu.actionid;
    $.ajax({
        url : 'undolngroupaction',
        data : params,
        method:'get'
    });
    Element.hide($('annot_undo'));
}
