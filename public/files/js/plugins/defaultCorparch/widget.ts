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

import {Kontext} from '../../types/common';
import * as common from './common';
import {IPluginApi, PluginInterfaces} from '../../types/plugins';
import {StatefulModel} from '../../models/base';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import * as Immutable from 'immutable';
import {SearchEngine, SearchKeyword, SearchResultRow} from './search';
import RSVP from 'rsvp';

/**
 *
 */
export interface Options  {

    /**
     * Handles click on favorite/featured/searched item.
     *
     * Using custom action disables implicit form submission (or location.href update)
     * which means formTarget and submitMethod options have no effect unless you use
     * them directly in some way.
     */
    itemClickAction?:Kontext.CorplistItemClick;
}


/**
 *
 */
export class CorplistWidgetModel extends StatefulModel {

    private pluginApi:IPluginApi;

    private corpusIdent:Kontext.FullCorpusIdent;

    private dataFav:Immutable.List<common.ServerFavlistItem>;

    private dataFeat:Immutable.List<common.CorplistItem>;

    private onItemClick:Kontext.CorplistItemClick;

    private isWaitingToSwitch:boolean;

    private currFavitemId:string;

    private anonymousUser:boolean;

    private corpSelection:PluginInterfaces.Corparch.ICorpSelection;

    private searchEngine:SearchEngine;

    private inputThrottleTimer:number;

    private isWaitingForSearchResults:boolean;

    private currSearchResult:Immutable.List<SearchResultRow>;

    private currSearchPhrase:string;

    private currentSubcorp:string;

    private origSubcorpName:string;

    private static MIN_SEARCH_PHRASE_ACTIVATION_LENGTH = 3;

    constructor(
            dispatcher:ActionDispatcher,
            pluginApi:IPluginApi,
            corpusIdent:Kontext.FullCorpusIdent,
            corpSelection:PluginInterfaces.Corparch.ICorpSelection,
            anonymousUser:boolean,
            searchEngine:SearchEngine, dataFav:Array<common.ServerFavlistItem>,
            dataFeat:Array<common.CorplistItem>,
            onItemClick:Kontext.CorplistItemClick) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this.corpusIdent = corpusIdent;
        this.corpSelection = corpSelection;
        this.currentSubcorp = corpSelection.getCurrentSubcorpus();
        this.origSubcorpName = corpSelection.getOrigSubcorpName();
        this.anonymousUser = anonymousUser;
        this.dataFav = Immutable.List<common.ServerFavlistItem>(dataFav);
        this.dataFeat = Immutable.List<common.CorplistItem>(dataFeat);
        this.isWaitingToSwitch = false;
        this.currFavitemId = this.findCurrFavitemId(this.extractItemFromPage());
        this.onItemClick = onItemClick;
        this.searchEngine = searchEngine;
        this.isWaitingForSearchResults = false;
        this.currSearchPhrase = '';
        this.currSearchResult = Immutable.List<SearchResultRow>();

        dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'DEFAULT_CORPARCH_FAV_ITEM_CLICK':
                    this.isWaitingToSwitch = true;
                    this.notifyChangeListeners();
                    this.handleFavItemClick(payload.props['itemId']).then(
                        () => {
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.isWaitingToSwitch = false;
                            this.pluginApi.showMessage('error', err);
                            this.notifyChangeListeners();
                        }
                    );
                break;
                case 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK':
                    this.isWaitingToSwitch = true;
                    this.notifyChangeListeners();
                    this.handleFeatItemClick(payload.props['itemId']).then(
                        () => {
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.isWaitingToSwitch = false;
                            this.pluginApi.showMessage('error', err);
                            this.notifyChangeListeners();
                        }
                    );
                break;
                case 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED':
                    this.isWaitingToSwitch = true;
                    this.notifyChangeListeners();
                    this.handleSearchItemClick(payload.props['itemId']).then(
                        () => {
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.isWaitingToSwitch = false;
                            this.pluginApi.showMessage('error', err);
                            this.notifyChangeListeners();
                        }
                    );
                break;
                case 'DEFAULT_CORPARCH_FAV_ITEM_REMOVE':
                    this.removeFavItem(payload.props['itemId']).then(
                        (data) => {
                            this.currFavitemId = this.findCurrFavitemId(this.extractItemFromPage());
                            this.pluginApi.showMessage('info', this.pluginApi.translate('defaultCorparch__item_removed_from_fav'));
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.pluginApi.showMessage('error', this.pluginApi.translate('defaultCorparch__failed_to_remove_fav'));
                            this.notifyChangeListeners();
                        }
                    );
                break;
                case 'DEFAULT_CORPARCH_STAR_ICON_CLICK':
                    (() => {
                        if (payload.props['status']) {
                            return this.setFavItem();

                        } else {
                            return this.unsetFavItem(payload.props['itemId']);
                        }
                    })().then(
                        () => {
                            this.currFavitemId = this.findCurrFavitemId(this.extractItemFromPage());
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.pluginApi.showMessage('error', err);
                            this.currFavitemId = this.findCurrFavitemId(this.extractItemFromPage());
                            this.notifyChangeListeners();
                        }
                    );
                break;
                case 'DEFAULT_CORPARCH_KEYWORD_RESET_CLICKED':
                    this.resetKeywordSelectStatus();
                    this.notifyChangeListeners();
                    this.searchDelayed();
                break;
                case 'DEFAULT_CORPARCH_KEYWORD_CLICKED':
                    this.setKeywordSelectedStatus(
                        payload.props['keywordId'], payload.props['status'], payload.props['exclusive']);
                    this.notifyChangeListeners();
                    this.searchDelayed();
                break;
                case 'DEFAULT_CORPARCH_SEARCH_INPUT_CHANGED':
                    this.currSearchPhrase = payload.props['value'];
                    this.currSearchResult = Immutable.List<SearchResultRow>();
                    this.notifyChangeListeners();
                    this.searchDelayed();
                break;
                case 'QUERY_INPUT_SELECT_SUBCORP':
                    if (payload.props['pubName']) {
                        this.currentSubcorp = payload.props['pubName'];
                        this.origSubcorpName = payload.props['subcorp'];

                    } else {
                        this.currentSubcorp = payload.props['subcorp'];
                        this.origSubcorpName = payload.props['subcorp'];
                    }
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    initHandlers():void {
        this.searchEngine.addOnDone(() => {
            this.isWaitingForSearchResults = false;
            this.notifyChangeListeners();
        });

        this.searchEngine.addOnWaiting(() => {
            this.isWaitingForSearchResults = true;
            this.notifyChangeListeners();
        });
    }

    private searchDelayed():void {
        this.currSearchResult = Immutable.List<SearchResultRow>();
        if (this.inputThrottleTimer) {
            window.clearTimeout(this.inputThrottleTimer);
        }
        if (this.currSearchPhrase.length >= CorplistWidgetModel.MIN_SEARCH_PHRASE_ACTIVATION_LENGTH ||
                this.searchEngine.hasSelectedKeywords()) {
            this.inputThrottleTimer = window.setTimeout(() => {
                this.searchCorpus(this.currSearchPhrase).then(
                    () => {
                        this.notifyChangeListeners();
                    },
                    (err) => {
                        this.pluginApi.showMessage('error', err);
                    }
                );
            }, 350);
        }
    }

    /**
     * Finds a matching favorite item based on currently selected
     * corpora and subcorpus.
     *
     * @param item
     * @returns an ID if the current item is set as favorite else undefined
     */
    private findCurrFavitemId(item:common.GeneratedFavListItem):string {
        const normalize = (v:string) => v ? v : '';
        const srch = this.dataFav.find(x => {
                return normalize(x.subcorpus_id) === normalize(item.subcorpus_id) &&
                    item.corpora.join('') === x.corpora.map(x => x.id).join('');
        });
        return srch ? srch.id : undefined;
    }

    private handleFavItemClick(itemId:string):RSVP.Promise<any> {
        const item = this.dataFav.find(item => item.id === itemId);
        return (() => {
            if (item !== undefined) {
                return this.onItemClick(item.corpora.map(x => x.id), item.subcorpus_id);

            } else {
                return new RSVP.Promise((resolve:(v)=>void, reject:(err)=>void) => {
                    reject(new Error(`Favorite item ${itemId} not found`));
                });
            }
        })();
    }

    private handleFeatItemClick(itemId:string):RSVP.Promise<any> {
        const item = this.dataFeat.find(item => item.id === itemId);
        return (() => {
            if (item !== undefined) {
                return this.onItemClick([item.corpus_id], item.subcorpus_id);

            } else {
                return new RSVP.Promise((resolve:(v)=>void, reject:(err)=>void) => {
                    reject(new Error(`Featured item ${itemId} not found`));
                });
            }
        })();
    }

    private handleSearchItemClick(itemId:string):RSVP.Promise<any> {
        const item = this.currSearchResult.find(item => item.id === itemId);
        return (() => {
            if (item !== undefined) {
                return this.onItemClick([item.id], '');

            } else {
                return new RSVP.Promise((resolve:(v)=>void, reject:(err)=>void) => {
                    reject(new Error(`Clicked item ${itemId} not found in search results`));
                });
            }
        })();
    }

    private getAlignedCorpusName(corpusId:string):string {
        const srch = this.corpSelection.getAvailableAlignedCorpora()
                .find(item => item.n === corpusId);
        return srch ? srch.label : corpusId;
    }

    /**
     * According to the state of the current query form, this method creates
     * a new CorplistItem instance with proper type, id, etc.
     */
    private extractItemFromPage():common.GeneratedFavListItem {
        return {
            subcorpus_id: this.corpSelection.getCurrentSubcorpus(),
            corpora: this.corpSelection.getCorpora().toArray()
        };
    }

    private removeFavItem(itemId:string):RSVP.Promise<any> {
        return this.pluginApi.ajax<Kontext.AjaxResponse>(
            'POST',
            this.pluginApi.createActionUrl('user/unset_favorite_item'),
            {id: itemId}

        ).then(
            (data) => {
                return this.pluginApi.ajax<Array<common.CorplistItem>>(
                    'GET',
                    this.pluginApi.createActionUrl('user/get_favorite_corpora'),
                    {},
                    {contentType : 'application/x-www-form-urlencoded'}
                );
            }

        ).then(
            (favItems:any) => { // TODO (indirect) fix d.ts types of ajax()
                const items = <Array<common.CorplistItem>>favItems;
                this.dataFav = Immutable.List<common.ServerFavlistItem>(favItems);
            }
        );
    }

    private reloadItems(editAction:RSVP.Promise<any>, message:string):RSVP.Promise<any> {
        return editAction.then<Array<common.CorplistItem>>(
            (data:Kontext.AjaxResponse) => {
                this.pluginApi.showMessage('info', message);
                return this.pluginApi.ajax<Array<common.CorplistItem>>(
                    'GET',
                    this.pluginApi.createActionUrl('user/get_favorite_corpora'),
                    {}
                );
            }
        ).then(
            (favItems:any) => {
                const items = <Array<common.CorplistItem>>favItems;
                this.dataFav = Immutable.List<common.ServerFavlistItem>(favItems);
            }
        );
    }

    private setFavItem():RSVP.Promise<any> {
        const message = this.pluginApi.translate('defaultCorparch__item_added_to_fav');
        const newItem = this.extractItemFromPage();
        return this.reloadItems(this.pluginApi.ajax(
            'POST',
            this.pluginApi.createActionUrl('user/set_favorite_item'),
            newItem
        ), message);
    }

    private unsetFavItem(id:string):RSVP.Promise<any> {
        const message = this.pluginApi.translate('defaultCorparch__item_removed_from_fav');
        return this.reloadItems(this.pluginApi.ajax(
            'POST',
            this.pluginApi.createActionUrl('user/unset_favorite_item'),
            {id: id}
        ), message);
    }

    getCorpusIdent():Kontext.FullCorpusIdent {
        return this.corpusIdent;
    }

    getCurrentSubcorp():string {
        return this.currentSubcorp;
    }

    getOrigSubcorpName():string {
        return this.origSubcorpName;
    }

    getDataFav():Immutable.List<common.ServerFavlistItem> {
        return this.dataFav;
    }

    getDataFeat():Immutable.List<common.CorplistItem> {
        return this.dataFeat;
    }

    getIsWaitingToSwitch():boolean {
        return this.isWaitingToSwitch;
    }

    getCurrFavitemId():string {
        return this.currFavitemId;
    }

    getIsAnonymousUser():boolean {
        return this.anonymousUser;
    }

    getAvailKeywords():Immutable.List<SearchKeyword> {
        return this.searchEngine.getAvailKeywords();
    }

    setKeywordSelectedStatus(id:string, status:boolean, exclusive:boolean):void {
        return this.searchEngine.setKeywordSelectedStatus(id, status, exclusive);
    }

    resetKeywordSelectStatus():void {
        return this.searchEngine.resetKeywordSelectStatus();
    }

    searchCorpus(phrase:string):RSVP.Promise<boolean> {
        this.currSearchPhrase = phrase;
        return this.searchEngine.search(phrase).then(
            (data) => {
                this.currSearchResult = data;
                return true;
            }
        )
    }

    getIsWaitingForSearchResults():boolean {
        return this.isWaitingForSearchResults;
    }

    getcurrSearchResult():Immutable.List<SearchResultRow> {
        return this.currSearchResult;
    }

    getCurrSearchPhrase():string {
        return this.currSearchPhrase;
    }

    getHasSelectedKeywords():boolean {
        return this.searchEngine.hasSelectedKeywords();
    }
}
