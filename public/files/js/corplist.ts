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

/// <reference path="../ts/declarations/jquery.d.ts" />
/// <reference path="../ts/declarations/typeahead.d.ts" />
/// <reference path="../ts/declarations/dynamic.d.ts" />

/// <amd-dependency path="vendor/typeahead" />

import $ = require('jquery');
import conf = require('conf');

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
 */
export interface CorplistItemClick {
    (callback:{data: (s:string) => any}):void;
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
export interface WidgetTab {
    show():void;
    hide():void;
}

/**
 *
 */
export class WidgetMenu {

    widgetWrapper:JQuery;

    menuWrapper:JQuery;

    searchBox:Search;

    favoriteBox:Favorites;

    funcMap:{[name:string]: WidgetTab};

    currentBoxId:string;

    /**
     *
     * @param widgetWrapper
     */
    constructor(widgetWrapper:JQuery) {
        this.widgetWrapper = widgetWrapper;
        this.menuWrapper = $('<div class="menu"></div>');
        this.widgetWrapper.append(this.menuWrapper);
        this.funcMap = {};
    }

    /**
     *
     * @param ident
     * @returns {*}
     */
    getFuncByIdent(ident:string):WidgetTab {
        return this.funcMap[ident];
    }

    /**
     *
     */
    reset():void {
        var self = this;
        this.menuWrapper.find('a').each(function () {
            $(this).removeClass('current');
            self.getFuncByIdent($(this).data('func')).hide();
        });
    }

    /**
     *
     * @param trigger
     */
    setCurrent(trigger:HTMLElement):void;
    setCurrent(trigger:string):void;
    setCurrent(trigger:any) {
        var triggerElm:HTMLElement;

        if (typeof trigger === 'string') {
            triggerElm = $(this.menuWrapper).find('a[data-func="' + trigger + '"]').get(0);

        } else {
            triggerElm = trigger;
        }

        this.reset();
        $(triggerElm).addClass('current');
        this.getFuncByIdent($(triggerElm).data('func')).show();
        this.currentBoxId = $(triggerElm).data('func');
    }

    getCurrent():WidgetTab {
        return this.getFuncByIdent(this.currentBoxId);
    }

    /**
     *
     * @param searchBox
     * @param favoriteBox
     */
    init(searchBox:Search, favoriteBox:Favorites):void {
        var self = this;
        this.menuWrapper.append('<a data-func="search">search</a> | <a data-func="my-corpora">my corpora</a>');
        this.favoriteBox = favoriteBox;
        this.searchBox = searchBox;
        this.funcMap['my-corpora'] = this.favoriteBox; // TODO attributes vs. this map => redundancy & design flaw
        this.funcMap['search'] = this.searchBox;
        this.setCurrent('search');

        this.menuWrapper.find('a').on('click', function (e:any) {
            self.setCurrent(e.currentTarget);
        });
    }
}

/**
 *
 */
export class Search implements WidgetTab {

    widgetWrapper:HTMLElement;

    itemClickCallback:CorplistItemClick;

    wrapper:HTMLElement;

    srchField:HTMLElement;

    /**
     *
     * @param widgetWrapper
     */
    constructor(widgetWrapper:HTMLElement, itemClickCallback:CorplistItemClick) {
        this.widgetWrapper = widgetWrapper;
        this.itemClickCallback = itemClickCallback;
        this.wrapper = window.document.createElement('div');
        $(this.widgetWrapper).append(this.wrapper);
    }

    show():void {
        $(this.wrapper).show();
        $(this.srchField).focus();
    }

    hide():void {
        $(this.wrapper).hide();
    }

    private initLabels():void {
        var div = window.document.createElement('div'),
            self = this;

        $(this.wrapper).append(div);
        $(div).addClass('labels');
        $.each(conf.corporaLabels, function (i, item) {
            var link = window.document.createElement('a');
            $(div).append(link);
            $(link).append(item[0]).addClass('keyword');
            $(link).attr('data-srchkey', item[1]);
            $(link).on('click', function () {
                $(self.srchField).val('#' + $(link).data('srchkey'));
                // this forces Typeahead to act like if user changed input manually
                $(self.srchField).trigger('input');
                $(self.srchField).focus();
            });
            if (i < conf.corporaLabels.length - 1) {
                $(div).append(' ');
            }
        });
    }

    private initTypeahead():void {
        var self = this;
        var remoteOptions:Bloodhound.RemoteOptions<string> = {
            'url' : 'ajax_list_corpora?query=%QUERY'
        };
        var bhOptions:Bloodhound.BloodhoundOptions<string> = {
            datumTokenizer: function(d) {
                return Bloodhound.tokenizers.whitespace(d.name);
            },
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            remote: remoteOptions,
            limit: 100 // TODO configurable
        };
        var matchingCorpora = new Bloodhound(bhOptions);
        matchingCorpora.initialize();

        var options:Twitter.Typeahead.Options = {
            name: 'corplist',
            hint: true,
            highlight: true,
            minLength: 2
        };


        $(this.srchField).typeahead(options, {
            displayKey : 'name',
            source : matchingCorpora.ttAdapter()
        });
    /*
        $(this.srchField).on('typeahead:opened', function () {

        });

        $(this.srchField).on('typeahead:closed', function () {

        });
    */
        $(this.srchField).on('typeahead:selected', function (x, suggestion) {
            self.itemClickCallback({
                data : function (key:string) {
                    return suggestion[key];
                }
            });
        });

    }

    /**
     *
     */
    init():void {
        var jqWrapper = $(this.wrapper),
            inputWrapper = window.document.createElement('div');

        this.initLabels();
        this.srchField = window.document.createElement('input');
        $(this.srchField)
            .addClass('corp-search')
            .attr('type', 'text')
            .attr('placeholder', '#label or name');
        jqWrapper.append(inputWrapper);
        $(inputWrapper).append(this.srchField).addClass('srch-box');
        this.initTypeahead();
        this.hide();
    }
}

/**
 *
 */
export class Favorites implements WidgetTab {

    widgetWrapper:HTMLElement;

    data:Array<CorplistItem>;

    wrapper:HTMLElement;

    itemClickCallback:CorplistItemClick;

    /**
     *
     * @param widgetWrapper
     */
    constructor(widgetWrapper:HTMLElement, data:Array<CorplistItem>, itemClickCallback:CorplistItemClick) {
        this.widgetWrapper = widgetWrapper;
        this.data = data;
        this.itemClickCallback = itemClickCallback;
        this.wrapper = window.document.createElement('table');
        $(this.wrapper).addClass('favorite-list');
        $(this.widgetWrapper).append(this.wrapper);
    }

    /**
     *
     */
    init() {
        var jqWrapper = $(this.wrapper),
            self = this;

        $.each(this.data, function (i, item) {
            var isFeatured = item.featured;
            jqWrapper.append('<tr><td><a class="' + (isFeatured ? 'corplist-item featured' : 'corplist-item') + '"'
                + ' title="' + item.description + '"'
                + ' href="/first_form?corpname=' + item.value + '" data-id="' + item.value + '">' + item.name + '</a></td>'
                + '<td class="num">~' + item.size + '</td></tr>');
        });

        jqWrapper.find('a.corplist-item').each(function() {
            $(this).on('click', function (e:Event) {
                self.itemClickCallback($(e.currentTarget));
                e.stopPropagation();
                e.preventDefault();
            });
        });
    }

    show():void {
        $(this.wrapper).show();
    }

    hide():void {
        $(this.wrapper).hide();
    }
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

    private currCorpIdent:string;

    private hiddenInput:HTMLElement;

    private parentForm:HTMLElement;

    private mainMenu:WidgetMenu;

    private searchBox:Search;

    private favoritesBox:Favorites;

    /**
     *
     * @param options
     */
    constructor(options:Options, data:Array<CorplistItem>, currCorpIdent, currCorpname, parentForm:HTMLElement) {
        this.options = options;
        this.data = data;
        this.parentForm = parentForm;
        this.currCorpIdent = currCorpIdent;
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
    onItemClick = (triggerElm:{data: (s:string) => any}) => {
        $(this.hiddenInput).val(triggerElm.data('id'));
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
     * @param state
     */
    private switchComponentVisibility(state?:Visibility) {
        if (state === Visibility.HIDDEN || state === undefined && this.visible === Visibility.VISIBLE) {
            this.visible = Visibility.HIDDEN;
            $(this.widgetWrapper).hide();

        } else if (state === Visibility.VISIBLE || state === undefined && this.visible === Visibility.HIDDEN) {
            this.visible = Visibility.VISIBLE;
            $(this.widgetWrapper).show();
            // even if the tab is 'current' we call this to make sure it is initialized properly
            this.mainMenu.getCurrent().show();
        }
    }

    /**
     *
     */
    private buildWidget() {
        var jqSelectBoxItem = $(this.selectElm);

        this.triggerButton = window.document.createElement('button');
        $(this.triggerButton).attr('type', 'button').text(this.currCorpname);
        jqSelectBoxItem.replaceWith(this.triggerButton);

        this.widgetWrapper = window.document.createElement('div');
        $(this.triggerButton).after(this.widgetWrapper);

        this.hiddenInput = window.document.createElement('input');
        $(this.hiddenInput).attr({
            'type': 'hidden',
            'name': jqSelectBoxItem.attr('name'),
            'value': this.currCorpIdent
        });
        $(this.widgetWrapper).append(this.hiddenInput);

        this.jqWrapper = $(this.widgetWrapper);
        this.jqWrapper.addClass(this.widgetClass);

        // main menu
        this.mainMenu = new WidgetMenu(this.jqWrapper);

        // search func
        this.searchBox = new Search(this.jqWrapper.get(0), this.onItemClick);
        this.searchBox.init();

        this.favoritesBox = new Favorites(this.widgetWrapper, this.data, this.onItemClick);
        this.favoritesBox.init();

        // menu initialization
        this.mainMenu.init(this.searchBox, this.favoritesBox);

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
        currCorpname:string,
        currCorpIdent:string,
        selectedOption:JQuery;

    selectedOption = $(selectElm).find('option:selected');
    data = fetchDataFromSelect(selectElm);

    currCorpIdent = selectedOption.attr('value');
    if (!currCorpIdent) {
        throw new Error('Failed to determine current corpus');
    }
    currCorpname = selectedOption.text();
    if (!currCorpname) {
        currCorpname = currCorpIdent;
    }
    corplist = new Corplist(options, data, currCorpIdent, currCorpname, $(selectElm).closest('form').get(0));
    corplist.bind(selectElm);
    return corplist;
}