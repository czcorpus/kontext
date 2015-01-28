/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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

import $ = require('jquery');

/**
 *
 */
export interface Options {
    title:string;
}

/**
 *
 */
enum Visibility {
    VISIBLE, HIDDEN
}

/**
 *
 */
export interface CorplistItem {
    name: string;
    description: string;
    value: string;
    featured: number;
    size: any;
}


/**
 *
 * @param select
 * @returns {Array<CorplistItem>}
 */
function fetchDataFromSelect(select:HTMLElement):Array<CorplistItem> {
    var elm:JQuery = $(select),
        ans:Array<CorplistItem> = [];

    elm.find('option').each(function () {
        ans.push({
            name: $(this).text(),
            description: $(this).attr('title'),
            value: $(this).val(),
            featured: $(this).data('featured'),
            size: $(this).data('size')
        });
    });
    return ans;
}

/**
 *
 */
export class Corplist {

    selectElm:HTMLElement;

    jqWrapper:JQuery;

    triggerButton:HTMLElement;

    options:Options;

    widgetWrapper:HTMLElement;

    private data:Array<CorplistItem>;

    private visible:Visibility;

    private widgetClass:string;

    private currCorpname:string;

    private hiddenInput:HTMLElement;

    private parentForm:HTMLElement;

    /**
     *
     * @param options
     */
    constructor(options:Options, data:Array<CorplistItem>, currCorpname, parentForm:HTMLElement) {
        this.options = options;
        this.data = data;
        this.parentForm = parentForm;
        this.currCorpname = currCorpname;
        this.visible = Visibility.HIDDEN;
        this.widgetClass = 'corplist-widget'; // TODO options
    }

    /**
     *
     */
    onButtonClick = (e:Event) => {
        this.switchComponentVisibility();
        e.preventDefault();
        e.stopPropagation();
    };

    /**
     *
     */
    onItemClick = (e:Event) => {
        $(this.hiddenInput).val($(e.currentTarget).data('id'));
        e.stopPropagation();
        e.preventDefault();
        $(this.parentForm).attr('action', 'first_form'); // TODO abs. URL
        $(this.parentForm).submit();
    };

    /**
     *
     */
    bindOutsideClick():void {
        var self = this;

        $(window.document).bind('click', function (event) {
            self.switchComponentVisibility(Visibility.HIDDEN);
        });

        $(this.widgetWrapper).on('click', function (e:Event) {
            e.stopPropagation();
        });
    }

    /**
     *
     * @returns {number|JQuery}
     */
    widgetWidth():number {
        return $(this.widgetWrapper).width();
    }

    /**
     *
     * @param state
     */
    private switchComponentVisibility(state?:Visibility) {
        if (state === Visibility.HIDDEN || state === undefined && this.visible === Visibility.VISIBLE) {
            this.visible = Visibility.HIDDEN;
            $(this.widgetWrapper).hide();

        } else if (state === Visibility.VISIBLE || state === undefined && this.visible === Visibility.HIDDEN) {
            this.visible = Visibility.VISIBLE;
            $(this.widgetWrapper).show();
        }
    }


    /**
     *
     */
    private buildWidget() {
        var jqSelectBoxItem = $(this.selectElm),
            table,
            self = this;

        this.triggerButton = window.document.createElement('button');
        $(this.triggerButton).attr('type', 'button').text(this.currCorpname);
        jqSelectBoxItem.replaceWith(this.triggerButton);

        this.widgetWrapper = window.document.createElement('div');
        $(this.triggerButton).after(this.widgetWrapper);

        this.hiddenInput = window.document.createElement('input');
        $(this.hiddenInput).attr({
            'type': 'hidden',
            'name': jqSelectBoxItem.attr('name'),
            'value': this.currCorpname
        });
        $(this.widgetWrapper).append(this.hiddenInput);

        this.jqWrapper = $(this.widgetWrapper);
        this.jqWrapper.addClass(this.widgetClass);

        table = window.document.createElement('table');
        this.jqWrapper.append(table);

        $.each(self.data, function (i, item) {
            var isFeatured = item.featured;
            self.jqWrapper.append('<tr><td><a class="' + (isFeatured ? 'corplist-item featured' : 'corplist-item') + '"'
                + ' title="' + item.description + '"'
                + ' href="/first_form?corpname=' + item.value + '" data-id="' + item.value + '">' + item.name + '</a></td>'
                + '<td class="num">~' + item.size + '</td></tr>');
        });

        this.jqWrapper.find('a.corplist-item').each(function() {
            $(this).on('click', self.onItemClick);
        });

        this.jqWrapper.css({
            position: 'absolute'
        });

        this.bindOutsideClick();
        $(this.triggerButton).on('click', this.onButtonClick);
        this.switchComponentVisibility(Visibility.HIDDEN);

        this.jqWrapper.append($('.corpus-archive-link'));
    }

    /**
     *
     * @param selectElm
     */
    bind(selectElm:HTMLElement):void {
        this.selectElm = selectElm;
        this.buildWidget();
    }
}

/**
 *
 * @param selectElm
 * @param options
 */
export function create(selectElm:HTMLElement, options:Options):Corplist {
    var corplist:Corplist,
        data:Array<CorplistItem>,
        currCorpname;

    data = fetchDataFromSelect(selectElm);

    currCorpname = $(selectElm).find('option:selected').text();
    if (!currCorpname) {
        currCorpname = '??';
    }
    corplist = new Corplist(options, data, currCorpname, $(selectElm).closest('form').get(0));
    corplist.bind(selectElm);
    return corplist;
}