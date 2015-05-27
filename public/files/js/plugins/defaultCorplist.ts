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

/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../../ts/declarations/typeahead.d.ts" />

/// <amd-dependency path="vendor/typeahead" />
/// <amd-dependency path="vendor/bloodhound" name="Bloodhound" />

import $ = require('jquery');


/**
 *
 */
enum Visibility {
    VISIBLE, HIDDEN
}

export enum Favorite {
    NOT_FAVORITE = 0,
    FAVORITE = 1
}

/**
 *
 */
export interface CorplistItem {
    id?: string;
    name: string;
    type: string;
    corpus_id: string;
    canonical_id: string;
    subcorpus_id: string;
    corpora: Array<string>;
    description: string;
    featured: Favorite;
    user_item: boolean;
    size: number;
    /**
     * A simplified/human readable version of size.
     * E.g. if the size is 1,200,000 then the size_info is '1M'
     */
    size_info: string;
}

/**
 *
 */
export interface CorplistItemClick {
    (corpId:string, corpName:string): void;
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
     * Using custom action disables implicit form submission which means
     * formTarget and submitMethod options have no effect unless you use
     * them directly in some way.
     */
    itemClickAction?:CorplistItemClick;

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
}

/**
 * Extracts user items encoded using JSON in data-item attributes of OPTION HTML elements.
 * This is expected to be filled in on server.
 *
 * @param select
 * @returns list of user items related to individual OPTION elements
 */
function fetchDataFromSelect(select:HTMLElement):Array<CorplistItem> {
    var elm:JQuery = $(select),
        ans:Array<CorplistItem> = [];

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

    currentBoxId:string;

    static SEARCH_WIDGET_ID:string = 'search';
    static MY_ITEMS_WIDGET_ID:string = 'my-corpora';

    static TAB_KEY = 9;

    /**
     *
     * @param widget
     */
    constructor(widget:Corplist) {
        this.widget = widget;
        this.menuWrapper = $('<div class="menu"></div>');
        $(this.widget.getWrapperElm()).append(this.menuWrapper);
        this.funcMap = {};
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
        this.menuWrapper.append('<a data-func="my-corpora">my list</a> | <a data-func="search">search</a>');
        this.favoriteBox = favoriteBox;
        this.searchBox = searchBox;
        this.funcMap[WidgetMenu.MY_ITEMS_WIDGET_ID] = this.favoriteBox; // TODO attributes vs. this map => redundancy & design flaw
        this.funcMap[WidgetMenu.SEARCH_WIDGET_ID] = this.searchBox;
        this.setCurrent(WidgetMenu.MY_ITEMS_WIDGET_ID);

        this.menuWrapper.find('a').on('click', function (e:JQueryEventObject) {
            self.setCurrent(e.currentTarget);
        });

        $(window.document).on('keyup.quick-actions', function (e:JQueryEventObject) {
            var cycle;

            if (self.widget.isVisible()) {
                cycle = [WidgetMenu.MY_ITEMS_WIDGET_ID, WidgetMenu.SEARCH_WIDGET_ID];
                if (e.keyCode == WidgetMenu.TAB_KEY) {
                    self.setCurrent(cycle[(cycle.indexOf(self.currentBoxId) + 1) % 2]);
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });
    }
}

/**
 * This class represents the SearchTab tab
 */
export class SearchTab implements WidgetTab {

    pluginApi:Kontext.PluginApi;

    widgetWrapper:HTMLElement;

    itemClickCallback:CorplistItemClick;

    wrapper:HTMLElement;

    srchField:HTMLElement;

    bloodhound:Bloodhound<string>; // Typeahead's suggestion engine

    private tagPrefix:string;

    private selectedTags:{[key:string]:HTMLElement};

    /**
     *
     * @param widgetWrapper
     */
    constructor(pluginApi:Kontext.FirstFormPage, widgetWrapper:HTMLElement, itemClickCallback:CorplistItemClick) {
        this.pluginApi = pluginApi;
        this.widgetWrapper = widgetWrapper;
        this.itemClickCallback = itemClickCallback;
        this.wrapper = window.document.createElement('div');
        $(this.widgetWrapper).append(this.wrapper);
        this.tagPrefix = this.pluginApi.getConf('pluginData')['corptree']['tag_prefix'];
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
        var ans = [];

        for (var p in this.selectedTags) {
            if (this.selectedTags.hasOwnProperty(p)) {
                ans.push(this.tagPrefix + p);
            }
        }

        return ans.join(' ');
    }

    /**
     *
     * @param id
     */
    private toggleTagSelection(link:HTMLElement, ctrlPressed:boolean):void {
        var id = $(link).data('srchkey'),
            toReset;

        if (!ctrlPressed) {
            toReset = [];
            for (var p in this.selectedTags) {
                if (this.selectedTags.hasOwnProperty(p)
                        && this.selectedTags[p]
                        && p !== id) {
                    toReset.push(p);
                }
            }
            for (var i = 0; i < toReset.length; i += 1) {
                $(this.selectedTags[toReset[i]]).removeClass('selected');
                delete this.selectedTags[toReset[i]];
            }
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
     */
    private initLabels():void {
        var div = window.document.createElement('div'),
            self = this;

        $(this.wrapper).append(div);
        $(div).addClass('labels');
        $.each(this.pluginApi.getConf('pluginData')['corptree']['corpora_labels'], function (i, item) {
            var link = window.document.createElement('a');
            $(div).append(link);
            $(link).append(item[0]).addClass('keyword');
            if (item[2] === 1) {
                $(link).addClass('featured');
                $(link).attr('title', 'featured'); // TODO translation

            } else if (item[2] === 2) {
                $(link).addClass('favorite');
                $(link).attr('title', 'favorite'); // TODO translation
            }
            $(link).attr('data-srchkey', item[1]);
            $(link).on('click', function (e:JQueryEventObject) {
                self.toggleTagSelection(link, e.ctrlKey);
                self.triggerTypeaheadSearch();
            });
            if (i < self.pluginApi.getConf('pluginData')['corptree']['corpora_labels']['length'] - 1) {
                $(div).append(' ');
            }
        });
        $(div).append('<span class="labels-hint">(' + this.pluginApi.translate('hold_ctrl') + ')</span>');
    }

    private initTypeahead():void {
        var self = this;
        var remoteOptions:Bloodhound.RemoteOptions<string> = {
            url : self.pluginApi.getConf('rootURL') + 'corpora/ajax_list_corpora',
            prepare: function (query, settings) {
                settings.url += '?query=' + encodeURIComponent(self.getTagQuery() + ' ' + query);
                return settings;
            }
        };
        var bhOptions:Bloodhound.BloodhoundOptions<string> = {
            datumTokenizer: function(d) {
                return Bloodhound.tokenizers.whitespace(d.name);
            },
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            remote: remoteOptions,
            limit: 100 // TODO configurable
        };
        this.bloodhound = new Bloodhound(bhOptions);
        this.bloodhound.initialize();

        var options:Twitter.Typeahead.Options = {
            name: 'corplist',
            hint: true,
            highlight: true,
            minLength: 2
        };

        $(this.srchField).typeahead(options, {
            displayKey : 'name',
            source : this.bloodhound.ttAdapter(),
            templates: {
                suggestion: function (item:SearchResponse) {
                    return $('<p>' + item.name
                        + ' <span class="num">(size: ~' + item.raw_size + ')</span></p>');
                }
            }
        });

        $(this.srchField).on('typeahead:selected', function (x, suggestion:{[k:string]:any}) {
            self.itemClickCallback(suggestion['id'], suggestion['name']);
        });
    }

    /**
     *
     */
    init():void {
        var jqWrapper = $(this.wrapper),
            inputWrapper = window.document.createElement('div');

        this.initLabels();
        jqWrapper.append(inputWrapper);

        this.srchField = window.document.createElement('input');
        $(this.srchField)
            .addClass('corp-search')
            .attr('type', 'text')
            .attr('placeholder', this.tagPrefix + this.pluginApi.translate('label or name'));
        $(inputWrapper).append(this.srchField).addClass('srch-box');

        this.initTypeahead();
        this.hide();
    }

    /**
     *
     * @returns {}
     */
     getFooter():JQuery {
        return $('<span>' + this.pluginApi.translate('hit [Tab] to see your favorite items') + '</span>');
     }
}

/**
 * This class represents the FavoritesTab (= user item) tab
 */
class FavoritesTab implements WidgetTab {

    pageModel:Kontext.PluginApi;

    widgetWrapper:HTMLElement;

    tablesWrapper:HTMLElement;

    dataFav:Array<CorplistItem>;

    private wrapperFav:HTMLElement;

    dataFeat:Array<CorplistItem>;

    private wrapperFeat:HTMLElement;

    itemClickCallback:CorplistItemClick;

    editMode:boolean;

    onListChange:Array<(trigger:FavoritesTab)=>void>;  // list of registered callbacks

    /**
     *
     * @param widgetWrapper
     */
    constructor(pageModel:Kontext.PluginApi, widgetWrapper:HTMLElement, dataFav:Array<CorplistItem>,
                dataFeat:Array<CorplistItem>, itemClickCallback?:CorplistItemClick) {
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
            .append('<tr><th colspan="2">'
                    + '<img class="config over-img" '
                    + 'title="' + this.pageModel.translate('click to (un)lock items for removal') + '" '
                    + 'alt="' + this.pageModel.translate('click to (un)lock items for removal') + '" '
                    + 'src="' + this.pageModel.createStaticUrl('img/config-icon_16x16.png') + '" '
                    + 'data-alt-img="' + this.pageModel.createStaticUrl('img/config-icon_16x16_s.png') + '" '
                    + ' />'
                    + this.pageModel.translate('favorite items') + '</th>'
                    + '<th></th></tr>');
        $(this.tablesWrapper).append(this.wrapperFav);

        $(this.tablesWrapper).find('img.config').on('click', function () {
            self.switchItemEditMode();
        });

        this.wrapperFeat = window.document.createElement('table');
        $(this.wrapperFeat).addClass('featured-list')
            .append('<tr><th colspan="2">' + this.pageModel.translate('featured corpora') + '</th></tr>');
        $(this.tablesWrapper).append(this.wrapperFeat);
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
    containsItem(item:CorplistItem):boolean {
        for (var i = 0; i < this.dataFav.length; i += 1) {
            if (this.dataFav[i].id == item.id) {
                return true;
            }
        }
        return false;
    }

    switchItemEditMode() {
        if (this.editMode === false) {
            $(this.wrapperFav).find('img.remove').removeClass('disabled');

        } else {
            $(this.wrapperFav).find('img.remove').addClass('disabled');
        }
        this.editMode = !this.editMode;
    }

    /**
     * Generates first_form's URL along with all the necessary parameters
     * (depends on type of item - corpus vs. subcorpus vs. aligned corpora).
     *
     * @param itemData
     * @returns {string}
     */
    generateItemUrl(itemData):string {
        var rootPath = this.pageModel.createActionUrl('/first_form'),
            params = ['corpname=' + itemData.corpus_id];

        if (itemData.type === 'subcorpus') {
            params.push('usesubcorp=' + itemData.subcorpus_id);
        }
        if (itemData.type === 'aligned_corpora') {
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
                    self.pageModel.showMessage('info', self.pageModel.translate('item removed from favorites'));
                    return $.ajax(self.pageModel.getConf('rootPath') + 'user/get_favorite_corpora');

                } else {
                    self.pageModel.showMessage('error', this.pageModel.translate('failed to remove item from favorites'));
                }

            },
            function (err) {
                self.pageModel.showMessage('error', this.pageModel.translate('failed to remove item from favorites'));
            }
        ).then(
            function (favItems) {
                if (!favItems.error) {
                    self.reinit(favItems);
                    $.each(self.onListChange, function (i, fn:(trigger:FavoritesTab)=>void) {
                        fn.call(self, self);
                    });

                } else {
                    self.pageModel.showMessage('error', self.pageModel.translate('failed to fetch favorite items'));
                }
            },
            function (err) {
                self.pageModel.showMessage('error', self.pageModel.translate('failed to fetch favorite items'));
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

        $.each(this.dataFav, function (i, item) {
            jqWrapper.append('<tr class="data-item"><td><a class="corplist-item"'
                + ' title="' + item.description + '"'
                + ' href="' + self.generateItemUrl(item)
                + '" data-id="' + item.id + '">' + item.name + '</a></td>'
                + '<td class="num">~' + item.size_info + '</td>'
                + '<td class="tools"><img class="remove over-img disabled" '
                + 'alt="' + self.pageModel.translate('click to remove the item from favorites') + '" '
                + 'title="' + self.pageModel.translate('click to remove the item from favorites') + '" '
                + 'src="' + self.pageModel.createStaticUrl('img/close-icon.png') + '" '
                + 'data-alt-img="' + self.pageModel.createStaticUrl('img/close-icon_s.png') + '" />'
                + '</td></tr>');
        });

        jqWrapper.find('td.tools img.remove').on('click', function (e:JQueryEventObject) {
            if (!$(e.currentTarget).hasClass('disabled')) {
                self.removeFromList($(e.currentTarget).closest('tr').find('a.corplist-item').data('id'));
            }
        });

        jqWrapper.find('a.corplist-item').each(function() {
            $(this).on('click', function (e:Event) {
                if (typeof self.itemClickCallback === 'function') {
                    self.itemClickCallback($(e.currentTarget).data('id'), $(e.currentTarget).data('name'));
                    e.stopPropagation();
                    e.preventDefault();
                }
            });
        });

        if (this.dataFeat.length > 0) {
            $.each(this.dataFeat, function (i, item:Array<string>) { // item = (id, name, size)
                $(self.wrapperFeat).append('<tr class="data-item"><td><a href="'
                    + self.pageModel.createActionUrl('first_form?corpname=') + item[0] + '">'
                    + item[1] + '</a></td>'
                    + '<td class="num">'
                    + (parseInt(item[2]) > 0 ? '~' + item[2] : '<span title="'
                            + self.pageModel.translate('unknown size') + '">?</span>')
                    + '</td>'
                    + '</tr>');
            });

        } else {
            $(this.wrapperFeat).hide();
        }
    }

    reinit(newData:Array<CorplistItem>):void {
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
        return $('<span>' + this.pageModel.translate('hit [Tab] to start a search') + '</span>');
    }
}

/**
 */
class StarSwitch {

    pageModel:Kontext.PluginApi;

    triggerElm:HTMLElement;

    itemId:string;

    constructor(pageModel:Kontext.PluginApi, triggerElm:HTMLElement) {
        this.pageModel = pageModel;
        this.triggerElm = triggerElm;
        this.itemId = $(this.triggerElm).data('item-id');
    }

    setItemId(id:string):void {
        this.itemId = id;
        $(this.triggerElm).attr('data-item-id', id);
    }

    getItemId():string {
        return this.itemId;
    }

    setStarState(state:boolean):void {
        if (state === true) {
            $(this.triggerElm)
                .attr('src', this.pageModel.createStaticUrl('img/starred_24x24.png'))
                .addClass('starred');

        } else {
            $(this.triggerElm)
                .attr('src', this.pageModel.createStaticUrl('img/starred_24x24_grey.png'))
                .removeClass('starred');
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

    private pageModel:Kontext.FirstFormPage;

    private starSwitch:StarSwitch;

    private editable:boolean;

    /**
     * Once user adds an aligned corpus we must
     * test whether the new corpora combinations is already
     * in favorites or not.
     */
    onAlignedCorporaAdd = (corpname:string) => {
        var newItem:CorplistItem;

        newItem = this.extractItemFromPage();
        this.starSwitch.setStarState(this.favoriteItemsTab.containsItem(newItem));
    };

    /**
     * Once user removes an aligned corpus we must
     * test whether the new corpora combinations is already
     * in favorites or not.
     */
    onAlignedCorporaRemove = (corpname:string) => {
        var newItem:CorplistItem;

        newItem = this.extractItemFromPage();
        this.starSwitch.setStarState(this.favoriteItemsTab.containsItem(newItem));
    };

    /**
     * Once user changes a subcorpus we must test
     * whether the new corpus:subcorpus combination is
     * already in favorites.
     */
    onSubcorpChange = (subcname:string) => {
        var newItem:CorplistItem;

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
    constructor(favoriteItemsTab:FavoritesTab, pageModel:Kontext.FirstFormPage, editable:boolean) {
        this.favoriteItemsTab = favoriteItemsTab;
        this.pageModel = pageModel;
        this.editable = editable;
        this.starSwitch = new StarSwitch(this.pageModel, $('#mainform div.starred img').get(0));
    }

    /**
     * Sets a favorite item via a server call
     *
     * @param flag
     */
    setFavorite(flag:Favorite) {
        var self = this,
            prom:JQueryXHR,
            newItem:CorplistItem,
            message:string,
            postDispatch:(data:any)=>void;

        if (flag === Favorite.FAVORITE) {
            newItem = this.extractItemFromPage(flag);
            prom = $.ajax(this.pageModel.getConf('rootPath') + 'user/set_favorite_item',
                {method: 'POST', data: newItem, dataType: 'json'});
            message = self.pageModel.translate('item added to favorites');
            postDispatch = function (data) {
                self.starSwitch.setItemId(data.id);
            };

        } else {
            prom = $.ajax(this.pageModel.getConf('rootPath') + 'user/unset_favorite_item',
                {method: 'POST', data: {id: self.starSwitch.getItemId()}, dataType: 'json'});
            message = self.pageModel.translate('item removed from favorites');
            postDispatch = function (data) {
                self.starSwitch.setItemId(null);
            };
        }

        prom.then(
            function (data) {
                if (!data.error) {
                    self.pageModel.showMessage('info', message);
                    postDispatch(data);
                    return $.ajax(self.pageModel.getConf('rootPath') + 'user/get_favorite_corpora');

                } else {
                    self.pageModel.showMessage('error', self.pageModel.translate('failed to update item'));
                }
            },
            function (err) {
                self.pageModel.showMessage('error', self.pageModel.translate('failed to update item'));
            }
        ).then(
            function (favItems) {
                if (!favItems.error) {
                    self.favoriteItemsTab.reinit(favItems);

                } else {
                    self.pageModel.showMessage('error', self.pageModel.translate('failed to fetch favorite items'));
                }
            },
            function (err) {
                self.pageModel.showMessage('error', self.pageModel.translate('failed to fetch favorite items'));
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
    private inferItemCore(corpus_id:string, subcorpus_id:string, aligned_corpora:Array<string>):CorplistItem {
        var ans:CorplistItem,
            self = this;

        if (corpus_id) {
            ans = {
                id: null, name: null, type: null, corpus_id: null, canonical_id: null,
                subcorpus_id: null, corpora: null, description: null, featured: null,
                size: null, size_info: null, user_item: null
            };
            ans.corpus_id = corpus_id; // TODO canonical vs. regular
            ans.canonical_id = corpus_id;



            if (subcorpus_id) {
                ans.type = 'subcorpus';
                ans.subcorpus_id = subcorpus_id;
                ans.id = ans.corpus_id + ':' + ans.subcorpus_id;
                ans.name = this.pageModel.getConf('humanCorpname') + ':' + this.getCurrentSubcorpus();

            } else if (aligned_corpora.length > 0) {
                ans.type = 'aligned_corpora';
                ans.id = [ans.corpus_id].concat(aligned_corpora).join('+');
                ans.name = this.pageModel.getConf('humanCorpname') + '+'
                                + aligned_corpora.map((item) => { return self.getAlignedCorpusName(item) }).join('+');
                ans.corpora = aligned_corpora;

            } else {
                ans.type = 'corpus';
                ans.id = ans.canonical_id;
                ans.name = this.pageModel.getConf('humanCorpname');
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
    extractItemFromPage(userItemFlag?:Favorite):CorplistItem {
        var corpName:string,
            subcorpName:string = null,
            alignedCorpora:Array<string> = [],
            item:CorplistItem;

        if (userItemFlag === undefined) {
            userItemFlag = Favorite.NOT_FAVORITE;
        }

        corpName = this.pageModel.getConf('corpname');
        if ($('#subcorp-selector').length > 0) {
            subcorpName = $('#subcorp-selector').val();
        }
        $('div.parallel-corp-lang:visible').each(function () {
            alignedCorpora.push($(this).data('corpus-id'));
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
            $('#mainform .starred img').on('click', function (e) {
                if (!self.starSwitch.isStarred()) {
                    self.starSwitch.setStarState(true);
                    self.setFavorite(Favorite.FAVORITE);

                } else {
                    self.starSwitch.setStarState(false);
                    self.setFavorite(Favorite.NOT_FAVORITE);
                }
            });

            this.pageModel.registerOnSubcorpChangeAction(this.onSubcorpChange);
            this.pageModel.registerOnAddParallelCorpAction(this.onAlignedCorporaAdd);
            this.pageModel.registerOnBeforeRemoveParallelCorpAction(this.onAlignedCorporaRemove);

            this.favoriteItemsTab.registerChangeListener(this.onFavTabListChange);
        }
    }
}


/**
 * Corplist widget class. In most situations it is easier
 * to instantiate this via an exported function create().
 */
export class Corplist {

    selectElm:HTMLElement;

    jqWrapper:JQuery;

    triggerButton:HTMLElement;

    options:Options;

    widgetWrapper:HTMLElement;

    private data:Array<CorplistItem>;

    private pageModel:Kontext.FirstFormPage;

    private visible:Visibility;

    private widgetClass:string;

    private currCorpname:string;

    private currCorpIdent:string;

    private hiddenInput:HTMLElement;

    private parentForm:HTMLElement;

    private mainMenu:WidgetMenu;

    private starComponent:StarComponent;

    searchBox:SearchTab;

    private favoritesBox:FavoritesTab;

    private footerElm:HTMLElement;

    onHide:(widget:Corplist)=>void;

    onShow:(widget:Corplist)=>void;


    onItemClick:CorplistItemClick = (corpusId:string, corpusName:string) => {
        $(this.hiddenInput).val(corpusId);
        this.setButtonLabel(corpusName);

        if (this.options.itemClickAction) {
            this.options.itemClickAction.call(this, corpusId);

        } else {
            if (this.options.formTarget) {
                $(this.parentForm).attr('action', this.options.formTarget);
            }
            if (this.options.submitMethod) {
                $(this.parentForm).attr('method', this.options.submitMethod);
            }
            $(this.parentForm).submit();
        }
    };

    /**
     *
     * @param options
     */
    constructor(options:Options, data:Array<CorplistItem>, pageModel:Kontext.FirstFormPage, parentForm:HTMLElement) {
        this.options = options;
        this.data = data;
        this.pageModel = pageModel;
        this.parentForm = parentForm;
        this.currCorpIdent = pageModel.getConf('corpname');
        this.currCorpname = pageModel.getConf('humanCorpname');
        this.visible = Visibility.HIDDEN;
        this.widgetClass = this.options.widgetClass ? this.options.widgetClass : 'corplist-widget';
        this.onHide = this.options.onHide ? this.options.onHide : null;
        this.onShow = this.options.onShow ? this.options.onShow : null;
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

        // main menu
        this.mainMenu = new WidgetMenu(this);

        // search func
        this.searchBox = new SearchTab(this.pageModel, this.jqWrapper.get(0), this.onItemClick);
        this.searchBox.init();

        this.favoritesBox = new FavoritesTab(this.pageModel, this.widgetWrapper, this.data,
            this.pageModel.getConf('pluginData')['corptree']['featured']);
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

        this.starComponent = new StarComponent(this.favoritesBox, this.pageModel,
            this.options.editable !== undefined ? this.options.editable : true);
        this.starComponent.init();

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

/**
 * Creates a corplist widget which is a box containing two tabs
 *  1) user's favorite items
 *  2) corpus search tool
 *
 * @param selectElm A HTML SELECT element for default (= non JS) corpus selection we want to be replaced by this widget
 * @param pluginApi
 * @param options A configuration for the widget
 */
export function create(selectElm:HTMLElement, pluginApi:Kontext.FirstFormPage, options:Options):Corplist {
    var corplist:Corplist,
        data:Array<CorplistItem>;

    data = fetchDataFromSelect(selectElm);
    corplist = new Corplist(options, data, pluginApi, $(selectElm).closest('form').get(0));
    corplist.bind(selectElm);
    return corplist;
}