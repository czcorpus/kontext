/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../../ts/declarations/typeahead.d.ts" />
/// <reference path="../../types/common.d.ts" />
/// <reference path="../../types/plugins/corparch.d.ts" />

import * as $ from 'jquery';
import * as common from './common';
import * as popupBox from '../../popupbox';


/**
 * A general click action performed on featured/favorite/searched item
 */
export interface CorplistItemClick {
    (item:common.CorplistItem):void;
}

/**
 *
 */
enum Visibility {
    VISIBLE, HIDDEN
}

interface FeaturedItem {
    id: string;
    canonical_id: string;
    name: string;
    size: string; // rough size (100G, 1T etc.)
    description: string;
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
export interface Options extends CorparchCommon.Options {

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
    favoriteItemsFilter?:(item:common.CorplistItem)=>boolean;

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

    pageModel:Kontext.PluginApi;

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
    constructor(widget:Corplist, pageModel:Kontext.PluginApi) {
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
        this.menuWrapper.find('a').each((_, elm) => {
            $(elm).removeClass('current');
            this.getTabByIdent($(elm).data('func')).hide();
        });
    }

    /**
     *
     * @param trigger
     */
    setCurrent(trigger:EventTarget):void;
    setCurrent(trigger:string):void;
    setCurrent(trigger):void {
        let newTabId:string;
        let menuLink:HTMLElement;
        let newActiveWidget:WidgetTab;

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
        const self = this;
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
            if (!self.blockingTimeout && self.widget.isVisible()) {
                const cycle = [WidgetMenu.MY_ITEMS_WIDGET_ID, WidgetMenu.SEARCH_WIDGET_ID];
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
        $(window).on('blur', () => {
            clearTimeout(self.blockingTimeout);
            self.blockingTimeout = null;
        });
        $(window).on('focus', () => {
            self.blockingTimeout = setTimeout(() => {
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

    itemClickCallback:CorplistItemClick;

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
    constructor(pluginApi:Kontext.PluginApi, widgetWrapper:HTMLElement, itemClickCallback:CorplistItemClick) {
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
        const ans = [];

        for (let p in this.selectedTags) {
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
        const toReset = [];
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
        const id = $(link).data('srchkey');

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
        const link = window.document.createElement('a');
        const overlay = window.document.createElement('span');

        $(link)
            .addClass('keyword')
            .addClass('reset')
            .on('click', () => {
                this.resetTagSelection();
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
        const div = window.document.createElement('div');
        const self = this;

        $(this.wrapper).append(div);
        $(div).addClass('labels');
        $(div).append(this.createResetLink());
        this.pluginApi.getConf<Array<[string,string,string]>>('pluginData')['corparch']['corpora_labels'].forEach(item => {
            const link = window.document.createElement('a');
            const overlay = window.document.createElement('span');

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
        const self = this;
        const remoteOptions:Bloodhound.RemoteOptions<string> = {
            url : self.pluginApi.getConf('rootURL') + 'corpora/ajax_list_corpora',
            prepare: function (query, settings) {
                settings.url += '?query=' + encodeURIComponent(self.getTagQuery() + ' ' + query);
                return settings;
            },
            transform: function (response) {
                return response.rows;
            }
        };
        const bhOptions:Bloodhound.BloodhoundOptions<string> = {
            datumTokenizer: function(d) {
                return Bloodhound.tokenizers.whitespace(d.name);
            },
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            remote: remoteOptions
        };
        this.bloodhound = new Bloodhound(bhOptions);
        this.bloodhound.initialize();

        const options:Twitter.Typeahead.Options = {
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

                }
            }
        });

        this.loaderKiller = null;

        $(this.srchField).on('typeahead:selected', function (x, suggestion:{[k:string]:any}) {
            self.itemClickCallback.call(self, suggestion);
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
        const jqWrapper = $(this.wrapper);
        const srchBox = window.document.createElement('div');
        const inputWrapper = window.document.createElement('div');

        this.initLabels();
        jqWrapper.append(srchBox);
        $(srchBox)
            .addClass('srch-box')
            .append(inputWrapper);

        this.ajaxLoader = window.document.createElement('img');
        $(this.ajaxLoader)
            .attr('src', this.pluginApi.createStaticUrl('img/ajax-loader-bar.gif'))
            .addClass('ajax-loader')
            .addClass('hidden')
            .attr('title', this.pluginApi.translate('global__loading') + '...');
        $(inputWrapper).append(this.ajaxLoader);

        this.srchField = window.document.createElement('input');
        $(this.srchField)
            .addClass('corp-search')
            .attr('type', 'text')
            .attr('placeholder', this.pluginApi.translate('defaultCorparch__name_or_description'))
            .on('keydown', (evt) => {
                if (evt.keyCode === 13) { // prevent form submit and let Typeahead select the item
                    evt.preventDefault();
                    evt.stopPropagation();
                }
            });
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

export interface CorpusSwitchFavData {
    dataFav:Array<common.CorplistItem>;
}

/**
 * This class represents the FavoritesTab (= user item) tab
 */
class FavoritesTab implements WidgetTab, Kontext.ICorpusSwitchAware<CorpusSwitchFavData> {

    pageModel:Kontext.PluginApi;

    targetAction:string;

    widgetWrapper:HTMLElement;

    tablesWrapper:HTMLElement;

    dataFav:Array<common.CorplistItem>;

    private wrapperFav:HTMLElement;

    dataFeat:Array<FeaturedItem>;

    private wrapperFeat:HTMLElement;

    itemClickCallback:CorplistItemClick;

    editMode:boolean;

    onListChange:Array<(trigger:FavoritesTab)=>void>;  // list of registered callbacks

    customListFilter:(item:common.CorplistItem)=>boolean;

    /**
     *
     */
    constructor(targetAction:string, pageModel:Kontext.PluginApi, widgetWrapper:HTMLElement,
                dataFav:Array<common.CorplistItem>, dataFeat:Array<FeaturedItem>, itemClickCallback?:CorplistItemClick,
                customListFilter?:(item:common.CorplistItem)=>boolean) {
        const self = this;
        this.editMode = false;
        this.onListChange = [];
        this.targetAction = targetAction;
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

    csExportState():CorpusSwitchFavData {
        return {
            dataFav: this.dataFav
        };
    }

    csSetState(state:CorpusSwitchFavData):void {
        this.reinit(state.dataFav);
    }

    csGetStateKey():string {
        return 'default-corparch-corpus-switch-fav-data';
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
    containsItem(item:common.CorplistItem):boolean {
        for (let i = 0; i < this.dataFav.length; i += 1) {
            if (this.dataFav[i].id === item.id) {
                return true;
            }
        }
        return false;
    }

    getFavItemById(id:string):common.CorplistItem {
        for (let i = 0; i < this.dataFav.length; i += 1) {
            if (this.dataFav[i].id === id) {
                return this.dataFav[i];
            }
        }
        return undefined;
    }

    getFeatItemById(id:string):common.CorplistItem {
        for (let i = 0; i < this.dataFeat.length; i += 1) {
            if (this.dataFeat[i].canonical_id === id) {
                const tmp = this.dataFeat[i];
                return {
                    id: tmp.id,
                    name: tmp.name,
                    type: 'corpus',
                    corpus_id: tmp.id,
                    canonical_id: tmp.canonical_id,
                    subcorpus_id: null,
                    corpora: [],
                    description: null,
                    featured: 1,
                    user_item: false,
                    size: null,
                    size_info: null
                };
            }
        }
        return undefined;
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
        const params:Array<[string, string]> = [['corpname', itemData.corpus_id]];

        if (itemData.type === common.CorplistItemType.SUBCORPUS) {
            params.push(['usesubcorp', itemData.subcorpus_id]);
        }
        if (itemData.type === common.CorplistItemType.ALIGNED_CORPORA) {
            itemData.corpora.forEach(item => {
                params.push(['align', item.corpus_id]);
            });
        }
        return this.pageModel.createActionUrl(this.targetAction, params);
    }

    /**
     *
     * @param itemId
     */
    private removeFromList(itemId:string) {
        this.pageModel.ajax<Kontext.AjaxResponse>(
            'POST',
            this.pageModel.createActionUrl('user/unset_favorite_item'),
            {id: itemId},
            {contentType : 'application/x-www-form-urlencoded'}

        ).then(
            (data) => {
                if (!data.contains_errors) {
                    this.pageModel.showMessage('info', this.pageModel.translate('defaultCorparch__item_removed_from_fav'));
                    return this.pageModel.ajax(
                        'GET',
                        this.pageModel.createActionUrl('user/get_favorite_corpora'),
                        {},
                        {contentType : 'application/x-www-form-urlencoded'}
                    );

                } else {
                    this.pageModel.showMessage('error', this.pageModel.translate('defaultCorparch__failed_to_remove_fav'));
                    throw new Error(data.messages[0]);
                }

            },
            (err) => {
                this.pageModel.showMessage('error', this.pageModel.translate('defaultCorparch__failed_to_remove_fav'));
            }
        ).then(
            (favItems:any) => { // TODO !!!
                if (favItems && !favItems.error) {
                    this.reinit(favItems);

                } else {
                    this.pageModel.showMessage('error', this.pageModel.translate('defaultCorparch__failed_to_fetch_fav'));
                    throw new Error(favItems.error);
                }
            },
            function (err) {
                this.pageModel.showMessage('error', this.pageModel.translate('defaultCorparch__failed_to_fetch_fav'));
            }
        );
    }

    /**
     *
     */
    init():void {
        const jqWrapper = $(this.wrapperFav);
        const self = this;

        this.editMode = false;

        function createItem(data:common.CorplistItem):HTMLElement {
            const trElm = window.document.createElement('tr');
            trElm.className = 'data-item';

            const td1Elm = window.document.createElement('td');
            trElm.appendChild(td1Elm);
            const aElm = window.document.createElement('a');
            aElm.className = 'corplist-item';
            aElm.setAttribute('title', data.description || '');
            aElm.setAttribute('href', self.generateItemUrl(data));
            aElm.setAttribute('data-id', data.id);
            aElm.textContent = data.name;
            td1Elm.appendChild(aElm);

            const td2Elm = window.document.createElement('td');
            td2Elm.className = 'num';
            td2Elm.textContent = data.size_info;
            trElm.appendChild(td2Elm);

            const td3Elm = window.document.createElement('td');
            td3Elm.className = 'tools';
            trElm.appendChild(td3Elm);

            const imgElm = window.document.createElement('img');
            imgElm.className = 'remove over-img disabled';
            imgElm.setAttribute('alt', self.pageModel.translate('defaultCorparch__click_to_remove_item_from_fav'));
            imgElm.setAttribute('title', self.pageModel.translate('defaultCorparch__click_to_remove_item_from_fav'));
            imgElm.setAttribute('src', self.pageModel.createStaticUrl('img/close-icon.svg'));
            td3Elm.appendChild(imgElm);

            return trElm;
        }

        if (!this.pageModel.getConf('anonymousUser')) {
            this.dataFav.forEach(item => {
                if (self.customListFilter(item)) {
                    jqWrapper.append(createItem(item));
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
                        const favitem = self.getFavItemById($(e.currentTarget).data('id'));
                        self.itemClickCallback.call(self, favitem);
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
            this.dataFeat.forEach((item:FeaturedItem) => {
                $(self.wrapperFeat).append('<tr class="data-item"><td>'
                    + '<a class="featured-item"'
                    + ' href="' + self.pageModel.createActionUrl(this.targetAction)
                    + '?corpname=' + item.id + '"'
                    + ' data-id="' + item.canonical_id + '"'
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
                        const item = self.getFeatItemById($(e.currentTarget).data('id'));
                        self.itemClickCallback.call(self, item);
                        e.stopPropagation();
                        e.preventDefault();
                    }
                });
            });

        } else {
            $(this.wrapperFeat).hide();
        }
    }

    reinit(newData:Array<common.CorplistItem>):void {
        $(this.wrapperFav).find('tr.data-item').remove();
        this.dataFav = newData;
        $(this.wrapperFeat).find('tr.data-item').remove();
        this.init();
        this.onListChange.forEach((fn:(trigger:FavoritesTab)=>void) => {
            fn.call(this, this);
        });
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

    private pageModel:Kontext.PluginApi;

    private querySetupHandler:Kontext.QuerySetupHandler;

    private starSwitch:StarSwitch;

    private editable:boolean;

    private starImg:HTMLElement;

    /**
     * Once user adds an aligned corpus we must
     * test whether the new corpora combinations is already
     * in favorites or not.
     */
    onAlignedCorporaAdd = (corpname:string) => {
        this.starSwitch.setStarState(this.favoriteItemsTab.containsItem(this.extractItemFromPage()));
    };

    /**
     * Once user removes an aligned corpus we must
     * test whether the new corpora combinations is already
     * in favorites or not.
     */
    onAlignedCorporaRemove = (corpname:string) => {
        this.starSwitch.setStarState(this.favoriteItemsTab.containsItem(this.extractItemFromPage()));
    };

    /**
     * Once user changes a subcorpus we must test
     * whether the new corpus:subcorpus combination is
     * already in favorites.
     */
    onSubcorpChange = (subcname:string) => {
        this.starSwitch.setStarState(this.favoriteItemsTab.containsItem(this.extractItemFromPage()));
    };

    /**
     *
     * @param trigger
     */
    onFavTabListChange = (trigger:FavoritesTab) => {
        if (!trigger.containsItem(this.extractItemFromPage())) {
            this.starSwitch.setStarState(false);

        } else {
            this.starSwitch.setStarState(true);
        }
    };

    /**
     *
     * @param favoriteItemsTab
     * @param pageModel
     */
    constructor(favoriteItemsTab:FavoritesTab, pageModel:Kontext.PluginApi,
            querySetupHandler:Kontext.QuerySetupHandler, editable:boolean) {
        this.favoriteItemsTab = favoriteItemsTab;
        this.pageModel = pageModel;
        this.querySetupHandler = querySetupHandler;
        this.starImg = window.document.createElement('img');

        const currItem:common.CorplistItem = this.extractItemFromPage();
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
    setFavorite(flag:common.Favorite) {
        let prom:RSVP.Promise<any>; // TODO type
        let newItem:common.CorplistItem;
        let message:string;
        let postDispatch:(data:any)=>void;

        if (flag === common.Favorite.FAVORITE) {
            newItem = this.extractItemFromPage(flag);
            prom = this.pageModel.ajax(
                'POST',
                this.pageModel.createActionUrl('user/set_favorite_item'),
                newItem,
                {contentType : 'application/x-www-form-urlencoded'}
            );
            message = this.pageModel.translate('defaultCorparch__item_added_to_fav');
            postDispatch = (data) => this.starSwitch.setItemId(data.id);

        } else {
            prom = this.pageModel.ajax(
                'POST',
                this.pageModel.createActionUrl('user/unset_favorite_item'),
                {id: this.starSwitch.getItemId()},
                {contentType : 'application/x-www-form-urlencoded'}
            );
            message = this.pageModel.translate('defaultCorparch__item_removed_from_fav');
            postDispatch = (data) => this.starSwitch.setItemId(null);
        }

        prom.then<Array<common.CorplistItem>>(
            (data:Kontext.AjaxResponse) => {
                if (!data.contains_errors) {
                    this.pageModel.showMessage('info', message);
                    postDispatch(data);

                } else {
                    if (data['error_code']) {
                        this.pageModel.showMessage('error', this.pageModel.translate(data['error_code'], data['error_args'] || {}));

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('defaultCorparch__failed_to_update_item'));
                    }
                }
                return this.pageModel.ajax<Array<common.CorplistItem>>(
                    'GET',
                    this.pageModel.createActionUrl('user/get_favorite_corpora'),
                    {},
                    {contentType : 'application/x-www-form-urlencoded'}
                );
            },
            (err) => {
                this.pageModel.showMessage('error', this.pageModel.translate('defaultCorparch__failed_to_update_item'));
                throw new Error(err);
            }
        ).then(
            (favItems:Array<common.CorplistItem>) => {
                if (favItems) {
                    if (!favItems['error']) {
                        this.favoriteItemsTab.reinit(favItems);

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('defaultCorparch__failed_to_fetch_fav'));
                    }
                }
            },
            (err) => {
                this.pageModel.showMessage('error', this.pageModel.translate('defaultCorparch__failed_to_fetch_fav'));
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
        const srch = this.querySetupHandler.getAvailableAlignedCorpora()
                .find(item => item.n === canonicalCorpusId);
        return srch ? srch.label : canonicalCorpusId;
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
                          aligned_corpora:Array<string>):common.CorplistItem {
        const self = this;
        if (corpus_id) {
            const ans:common.CorplistItem = common.createEmptyCorplistItem();
            ans.corpus_id = corpus_id; // TODO canonical vs. regular
            ans.canonical_id = corpus_id;

            if (subcorpus_id) {
                ans.type = common.CorplistItemType.SUBCORPUS;
                ans.subcorpus_id = subcorpus_id;
                ans.id = ans.corpus_id + ':' + ans.subcorpus_id;
                ans.name = this.pageModel.getConf('humanCorpname') + ':' + this.getCurrentSubcorpus();

            } else if (aligned_corpora.length > 0) {
                ans.type = common.CorplistItemType.ALIGNED_CORPORA;
                ans.id = [ans.corpus_id].concat(aligned_corpora).join('+');
                ans.name = this.pageModel.getConf('humanCorpname') + '+'
                    + aligned_corpora.map((item) => this.getAlignedCorpusName(item)).join('+');
                ans.corpora = aligned_corpora;

            } else {
                ans.type = common.CorplistItemType.CORPUS;
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
    extractItemFromPage(userItemFlag?:common.Favorite):common.CorplistItem {
        let subcorpName:string = null;
        const alignedCorpora:Array<string> = [];

        if (userItemFlag === undefined) {
            userItemFlag = common.Favorite.NOT_FAVORITE;
        }
        const corpName = this.pageModel.getConf<string>('corpname');
        if ($('#subcorp-selector').length > 0) {
            subcorpName = $('#subcorp-selector').val();
        }
        this.querySetupHandler.getCorpora().slice(1).forEach(item => {
            alignedCorpora.push(item);
        });

        const item:common.CorplistItem = this.inferItemCore(corpName, subcorpName, alignedCorpora);
        item.featured = userItemFlag;
        return item;
    }

    /**
     *
     */
    init():void {
        if (this.editable) {
            $(this.starImg).on('click', (e) => {
                if (!this.starSwitch.isStarred()) {
                    this.setFavorite(common.Favorite.FAVORITE);

                } else {
                    this.setFavorite(common.Favorite.NOT_FAVORITE);
                }
            });

            this.querySetupHandler.registerOnSubcorpChangeAction(this.onSubcorpChange);
            this.querySetupHandler.registerOnAddParallelCorpAction(this.onAlignedCorporaAdd);
            this.querySetupHandler.registerOnBeforeRemoveParallelCorpAction(this.onAlignedCorporaRemove);
            this.favoriteItemsTab.registerChangeListener(this.onFavTabListChange);
        }
        this.starSwitch.setStarState(this.favoriteItemsTab.containsItem(this.extractItemFromPage()));
    }
}


/**
 * Corplist widget class. In most situations it is easier
 * to instantiate this via an exported function create().
 */
export class Corplist implements CorparchCommon.Widget {

    selectElm:HTMLElement;

    jqWrapper:JQuery;

    triggerButton:HTMLElement;

    options:Options;

    widgetWrapper:HTMLElement;

    private pageModel:Kontext.PluginApi;

    private querySetupHandler:Kontext.QuerySetupHandler;

    private visible:Visibility;

    private widgetClass:string;

    private currCorpname:string;

    private currCorpIdent:string;

    private hiddenInput:HTMLElement;

    private parentForm:HTMLElement;

    private targetAction:string;

    private starImg:HTMLElement;

    private mainMenu:WidgetMenu;

    private starComponent:StarComponent;

    private searchBox:SearchTab;

    private favoritesBox:FavoritesTab;

    private footerElm:HTMLElement;

    onHide:(widget:Corplist)=>void;

    onShow:(widget:Corplist)=>void;

    private onSrchItemClick:CorplistItemClick;

    private onFavItemClick:CorplistItemClick;

    /**
     *
     * @param options
     */
    constructor(targetAction:string, parentForm:HTMLElement,
            pageModel:Kontext.PluginApi, querySetupHandler:Kontext.QuerySetupHandler,
            options:Options) {
        this.targetAction = targetAction;
        this.options = options;
        this.pageModel = pageModel;
        this.querySetupHandler = querySetupHandler;
        this.parentForm = parentForm;
        this.currCorpIdent = pageModel.getConf<string>('corpname');
        this.currCorpname = pageModel.getConf<string>('humanCorpname');
        this.visible = Visibility.HIDDEN;
        this.widgetClass = this.options.widgetClass ? this.options.widgetClass : 'corplist-widget';
        this.onHide = this.options.onHide ? this.options.onHide : null;
        this.onShow = this.options.onShow ? this.options.onShow : null;

        const defaultHandleClick = (item:common.CorplistItem) => {
            const form = $(this.parentForm);
            this.setCurrentValue(item.corpus_id, item.name);
            if (item.type === 'subcorpus') {
                form.find('select[name="usesubcorp"]').val(item.subcorpus_id);

            } else {
                form.find('select[name="usesubcorp"]').val('');
            }
            const corpnameElm = $(window.document.createElement('input'));
            corpnameElm
                .attr('type', 'hidden')
                .attr('name', 'corpname')
                .attr('value', item.corpus_id);
            form.append(corpnameElm);
            form
                .attr('action', this.pageModel.createActionUrl(this.targetAction))
                .attr('method', 'GET')
                .submit();
		};

        this.onSrchItemClick = (item:common.CorplistItem) => {
            if (this.options.itemClickAction) {
                this.options.itemClickAction.call(this, item);

            } else {
                defaultHandleClick.call(this, item);
            }
        };

        this.onFavItemClick = (item:common.CorplistItem) => {
            if (this.options.itemClickAction) {
                this.options.itemClickAction.call(this, item);

            } else {
                this.pageModel.getUserSettings().set('active_parallel_corpora', undefined);
                defaultHandleClick.call(this, item);
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
        $(window.document).bind('click', (event) => {
            this.switchComponentVisibility(Visibility.HIDDEN);
        });
        $(this.widgetWrapper).on('click', (e:Event) => {
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

    setButtonLoader():void {
        $(this.triggerButton)
            .empty()
            .append(`<img class="button-loader" src="${this.pageModel.createStaticUrl('img/ajax-loader-bar.gif')}"
                    alt="${this.pageModel.translate('global__loading')}" />`);
    }

    disableButtonLoader():void {
        $(this.triggerButton)
            .empty()
            .text(this.currCorpname);
    }

    /**
     *
     */
    private buildWidget() {
        const jqSelectBoxItem = $(this.selectElm);
        this.triggerButton = window.document.createElement('button');
        $(this.triggerButton)
            .attr('type', 'button')
            .addClass('util-button')
            .text(this.currCorpname);
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
        this.mainMenu = new WidgetMenu(this, this.pageModel);

        // search func
        this.searchBox = new SearchTab(this.pageModel, this.jqWrapper.get(0), this.onSrchItemClick);
        this.searchBox.init();

        // favorites and featured
        const pluginData = this.pageModel.getConf<any>('pluginData')['corparch'] || {};
        const favData:Array<common.CorplistItem> = pluginData['favorite'] || [];
        const featData = pluginData['featured'] || [];
        this.favoritesBox = new FavoritesTab(
            this.targetAction,
            this.pageModel,
            this.widgetWrapper,
            favData,
            featData,
            this.onFavItemClick,
            this.options.favoriteItemsFilter
        );
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
            this.starComponent = new StarComponent(
                this.favoritesBox,
                this.pageModel,
                this.querySetupHandler,
                this.options.editable !== undefined ? this.options.editable : true
            );
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

    getCorpusSwitchAwareObjects():Array<Kontext.ICorpusSwitchAware<any>> {
        return [this.favoritesBox];
    }
}