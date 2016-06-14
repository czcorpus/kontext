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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../types/plugins/corparch.ts" />
/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../../ts/declarations/typeahead.d.ts" />
/// <reference path="../../../ts/declarations/popupbox.d.ts" />

import $ = require('jquery');
import common = require('./common');
import commonDefault = require('../defaultCorparch/common');
import popupBox = require('popupbox');
import corplist = require('./corplist');


/**
 *
 */
interface CorplistSrchItemClick {
    (corpId:string, corpName:string):void;
}

/**
 *
 */
interface CorplistFavItemClick {
    (itemId:string, itemName:string, href:string):void;
}

/**
 * A general click action performed on featured/favorite/searched item
 */
export interface CorplistItemClick {
    (itemId:string, itemName:string, widget:Corplist):void;
}

/**
 *
 */
enum Visibility {
    VISIBLE, HIDDEN
}

interface FeaturedItem {
    id: string;
    name: string;
    size: string; // rough size (100G, 1T etc.)
    description: string;
}

/**
 * Extracts user items encoded using JSON in data-item attributes of OPTION HTML elements.
 * This is expected to be filled in on server.
 *
 * @param select
 * @returns list of user items related to individual OPTION elements
 */
export function fetchDataFromSelect(select:HTMLElement):Array<common.CorplistItemUcnk> {
    var elm:JQuery = $(select),
        ans:Array<common.CorplistItemUcnk> = [];

    elm.find('option').each(function () {
        var itemData = $(this).data('item');
        ans.push(itemData);
    });
    return ans;
}

/**
 * General widget tab. All the future additions to Corplist tabs
 * must implement this.
 */
export interface WidgetTab {
    show():void;
    hide():void;
    getFooter():JQuery;
}

/**
 * This is used when the SearchTab tab asks server
 * for matching corpora according to the pattern
 * user has written to the search input.
 */
interface SearchResponse {
    name: string;
    favorite: boolean;
    canonical_id: string;
    raw_size: number;
    path: string;
    desc: string;
    id: string;
    size: number;
    found_in?: Array<string>;
}



/**
 *
 */
export interface Options {

    /**
     * form's action attribute; if omitted then form's current one is used
     */
    formTarget?:string;

    /**
     * GET or POST; if omitted then form's current method is used
     */
    submitMethod?:string;

    /**
     * Handles click on favorite/featured/searched item.
     *
     * Using custom action disables implicit form submission (or location.href update)
     * which means formTarget and submitMethod options have no effect unless you use
     * them directly in some way.
     */
    itemClickAction?:CorplistItemClick;

    /**
     * A custom filter allowing filtering displayed favorite (i.e. featured/searched items
     * are not affected!) items. This allows e.g. displaying only items of a certain
     * type. Default filter returns 'true' on each item.
     */
    favoriteItemsFilter?:(item:common.CorplistItemUcnk)=>boolean;

    /**
     * A HTML class to be used for widget's wrapping container.
     * If omitted then 'corplist-widget' is used.
     */
    widgetClass?:string;

    /**
     *
     * @param widget
     */
    onHide?:(widget:Corplist)=>void;

    /**
     *
     * @param widget
     */
    onShow?:(widget:Corplist)=>void;

    /**
     * If false then the component does not accept any changes
     * (i.e. user cannot add remove her favorite items).
     */
    editable?:boolean;

    disableStarComponent?:boolean;
}




/**
 * This represents the menu for switching between tabs.
 */
class WidgetMenu {

    widget:Corplist;

    menuWrapper:JQuery;

    searchBox:SearchTab;

    favoriteBox:FavoritesTab;

    funcMap:{[name:string]: WidgetTab};

    pageModel:Kontext.QueryPagePluginApi;

    currentBoxId:string;

    blockingTimeout:number;

    static SEARCH_WIDGET_ID:string = 'search';
    static MY_ITEMS_WIDGET_ID:string = 'my-corpora';

    static TAB_KEY = 9;

    static ESC_KEY = 27;

    /**
     *
     * @param widget
     */
    constructor(widget:Corplist, pageModel:Kontext.QueryPagePluginApi) {
        this.widget = widget;
        this.pageModel = pageModel;
        this.menuWrapper = $('<div class="menu"></div>');
        $(this.widget.getWrapperElm()).append(this.menuWrapper);
        this.funcMap = {};
        this.blockingTimeout = null;
    }

    /**
     *
     * @param ident
     * @returns {*}
     */
    getTabByIdent(ident:string):WidgetTab {
        return this.funcMap[ident];
    }

    /**
     *
     */
    reset():void {
        var self = this;
        this.menuWrapper.find('a').each(function () {
            $(this).removeClass('current');
            self.getTabByIdent($(this).data('func')).hide();
        });
    }

    /**
     *
     * @param trigger
     */
    setCurrent(trigger:EventTarget):void;
    setCurrent(trigger:string):void;
    setCurrent(trigger):void {
        var newTabId:string,
            menuLink:HTMLElement,
            newActiveWidget:WidgetTab;

        if (typeof trigger === 'string') {
            newTabId = trigger;
            menuLink = $(this.menuWrapper).find('a[data-func="' + trigger + '"]').get(0);

        } else if (typeof trigger === 'object') {
            newTabId = $(trigger).data('func');
            menuLink = $(trigger).get(0);
        }

        this.reset();
        $(menuLink).addClass('current');
        newActiveWidget = this.getTabByIdent(newTabId);
        newActiveWidget.show();
        this.widget.setFooter(newActiveWidget.getFooter());
        this.currentBoxId = newTabId;
    }

    /**
     *
     * @returns {WidgetTab}
     */
    getCurrent():WidgetTab {
        return this.getTabByIdent(this.currentBoxId);
    }

    /**
     *
     * @param searchBox
     * @param favoriteBox
     */
    init(searchBox:SearchTab, favoriteBox:FavoritesTab):void {
        var self = this;
        this.menuWrapper.append('<a data-func="my-corpora">'
            + this.pageModel.translate('defaultCorparch__my_list') + '</a> | '
            + '<a data-func="search">' + this.pageModel.translate('defaultCorparch__other_corpora')
            + '</a>');
        this.favoriteBox = favoriteBox;
        this.searchBox = searchBox;
        this.funcMap[WidgetMenu.MY_ITEMS_WIDGET_ID] = this.favoriteBox; // TODO attributes vs. this map => redundancy & design flaw
        this.funcMap[WidgetMenu.SEARCH_WIDGET_ID] = this.searchBox;
        this.setCurrent(WidgetMenu.MY_ITEMS_WIDGET_ID);

        this.menuWrapper.find('a').on('click', function (e:JQueryEventObject) {
            self.setCurrent(e.currentTarget);
        });

        function eventListener(e:JQueryEventObject) {
            var cycle;

            if (!self.blockingTimeout && self.widget.isVisible()) {
                cycle = [WidgetMenu.MY_ITEMS_WIDGET_ID, WidgetMenu.SEARCH_WIDGET_ID];
                if (e.keyCode == WidgetMenu.TAB_KEY) {
                    self.setCurrent(cycle[(cycle.indexOf(self.currentBoxId) + 1) % 2]);
                    e.preventDefault();
                    e.stopPropagation();

                } else if (e.keyCode == WidgetMenu.ESC_KEY) {
                    self.widget.hide();
                }
            }
        }
        $(window.document).on('keyup.quick-actions', eventListener);

        // we have to prevent Alt+Tab to be catched by our Tab-based switch
        $(window).on('blur', function () {
            clearTimeout(self.blockingTimeout);
            self.blockingTimeout = null;
        });
        $(window).on('focus', function () {
            self.blockingTimeout = setTimeout(function () {
                clearTimeout(self.blockingTimeout);
                self.blockingTimeout = null;
            }, 300);
        });
    }
}


/**
 * This class represents the SearchTab tab
 */
class SearchTab implements WidgetTab {

    pluginApi:Kontext.PluginApi;

    widgetWrapper:HTMLElement;

    itemClickCallback:CorplistSrchItemClick;

    wrapper:HTMLElement;

    srchField:HTMLElement;

    bloodhound:Bloodhound<string>; // Typeahead's suggestion engine

    private tagPrefix:string;

    private maxNumHints:number;

    private selectedTags:{[key:string]:HTMLElement};

    ajaxLoader:HTMLElement;

    loaderKiller:any;

    static TYPEAHEAD_MIN_LENGTH = 2;

    /**
     *
     * @param widgetWrapper
     */
    constructor(pluginApi:Kontext.QueryPagePluginApi, widgetWrapper:HTMLElement, itemClickCallback:CorplistSrchItemClick) {
        this.pluginApi = pluginApi;
        this.widgetWrapper = widgetWrapper;
        this.itemClickCallback = itemClickCallback;
        this.wrapper = window.document.createElement('div');
        $(this.widgetWrapper).append(this.wrapper);
        this.tagPrefix = this.pluginApi.getConf('pluginData')['corparch']['tag_prefix'];
        this.maxNumHints = this.pluginApi.getConf('pluginData')['corparch']['max_num_hints'];
        this.selectedTags = {};
    }

    show():void {
        $(this.wrapper).show();
        $(this.srchField).focus();
    }

    hide():void {
        $(this.wrapper).hide();
    }

    /**
     *
     */
    private getTagQuery():string {
        let ans = [];

        for (var p in this.selectedTags) {
            if (this.selectedTags.hasOwnProperty(p)) {
                ans.push(this.tagPrefix + p);
            }
        }

        return ans.join(' ');
    }

    /**
     *
     * @param skipId
     */
    private resetTagSelection(skipId?:Array<string>|string):void {
        let toReset = [];
        let skipIds:Array<string>;

        if (typeof skipId === 'string') {
            skipIds = [skipId];

        } else if (skipId) {
            skipIds = skipId;

        } else {
            skipIds = [];
        }

        for (let p in this.selectedTags) {
            if (this.selectedTags.hasOwnProperty(p)
                && this.selectedTags[p]
                && skipIds.indexOf(p) === -1) {
                toReset.push(p);
            }
        }
        for (let i = 0; i < toReset.length; i += 1) {
            $(this.selectedTags[toReset[i]]).removeClass('selected');
            delete this.selectedTags[toReset[i]];
        }
    }

    /**
     */
    private toggleTagSelection(link:HTMLElement, ctrlPressed:boolean):void {
        var id = $(link).data('srchkey');

        if (!ctrlPressed) {
            this.resetTagSelection(id);
        }

        if (!this.selectedTags[id]) {
            this.selectedTags[id] = link;
            $(link).addClass('selected');

        } else {
            delete this.selectedTags[id];
            $(link).removeClass('selected');
        }
    }

    /**
     * This initiates a Typeahead search no matter the provided
     * query meets required properties (e.g. min. length).
     */
    private triggerTypeaheadSearch():void {
        $(this.srchField).trigger('input'); // we make Typeahead think
        $(this.srchField).focus();          // that the input actually changed
        this.bloodhound.clear();
        $(this.srchField).data('ttTypeahead').menu.datasets[0].update($(this.srchField).val());
    }

    /**
     *
     * @param parent
     */
    private createResetLink():HTMLElement {
        let link = window.document.createElement('a');
        let self = this;
        let overlay = window.document.createElement('span');

        $(link)
            .addClass('keyword')
            .addClass('reset')
            .on('click', function () {
                self.resetTagSelection();
            });
        $(overlay)
            .addClass('overlay')
            .text(this.pluginApi.translate('defaultCorparch__no_keyword'));
        $(link).append(overlay);
        return link;
    }

    /**
     *
     */
    private initLabels():void {
        let div = window.document.createElement('div');
        let self = this;

        $(this.wrapper).append(div);
        $(div).addClass('labels');
        $(div).append(this.createResetLink());
        $.each(this.pluginApi.getConf('pluginData')['corparch']['corpora_labels'], function (i, item) {
            let link = window.document.createElement('a');
            let overlay = window.document.createElement('span');

            $(div).append(' ');
            $(div).append(link);
            $(link).attr('data-srchkey', item[0]).addClass('keyword');

            $(overlay).addClass('overlay')
                .text(item[1]);
            if (item[2]) {
                $(overlay).css('backgroundColor', item[2]);
            }
            $(link).append(overlay);

            $(link).on('click', function (e:JQueryEventObject) {
                self.toggleTagSelection(link, e.ctrlKey || e.metaKey);
                self.triggerTypeaheadSearch();
            });
        });
        $(div).append('<div class="labels-hint">('
            + this.pluginApi.translate('defaultCorparch__hold_ctrl_for_multiple') + ')</div>');
    }

    private initTypeahead():void {
        let self = this;
        let remoteOptions:Bloodhound.RemoteOptions<string> = {
            url : self.pluginApi.getConf('rootURL') + 'corpora/ajax_list_corpora',
            prepare: function (query, settings) {
                settings.url += '?query=' + encodeURIComponent(self.getTagQuery() + ' ' + query);
                return settings;
            },
            transform: function (response) {
                return response.rows;
            }
        };
        let bhOptions:Bloodhound.BloodhoundOptions<string> = {
            datumTokenizer: function(d) {
                return Bloodhound.tokenizers.whitespace(d.name);
            },
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            remote: remoteOptions
        };
        this.bloodhound = new Bloodhound(bhOptions);
        this.bloodhound.initialize();

        let options:Twitter.Typeahead.Options = {
            name: 'corplist',
            hint: true,
            highlight: true,
            minLength: SearchTab.TYPEAHEAD_MIN_LENGTH
        };

        $(this.srchField).typeahead(options, {
            displayKey : 'name',
            source : this.bloodhound.ttAdapter(),
            limit : self.maxNumHints,
            templates: {
                notFound: function () {
                    return '<p>' + self.pluginApi.translate('defaultCorparch__no_result') + '</p>';
                },
                suggestion: function (item:SearchResponse) {
                    if (item.found_in.length > 0) {
                        return $('<p>' + item.name
                            + ' <span class="num">('
                            + self.pluginApi.translate('global__size')
                            + ': ' + item.raw_size + ', '
                            + self.pluginApi.translate('defaultCorparch__found_in_{values}',
                                {values: item.found_in.join(', ')})
                            + ')</span></p>');

                    } else {
                        return $('<p>' + item.name
                            + ' <span class="num">(size: ' + item.raw_size + ')</span></p>');
                    }
                },
                footer: function (info) {
                    if (info.suggestions.length === self.maxNumHints) {
                        let url = self.pluginApi.createActionUrl('/corpora/corplist?query='
                                + encodeURIComponent(self.getTagQuery() + ' ' + $(self.srchField).val())
                                + '&limit=' + corplist.CorplistTableStore.LoadLimit
                        );
                        return $('<p class="hint">' +
                                self.pluginApi.translate('defaultCorparch__please_note_results_cut_{maxNum}{link}',
                                        { maxNum: self.maxNumHints, link: url }) +
                                '</p>');
                    }
                }
            }
        });

        this.loaderKiller = null;

        $(this.srchField).on('typeahead:selected', function (x, suggestion:{[k:string]:any}) {
            self.itemClickCallback.call(self, suggestion['id'], suggestion['name']);
        });

        $(this.srchField).on('typeahead:asyncrequest', function () {
            $(self.ajaxLoader).removeClass('hidden');
            if (!self.loaderKiller) {
                self.loaderKiller = setInterval(function () {
                    if ($(self.srchField).val().length === 0) {
                        if (!$.isEmptyObject(self.selectedTags)) {
                            self.triggerTypeaheadSearch();
                        }
                        clearInterval(self.loaderKiller);

                    } else if ($(self.srchField).val().length <= SearchTab.TYPEAHEAD_MIN_LENGTH) {
                        $(self.ajaxLoader).addClass('hidden');
                    }

                }, 250);
            }
        });

        $(this.srchField).on('typeahead:asyncreceive', function () {
            $(self.ajaxLoader).addClass('hidden');
            if (self.loaderKiller) {
                clearInterval(self.loaderKiller);
                self.loaderKiller = null;
            }
        });
    }

    /**
     *
     */
    init():void {
        var jqWrapper = $(this.wrapper),
            srchBox = window.document.createElement('div'),
            inputWrapper = window.document.createElement('div');

        this.initLabels();
        jqWrapper.append(srchBox);
        $(srchBox)
            .addClass('srch-box')
            .append(inputWrapper);

        this.ajaxLoader = window.document.createElement('img');
        $(this.ajaxLoader)
            .attr('src', this.pluginApi.createStaticUrl('img/ajax-loader.gif'))
            .addClass('ajax-loader')
            .addClass('hidden')
            .attr('title', this.pluginApi.translate('global__loading') + '...');
        $(inputWrapper).append(this.ajaxLoader);

        this.srchField = window.document.createElement('input');
        $(this.srchField)
            .addClass('corp-search')
            .attr('type', 'text')
            .attr('placeholder', this.pluginApi.translate('defaultCorparch__name_or_description'));
        $(inputWrapper)
            .addClass('input-wrapper')
            .append(this.srchField);
        this.initTypeahead();
        this.hide();
    }

    /**
     *
     * @returns {}
     */
    getFooter():JQuery {
        return $('<span>' + this.pluginApi.translate('defaultCorparch__hit_tab_to_see_fav') + '</span>');
    }
}

/**
 * This class represents the FavoritesTab (= user item) tab
 */
class FavoritesTab implements WidgetTab {

    pageModel:Kontext.PluginApi;

    widgetWrapper:HTMLElement;

    tablesWrapper:HTMLElement;

    dataFav:Array<common.CorplistItemUcnk>;

    private wrapperFav:HTMLElement;

    dataFeat:Array<FeaturedItem>;

    private wrapperFeat:HTMLElement;

    itemClickCallback:CorplistFavItemClick;

    editMode:boolean;

    onListChange:Array<(trigger:FavoritesTab)=>void>;  // list of registered callbacks

    customListFilter:(item:common.CorplistItemUcnk)=>boolean;

    /**
     *
     */
    constructor(pageModel:Kontext.PluginApi, widgetWrapper:HTMLElement, dataFav:Array<common.CorplistItemUcnk>,
                dataFeat:Array<FeaturedItem>, itemClickCallback?:CorplistFavItemClick,
                customListFilter?:(item:common.CorplistItemUcnk)=>boolean) {
        var self = this;
        this.editMode = false;
        this.onListChange = [];
        this.pageModel = pageModel;
        this.widgetWrapper = widgetWrapper;
        this.dataFav = dataFav ? dataFav : [];
        this.dataFeat = dataFeat ? dataFeat : [];
        this.itemClickCallback = itemClickCallback;
        this.tablesWrapper = window.document.createElement('div');
        $(this.tablesWrapper).addClass('tables');
        $(this.widgetWrapper).append(this.tablesWrapper);

        this.wrapperFav = window.document.createElement('table');
        $(this.wrapperFav).addClass('favorite-list')
            .append('<tr>'
            + '<th>' + this.pageModel.translate('defaultCorparch__fav_items') + '</th>'
            + '<th></th>'
            + '<th class="conf"><img class="config over-img" '
            + 'title="' + this.pageModel.translate('defaultCorparch__click_to_unlock_removal') + '" '
            + 'alt="' + this.pageModel.translate('defaultCorparch__click_to_unlock_removal') + '" '
            + 'src="' + this.pageModel.createStaticUrl('img/config-icon_16x16.png') + '" '
            + 'data-alt-img="' + this.pageModel.createStaticUrl('img/config-icon_16x16_s.png') + '" '
            + ' />'
            + '</th></tr>');
        $(this.tablesWrapper).append(this.wrapperFav);

        $(this.tablesWrapper).find('img.config').on('click', function () {
            self.switchItemEditMode();
        });

        this.wrapperFeat = window.document.createElement('table');
        $(this.wrapperFeat).addClass('featured-list')
            .append('<tr><th colspan="2">' + this.pageModel.translate('defaultCorparch__featured_corpora') + '</th></tr>');
        $(this.tablesWrapper).append(this.wrapperFeat);

        if (customListFilter) {
            this.customListFilter = customListFilter;

        } else {
            this.customListFilter = (item:any) => true;
        }
    }

    registerChangeListener(fn:(trigger:FavoritesTab)=>void) {
        this.onListChange.push(fn);
    }

    /**
     * Tests whether the passed item matches (by its 'id' attribute) with
     * any of user's current items (= this.data).
     *
     * @param item
     * @returns true on success else false
     */
    containsItem(item:common.CorplistItemUcnk):boolean {
        for (let i = 0; i < this.dataFav.length; i += 1) {
            if (this.dataFav[i].id === item.id) {
                return true;
            }
        }
        return false;
    }

    /**
     * Switches widget edit mode from 'on' to 'off' and from 'off' to 'on'.
     * When 'on' then user can remove her favorite items.
     */
    switchItemEditMode() {
        if (this.editMode === false) {
            $(this.wrapperFav).find('img.remove').removeClass('disabled');

        } else {
            $(this.wrapperFav).find('img.remove').addClass('disabled');
        }
        this.editMode = !this.editMode;
    }

    /**
     * Generates current action URL along with all the necessary parameters
     * (depends on type of item - corpus vs. subcorpus vs. aligned corpora).
     *
     * @param itemData
     * @returns {string}
     */
    generateItemUrl(itemData):string {
        var rootPath = this.pageModel.createActionUrl(this.pageModel.getConf<string>('currentAction')),
            params = ['corpname=' + itemData.corpus_id];

        if (itemData.type === commonDefault.CorplistItemType.SUBCORPUS) {
            params.push('usesubcorp=' + itemData.subcorpus_id);
        }
        if (itemData.type === commonDefault.CorplistItemType.ALIGNED_CORPORA) {
            for (var i = 0; i < itemData.corpora.length; i++) {
                params.push('sel_aligned=' + itemData.corpora[i].corpus_id);
            }
        }
        return rootPath + '?' + params.join('&');
    }

    /**
     *
     * @param itemId
     */
    private removeFromList(itemId:string) {
        var self = this;
        var prom = $.ajax(this.pageModel.getConf('rootPath') + 'user/unset_favorite_item',
            {method: 'POST', data: {id: itemId}, dataType: 'json'});

        prom.then(
            function (data) {
                if (!data.error) {
                    self.pageModel.showMessage('info', self.pageModel.translate('defaultCorparch__item_removed_from_fav'));
                    return $.ajax(self.pageModel.getConf('rootPath') + 'user/get_favorite_corpora');

                } else {
                    self.pageModel.showMessage('error', self.pageModel.translate('defaultCorparch__failed_to_remove_fav'));
                    throw new Error(data.error);
                }

            },
            function (err) {
                self.pageModel.showMessage('error', self.pageModel.translate('defaultCorparch__failed_to_remove_fav'));
            }
        ).then(
            function (favItems) {
                if (favItems && !favItems.error) {
                    self.reinit(favItems);
                    $.each(self.onListChange, function (i, fn:(trigger:FavoritesTab)=>void) {
                        fn.call(self, self);
                    });

                } else {
                    self.pageModel.showMessage('error', self.pageModel.translate('defaultCorparch__failed_to_fetch_fav'));
                    throw new Error(favItems.error);
                }
            },
            function (err) {
                self.pageModel.showMessage('error', self.pageModel.translate('defaultCorparch__failed_to_fetch_fav'));
            }
        );
    }

    /**
     *
     */
    init():void {
        var jqWrapper = $(this.wrapperFav),
            self = this;

        this.editMode = false;

        if (!this.pageModel.getConf('anonymousUser')) {
            $.each(this.dataFav, function (i, item) {
                if (self.customListFilter(item)) {
                    jqWrapper.append('<tr class="data-item"><td><a class="corplist-item"'
                        + ' title="' + item.description + '"'
                        + ' href="' + self.generateItemUrl(item)
                        + '" data-id="' + item.id + '">' + item.name + '</a></td>'
                        + '<td class="num">' + item.size_info + '</td>'
                        + '<td class="tools"><img class="remove over-img disabled" '
                        + 'alt="' + self.pageModel.translate('defaultCorparch__click_to_remove_item_from_fav') + '" '
                        + 'title="' + self.pageModel.translate('defaultCorparch__click_to_remove_item_from_fav') + '" '
                        + 'src="' + self.pageModel.createStaticUrl('img/close-icon.svg') + '" '
                        + 'data-alt-img="' + self.pageModel.createStaticUrl('img/close-icon_s.svg') + '" />'
                        + '</td></tr>');
                }
            });

            jqWrapper.find('td.tools img.remove').on('click', function (e:JQueryEventObject) {
                if (!$(e.currentTarget).hasClass('disabled')) {
                    self.removeFromList($(e.currentTarget).closest('tr').find('a.corplist-item').data('id'));
                }
            });

            jqWrapper.find('a.corplist-item').each(function () {
                $(this).on('click', function (e:Event) {
                    if (typeof self.itemClickCallback === 'function') {
                        self.itemClickCallback.call(
                            self,
                            $(e.currentTarget).data('id'),
                            $(e.currentTarget).text(),
                            $(e.currentTarget).attr('href')
                            );
                        e.stopPropagation();
                        e.preventDefault();
                    }
                });
            });

        } else {
            jqWrapper.append('<tr><td colspan="3">'
                + this.pageModel.translate('defaultCorparch__please_log_in_to_see_fav')
                + '</td></tr>');
            // TODO show loginUrl here
        }

        if (this.dataFav.length > 0) {
            $('.corplist-widget table.favorite-list img.config').show();

        } else {
            $('.corplist-widget table.favorite-list img.config').hide();
        }

        if (this.dataFeat.length > 0) {
            $.each(this.dataFeat, function (i, item:FeaturedItem) {
                $(self.wrapperFeat).append('<tr class="data-item"><td>'
                    + '<a class="featured-item"'
                    + ' href="' + self.pageModel.createActionUrl(
                            self.pageModel.getConf<string>('currentAction'))
                    + '?corpname=' + item.id + '"'
                    + ' data-id="' + item.id + '"'
                    + ' title="' + item.description + '"'
                    + ' >'
                    + item.name + '</a></td>'
                    + '<td class="num">'
                    + (item.size ? item.size : '<span title="'
                    + self.pageModel.translate('defaultCorparch__unknown_size') + '">?</span>')
                    + '</td>'
                    + '</tr>');
            });

            $(self.wrapperFeat).find('a.featured-item').each(function () {
                $(this).on('click', function (e:Event) {
                    if (typeof self.itemClickCallback === 'function') {
                        self.itemClickCallback.call(self,
                            $(e.currentTarget).data('id'),
                            $(e.currentTarget).text(),
                            $(e.currentTarget).attr('href'));
                        e.stopPropagation();
                        e.preventDefault();
                    }
                });
            });

        } else {
            $(this.wrapperFeat).hide();
        }
    }

    reinit(newData:Array<common.CorplistItemUcnk>):void {
        $(this.wrapperFav).find('tr.data-item').remove();
        this.dataFav = newData;
        $(this.wrapperFeat).find('tr.data-item').remove();
        this.init();
    }

    show():void {
        $(this.tablesWrapper).show();
    }

    hide():void {
        $(this.tablesWrapper).hide();
    }

    getFooter():JQuery {
        return $('<span>' + this.pageModel.translate('defaultCorparch__hit_tab_to_see_other') + '</span>');
    }
}

/**
 */
class StarSwitch {

    pageModel:Kontext.PluginApi;

    triggerElm:HTMLElement;

    itemId:string;

    constructor(pageModel:Kontext.PluginApi, triggerElm:HTMLElement, itemId:string) {
        this.pageModel = pageModel;
        this.triggerElm = triggerElm;
        this.itemId = itemId;
    }

    setItemId(id:string):void {
        this.itemId = id;
    }

    getItemId():string {
        return this.itemId;
    }

    setStarState(state:boolean):void {
        if (state === true) {
            $(this.triggerElm)
                .attr('src', this.pageModel.createStaticUrl('img/starred.svg'))
                .addClass('starred')
                .attr('title', this.pageModel.translate('defaultCorparch__in_fav'))
                .attr('alt', this.pageModel.translate('defaultCorparch__in_fav'));

        } else {
            $(this.triggerElm)
                .attr('src', this.pageModel.createStaticUrl('img/starred_grey.svg'))
                .removeClass('starred')
                .attr('title', this.pageModel.translate('defaultCorparch__not_in_fav'))
                .attr('alt', this.pageModel.translate('defaultCorparch__not_in_fav'));
        }
    }

    isStarred():boolean {
        return $(this.triggerElm).hasClass('starred');
    }
}


/**
 * A class handling star icon switch (sets fav. on and off)
 */
class StarComponent {

    private favoriteItemsTab:FavoritesTab;

    private pageModel:Kontext.QueryPagePluginApi;

    private starSwitch:StarSwitch;

    private editable:boolean;

    private starImg:HTMLElement;

    /**
     * Once user adds an aligned corpus we must
     * test whether the new corpora combinations is already
     * in favorites or not.
     */
    onAlignedCorporaAdd = (corpname:string) => {
        let newItem:common.CorplistItemUcnk;
        newItem = this.extractItemFromPage();
        this.starSwitch.setStarState(this.favoriteItemsTab.containsItem(newItem));
    };

    /**
     * Once user removes an aligned corpus we must
     * test whether the new corpora combinations is already
     * in favorites or not.
     */
    onAlignedCorporaRemove = (corpname:string) => {
        var newItem:common.CorplistItemUcnk;

        newItem = this.extractItemFromPage();
        this.starSwitch.setStarState(this.favoriteItemsTab.containsItem(newItem));
    };

    /**
     * Once user changes a subcorpus we must test
     * whether the new corpus:subcorpus combination is
     * already in favorites.
     */
    onSubcorpChange = (subcname:string) => {
        var newItem:common.CorplistItemUcnk;

        newItem = this.extractItemFromPage();
        this.starSwitch.setStarState(this.favoriteItemsTab.containsItem(newItem));
    };

    /**
     *
     * @param trigger
     */
    onFavTabListChange = (trigger:FavoritesTab) => {
        var curr = this.extractItemFromPage();

        if (!trigger.containsItem(curr)) {
            this.starSwitch.setStarState(false);
        }
    };

    /**
     *
     * @param favoriteItemsTab
     * @param pageModel
     */
    constructor(favoriteItemsTab:FavoritesTab, pageModel:Kontext.QueryPagePluginApi, editable:boolean) {
        var currItem:common.CorplistItemUcnk;

        this.favoriteItemsTab = favoriteItemsTab;
        this.pageModel = pageModel;
        this.starImg = window.document.createElement('img');

        currItem = this.extractItemFromPage();
        if (favoriteItemsTab.containsItem(currItem)) {
            $(this.starImg)
                .addClass('starred')
                .attr('src', this.pageModel.createStaticUrl('img/starred.svg'))
                .attr('title', this.pageModel.translate('defaultCorparch__in_fav'))
                .attr('alt', this.pageModel.translate('defaultCorparch__in_fav'));

        } else {
            $(this.starImg)
                .addClass('starred')
                .attr('src', this.pageModel.createStaticUrl('img/starred_grey.svg'))
                .attr('title', this.pageModel.translate('defaultCorparch__not_in_fav'))
                .attr('alt', this.pageModel.translate('defaultCorparch__not_in_fav'));
        }
        $('form .starred').append(this.starImg);
        this.editable = editable;
        this.starSwitch = new StarSwitch(this.pageModel, this.starImg, currItem.id);
    }

    /**
     * Sets a favorite item via a server call
     *
     * @param flag
     */
    setFavorite(flag:commonDefault.Favorite) {
        let self = this;
        let prom:JQueryXHR;
        let newItem:common.CorplistItemUcnk;
        let message:string;
        let postDispatch:(data:any)=>void;
        let updateStar:()=>void;

        if (flag === commonDefault.Favorite.FAVORITE) {
            newItem = this.extractItemFromPage(flag);
            prom = $.ajax(this.pageModel.getConf('rootPath') + 'user/set_favorite_item',
                {method: 'POST', data: newItem, dataType: 'json'});
            message = self.pageModel.translate('defaultCorparch__item_added_to_fav');
            postDispatch = function (data) {
                self.starSwitch.setItemId(data.id);
            };
            updateStar = () => self.starSwitch.setStarState(true);

        } else {
            prom = $.ajax(this.pageModel.getConf('rootPath') + 'user/unset_favorite_item',
                {method: 'POST', data: {id: self.starSwitch.getItemId()}, dataType: 'json'});
            message = self.pageModel.translate('defaultCorparch__item_removed_from_fav');
            postDispatch = function (data) {
                self.starSwitch.setItemId(null);
            };
            updateStar = () => self.starSwitch.setStarState(false);
        }

        prom.then(
            function (data) {
                if (!data.error) {
                    self.pageModel.showMessage('info', message);
                    postDispatch(data);
                    updateStar();

                } else {
                    if (data.error_code) {
                        self.pageModel.showMessage('error', self.pageModel.translate(data.error_code, data.error_args || {}));

                    } else {
                        self.pageModel.showMessage('error', self.pageModel.translate('defaultCorparch__failed_to_update_item'));
                    }
                }
                return $.ajax(self.pageModel.getConf('rootPath') + 'user/get_favorite_corpora');
            },
            function (err, textStatus) {
                self.pageModel.showMessage('error', self.pageModel.translate('defaultCorparch__failed_to_update_item'));
                throw new Error(textStatus);
            }
        ).then(
            function (favItems) {
                if (favItems) {
                    if (!favItems.error) {
                        self.favoriteItemsTab.reinit(favItems);

                    } else {
                        self.pageModel.showMessage('error', self.pageModel.translate('defaultCorparch__failed_to_fetch_fav'));
                    }
                }
            },
            function (err) {
                self.pageModel.showMessage('error', self.pageModel.translate('defaultCorparch__failed_to_fetch_fav'));
            }
        );
    }

    /**
     * Determines currently selected subcorpus.
     * This depends only on the state of a respective selection element.
     */
    private getCurrentSubcorpus():string {
        return $('#subcorp-selector').val();
    }

    /**
     * Returns a name (the value defined in a respective Manatee registry file)
     * of a corpus identified by 'corpusId'
     *
     * @param canonicalCorpusId
     */
    private getAlignedCorpusName(canonicalCorpusId:string):string {
        var ans = null;
        $('#add-searched-lang-widget option').each(function (i, item) {
            if ($(item).val() === canonicalCorpusId) {
                ans = $(item).text();
                return false;
            }
        });
        return ans;
    }

    /**
     * Based on passed arguments, the method infers whether they match corpus user object, subcorpus
     * user object or aligned corpora user object.
     *
     * @param corpus_id regular identifier of a corpus
     * @param subcorpus_id name of a subcorpus
     * @param aligned_corpora list of aligned corpora
     * @returns an initialized CorplistItem or null if no matching state is detected
     */
    private inferItemCore(corpus_id:string, subcorpus_id:string,
                          aligned_corpora:Array<string>):common.CorplistItemUcnk {
        var ans:common.CorplistItemUcnk,
            self = this;

        if (corpus_id) {
            ans = common.createEmptyCorplistItem();
            ans.corpus_id = corpus_id; // TODO canonical vs. regular
            ans.canonical_id = corpus_id;



            if (subcorpus_id) {
                ans.type = commonDefault.CorplistItemType.SUBCORPUS;
                ans.subcorpus_id = subcorpus_id;
                ans.id = ans.corpus_id + ':' + ans.subcorpus_id;
                ans.name = this.pageModel.getConf('humanCorpname') + ':' + this.getCurrentSubcorpus();

            } else if (aligned_corpora.length > 0) {
                ans.type = commonDefault.CorplistItemType.ALIGNED_CORPORA;
                ans.id = [ans.corpus_id].concat(aligned_corpora).join('+');
                ans.name = this.pageModel.getConf('humanCorpname') + '+'
                    + aligned_corpora.map((item) => { return self.getAlignedCorpusName(item) }).join('+');
                ans.corpora = aligned_corpora;

            } else {
                ans.type = commonDefault.CorplistItemType.CORPUS;
                ans.id = ans.canonical_id;
                ans.name = this.pageModel.getConf<string>('humanCorpname');
            }
            return ans;

        } else {
            return null;
        }
    }

    /**
     * According to the state of the current query form, this method creates
     * a new CorplistItem instance with proper type, id, etc.
     */
    extractItemFromPage(userItemFlag?:commonDefault.Favorite):common.CorplistItemUcnk {
        var corpName:string,
            subcorpName:string = null,
            alignedCorpora:Array<string> = [],
            item:common.CorplistItemUcnk;

        if (userItemFlag === undefined) {
            userItemFlag = commonDefault.Favorite.NOT_FAVORITE;
        }
        corpName = this.pageModel.getConf<string>('corpname');
        if ($('#subcorp-selector').length > 0) {
            subcorpName = $('#subcorp-selector').val();
        }
        $('div.parallel-corp-lang:visible').each(function () {
            alignedCorpora.push($(this).attr('data-corpus-id'));
        });

        item = this.inferItemCore(corpName, subcorpName, alignedCorpora);
        item.featured = userItemFlag;
        return item;
    }

    /**
     *
     */
    init():void {
        var self = this;

        if (this.editable) {
            $(this.starImg).on('click', function (e) {
                if (!self.starSwitch.isStarred()) {
                    self.setFavorite(commonDefault.Favorite.FAVORITE);

                } else {
                    self.setFavorite(commonDefault.Favorite.NOT_FAVORITE);
                }
            });
            this.pageModel.registerOnSubcorpChangeAction(this.onSubcorpChange);
            this.pageModel.registerOnAddParallelCorpAction(this.onAlignedCorporaAdd);
            this.pageModel.registerOnBeforeRemoveParallelCorpAction(this.onAlignedCorporaRemove);
            this.favoriteItemsTab.registerChangeListener(this.onFavTabListChange);
        }
        this.starSwitch.setStarState(this.favoriteItemsTab.containsItem(this.extractItemFromPage()));
    }
}





/**
 * Corplist widget class. In most situations it is easier
 * to instantiate this via an exported function create().
 */
export class Corplist implements CorpusArchive.Widget {

    selectElm:HTMLElement;

    jqWrapper:JQuery;

    triggerButton:HTMLElement;

    options:Options;

    widgetWrapper:HTMLElement;

    private data:Array<common.CorplistItemUcnk>;

    private pageModel:Kontext.QueryPagePluginApi;

    private visible:Visibility;

    private widgetClass:string;

    private currCorpname:string;

    private currCorpIdent:string;

    private hiddenInput:HTMLElement;

    private parentForm:HTMLElement;

    private starImg:HTMLElement;

    private mainMenu:WidgetMenu;

    private starComponent:StarComponent;

    private searchBox:SearchTab;

    private favoritesBox:FavoritesTab;

    private footerElm:HTMLElement;

    onHide:(widget:Corplist)=>void;

    onShow:(widget:Corplist)=>void;

    private onSrchItemClick:CorplistSrchItemClick;

    private onFavItemClick:CorplistFavItemClick;

    /**
     *
     * @param options
     */
    constructor(options:Options, data:Array<common.CorplistItemUcnk>,
            pageModel:Kontext.QueryPagePluginApi, parentForm:HTMLElement) {
        this.options = options;
        this.data = data;
        this.pageModel = pageModel;
        this.parentForm = parentForm;
        this.currCorpIdent = pageModel.getConf<string>('corpname');
        this.currCorpname = pageModel.getConf<string>('humanCorpname');
        this.visible = Visibility.HIDDEN;
        this.widgetClass = this.options.widgetClass ? this.options.widgetClass : 'corplist-widget';
        this.onHide = this.options.onHide ? this.options.onHide : null;
        this.onShow = this.options.onShow ? this.options.onShow : null;

        function defaultHandleClick(corpusId:string, corpusName:string) {
            this.setCurrentValue(corpusId, corpusName);
            if (this.options.formTarget) {
                $(this.parentForm).attr('action', this.options.formTarget);
            }
            if (this.options.submitMethod) {
                $(this.parentForm).attr('method', this.options.submitMethod);
            }
            $(this.parentForm).submit();
        }

        this.onSrchItemClick = (corpusId:string, corpusName:string) => {
            if (this.options.itemClickAction) {
                this.options.itemClickAction.call(this, corpusId, corpusName);

            } else {
                defaultHandleClick.call(this, corpusId, corpusName);
            }
        };

        this.onFavItemClick = (itemId:string, itemName:string, href:string) => {
            if (this.options.itemClickAction) {
                this.options.itemClickAction.call(this, itemId, itemName, href);

            } else {
                this.pageModel.getUserSettings().set('active_parallel_corpora', undefined);
                window.location.href = href;
            }
        };
    }

    /**
     *
     */
    setCurrentValue(itemId:string, itemLabel:string):void {
         $(this.hiddenInput).val(itemId);
         this.setButtonLabel(itemLabel);
    }

    /**
     *
     * @param contents
     */
    setFooter(contents:JQuery) {
        $(this.footerElm).empty().append(contents);
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
            if (typeof this.onHide === 'function') {
                this.onHide.call(this, this);
            }

        } else if (state === Visibility.VISIBLE || state === undefined && this.visible === Visibility.HIDDEN) {
            this.visible = Visibility.VISIBLE;
            $(this.widgetWrapper).show();
            // even if the tab is 'current' we call this to make sure it is initialized properly
            this.mainMenu.getCurrent().show();
            if (typeof this.onShow === 'function') {
                this.onShow.call(this, this);
            }
        }
    }

    public isVisible():boolean {
        return this.visible === Visibility.VISIBLE;
    }

    /**
     *
     */
    public hide():void {
        this.switchComponentVisibility(Visibility.HIDDEN);
    }

    /**
     *
     */
    public show():void {
        this.switchComponentVisibility(Visibility.VISIBLE);
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

        let tmpHint = window.document.createElement('a');
        $(tmpHint).addClass('tmp-hint');
        $(tmpHint).html('<img src="' + this.pageModel.createStaticUrl('img/question-mark.svg')
            + '" alt="' + this.pageModel.translate('ucnkCorparch__tmp_hint_alt') + '" />');
        this.jqWrapper.append(tmpHint);
        popupBox.bind(tmpHint, this.pageModel.translate('ucnkCorparch__tmp_hint_contents'),
            {width: 'nice', closeIcon: true});

        // main menu
        this.mainMenu = new WidgetMenu(this, this.pageModel);

        // search func
        this.searchBox = new SearchTab(this.pageModel, this.jqWrapper.get(0), this.onSrchItemClick);
        this.searchBox.init();

        this.favoritesBox = new FavoritesTab(this.pageModel, this.widgetWrapper, this.data,
            this.pageModel.getConf('pluginData')['corparch']['featured'], this.onFavItemClick,
            this.options.favoriteItemsFilter);
        this.favoritesBox.init();

        this.footerElm = window.document.createElement('div');
        $(this.footerElm).addClass('footer');
        $(this.widgetWrapper).append(this.footerElm);

        // menu initialization
        this.mainMenu.init(this.searchBox, this.favoritesBox);

        this.jqWrapper.css({
            position: 'absolute'
        });

        this.bindOutsideClick();
        $(this.triggerButton).on('click', this.onButtonClick);

        if (!this.options.disableStarComponent) {
            this.starComponent = new StarComponent(this.favoritesBox, this.pageModel,
                this.options.editable !== undefined ? this.options.editable : true);
            this.starComponent.init();
        }

        this.switchComponentVisibility(Visibility.HIDDEN);
    }

    /**
     *
     */
    setButtonLabel(label:string) {
        $(this.triggerButton).text(label);
    }

    /**
     *
     * @param selectElm
     */
    bind(selectElm:HTMLElement):void {
        this.selectElm = selectElm;
        this.buildWidget();
    }

    getWrapperElm():HTMLElement {
        return this.widgetWrapper;
    }
}