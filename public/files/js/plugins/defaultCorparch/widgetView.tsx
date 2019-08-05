/*
 * Copyright (c) 2017 Institute of the Czech National Corpus
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

import * as React from 'react';
import * as Immutable from 'immutable';
import {Kontext, KeyCodes} from '../../types/common';
import { CorplistWidgetModel, FavListItem, CorplistWidgetModelState } from './widget';
import { CorplistItem } from './common';
import { SearchKeyword, SearchResultRow } from './search';
import { PluginInterfaces } from '../../types/plugins';
import { IActionDispatcher } from 'kombo';
import { Subscription } from 'rxjs';


export interface WidgetViewModuleArgs {
    dispatcher:IActionDispatcher;
    util:Kontext.ComponentHelpers;
    widgetModel:CorplistWidgetModel;
    corpusSelection:PluginInterfaces.Corparch.ICorpSelection;
}

export interface CorplistWidgetProps {

}

export interface WidgetViews {

}


export function init({dispatcher, util, widgetModel, corpusSelection}:WidgetViewModuleArgs):React.ComponentClass<CorplistWidgetProps> {

    const layoutViews = util.getLayoutViews();

    // ----------------------- <FavStar /> --------------------------------------

    const FavStar:React.SFC<{
        ident:string;
        trashTTL:number;

    }> = (props) => {

        const handleRemoveClick = () => {
            dispatcher.dispatch({
                name: props.trashTTL === null ?
                        'DEFAULT_CORPARCH_FAV_ITEM_REMOVE' :
                        'DEFAULT_CORPARCH_FAV_ITEM_ADD',
                payload: {
                    itemId: props.ident
                }
            });
        };

        return (
            <a onClick={handleRemoveClick}>
                {props.trashTTL === null ?
                    <img className="starred" src={util.createStaticUrl('img/starred.svg')}
                            alt={util.translate('defaultCorparch__click_to_remove_item_from_fav')}
                            title={util.translate('defaultCorparch__click_to_remove_item_from_fav')} /> :
                    <img className="starred" src={util.createStaticUrl('img/starred_grey.svg')}
                            alt={util.translate('defaultCorparch__not_in_fav')}
                            title={util.translate('defaultCorparch__not_in_fav')} />
                }
            </a>
        );
    };

    // -------------------------- <TRFavoriteItem /> ----------------------------------

    const TRFavoriteItem:React.SFC<{
        data:FavListItem;
        isActive:boolean;

    }> = (props) => {

        const handleItemClick = () => {
            dispatcher.dispatch({
                name: 'DEFAULT_CORPARCH_FAV_ITEM_CLICK',
                payload: {
                    itemId: props.data.id
                }
            });
        };

        const htmlClasses = ['data-item'];
        if (props.isActive) {
            htmlClasses.push('active');
        }
        if (props.data.trashTTL !== null) {
            htmlClasses.push('in-trash')
        }

        return (
            <tr className={htmlClasses.join(' ')}>
                <td>
                    <a className="corplist-item"
                            title={props.data.trashTTL === null ?
                                        props.data.description :
                                        util.translate('defaultCorparch__item_will_be_removed')}
                            onClick={handleItemClick}>
                        {props.data.name}
                    </a>
                </td>
                <td className="num">
                    {props.data.size_info}
                </td>
                <td className="tools">
                    <FavStar ident={props.data.id} trashTTL={props.data.trashTTL} />
                </td>
            </tr>
        );
    }

    // -------------------------- <FavoritesBox /> ---------------------

    const FavoritesBox:React.SFC<{
        data:Immutable.List<FavListItem>;
        anonymousUser:boolean;
        activeIdx:number;

    }> = (props) => {

        return (
            <table className="favorite-list">
                <tbody>
                    <tr>
                        <th>
                            {util.translate('defaultCorparch__fav_items')}
                        </th>
                        <th />
                        <th />
                    </tr>
                    {props.anonymousUser ?
                        <tr>
                            <td colSpan={3}>{util.translate('defaultCorparch__please_log_in_to_see_fav')}</td>
                        </tr> :
                        props.data.map((item, i) =>
                            <TRFavoriteItem key={item.id} data={item} isActive={i === props.activeIdx} />)
                    }
                </tbody>
            </table>
        );
    };

    // --------------------------- <TRFeaturedItem /> --------------------------------

    const TRFeaturedItem:React.SFC<{
        data:CorplistItem;
        isActive:boolean;

    }> = (props) => {

        const handleItemClick = () => {
            dispatcher.dispatch({
                name: 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK',
                payload: {
                    itemId: props.data.id
                }
            });
        };


        return (
            <tr className={`data-item${props.isActive ? ' active' : ''}`}>
                <td>
                    <a className="featured-item" title={props.data.description}
                            onClick={handleItemClick}>
                        {props.data.name}
                    </a>
                </td>
                <td className="num">
                    {props.data.size_info}
                </td>
            </tr>
        );
    };

    // ---------------------------------- <FeaturedBox /> --------------------------------

    const FeaturedBox:React.SFC<{
        data:Immutable.List<CorplistItem>;
        activeIdx:number;

    }> = (props) => {
        return (
            <table className="featured-list">
                <tbody>
                    <tr>
                        <th colSpan={2}>
                            {util.translate('defaultCorparch__featured_corpora')}
                        </th>
                    </tr>
                    {props.data.map((item, i) =>
                            <TRFeaturedItem key={item.id} data={item}
                                    isActive={i === props.activeIdx} />)}
                </tbody>
            </table>
        );
    }

    // ------------------------- <StarComponent /> ------------------------

    const StarComponent:React.SFC<{
        currFavitemId:string;

    }> = (props) => {

        const renderIcon = () => {
            const style = {width: '1.6em'};
            if (props.currFavitemId) {
                return <img src={util.createStaticUrl('img/starred.svg')}
                        title={util.translate('defaultCorparch__in_fav')}
                        alt={util.translate('defaultCorparch__in_fav')}
                        style={style} />;

            } else {
                return <img src={util.createStaticUrl('img/starred_grey.svg')}
                        title={util.translate('defaultCorparch__not_in_fav')}
                        alt={util.translate('defaultCorparch__not_in_fav')}
                        style={style} />;
            }
        };

        const handleStarClick = () => {
            dispatcher.dispatch({
                name: 'DEFAULT_CORPARCH_STAR_ICON_CLICK',
                payload: {
                    status: props.currFavitemId ? false : true,
                    itemId: props.currFavitemId
                }
            });
        };

        return (
            <a onClick={handleStarClick} className="star-switch">
                {renderIcon()}
            </a>
        );
    };

    // --------------------------- <TabMenu /> ------------------------------

    const TabMenu:React.SFC<{
        activeTab:number;
        onItemClick:(v:number)=>void;
        onEscKey:()=>void;

    }> = (props) => {

        const clickHandler = (tabIdx:number) => (evt:React.MouseEvent) => {
            props.onItemClick(tabIdx);
            evt.stopPropagation();
            evt.preventDefault();
        };

        return (
            <div className="menu">
                <span>
                    <a data-func="my-corpora" className={props.activeTab === 0 ? 'current' : null}
                            onClick={clickHandler(0)}>
                        {util.translate('defaultCorparch__my_list')}
                    </a>
                    {'\u00a0|\u00a0'}
                    <a data-func="search" className={props.activeTab === 1 ? 'current' : null}
                            onClick={clickHandler(1)}>
                        {util.translate('defaultCorparch__other_corpora')}
                    </a>
                </span>
            </div>
        );
    };

    // ----------------------------- <ListsTab /> -------------------------------

    const ListsTab:React.SFC<{
        dataFav:Immutable.List<FavListItem>;
        dataFeat:Immutable.List<CorplistItem>;
        anonymousUser:boolean;
        activeListItem:[number, number];

    }> = (props) => {

        const handleKeyDown = (evt:React.KeyboardEvent) => {
            const argMap = {
                [KeyCodes.DOWN_ARROW]: [0, 1],
                [KeyCodes.UP_ARROW]: [0, -1],
                [KeyCodes.LEFT_ARROW]: [-1, 0],
                [KeyCodes.RIGHT_ARROW]: [1, 0]
            };
            switch (evt.keyCode) {
                case KeyCodes.DOWN_ARROW:
                case KeyCodes.UP_ARROW:
                case KeyCodes.LEFT_ARROW:
                case KeyCodes.RIGHT_ARROW:
                    dispatcher.dispatch({
                        name: 'DEFAULT_CORPARCH_MOVE_FOCUS_TO_NEXT_LISTITEM',
                        payload: {
                            change: argMap[evt.keyCode]
                        }
                    });
                    evt.preventDefault();
                    evt.stopPropagation();
                break;
                case KeyCodes.ENTER:
                    dispatcher.dispatch({
                        name: 'DEFAULT_CORPARCH_ENTER_ON_ACTIVE_LISTITEM',
                        payload: {}
                    });
                    evt.preventDefault();
                    evt.stopPropagation();
                break;
            }
        };

        return (
            <div className="tables" onKeyDown={handleKeyDown}
                    tabIndex={-1} ref={item => item ? item.focus() : null}>
                <FavoritesBox data={props.dataFav}
                        anonymousUser={props.anonymousUser}
                        activeIdx={props.activeListItem[0] === 0 ? props.activeListItem[1] : null} />
                <FeaturedBox data={props.dataFeat}
                        activeIdx={props.activeListItem[0] === 1 ? props.activeListItem[1] : null} />
            </div>
        );
    };

    // -------------------------- <SearchKeyword /> ---------------------

    const SearchKeyword:React.SFC<{
        key:string;
        id:string;
        label:string;
        color:string;
        selected:boolean;

    }> = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch({
                name: 'DEFAULT_CORPARCH_KEYWORD_CLICKED',
                payload: {
                    keywordId: props.id,
                    status: !props.selected,
                    exclusive: !evt.ctrlKey
                }
            });
        };

        const htmlClass = ['keyword'];
        if (props.selected) {
            htmlClass.push('selected');
        }
        const style = {
            backgroundColor: props.color,
            borderColor: props.color
        };

        return (
            <a className={htmlClass.join(' ')} onClick={handleClick}>
                <span className="overlay" style={style}>
                    {props.label}
                </span>
            </a>
        );
    };

   // ----------------------------- <ResetKeyword /> ----------------------------------

    const ResetKeyword:React.SFC<{}> = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch({
                name: 'DEFAULT_CORPARCH_KEYWORD_RESET_CLICKED',
                payload: {}
            });
        };

        return (
            <a className="keyword reset" onClick={handleClick}>
                <span className="overlay">
                    {util.translate('defaultCorparch__no_keyword')}
                </span>
            </a>
        );
    };

    // ------------------------- <SearchInput /> ---------------------------------------

    const SearchInput:React.SFC<{
        value:string;
        handleTab:()=>void;

    }> = (props) => {

        const handleInput = (evt) => {
            dispatcher.dispatch({
                name: 'DEFAULT_CORPARCH_SEARCH_INPUT_CHANGED',
                payload: {
                    value: evt.target.value
                }
            });
        };

        const handleKeyDown = (evt) => {

            switch (evt.keyCode) {
                case KeyCodes.DOWN_ARROW:
                case KeyCodes.UP_ARROW:
                    dispatcher.dispatch({
                        name: 'DEFAULT_CORPARCH_FOCUS_SEARCH_ROW',
                        payload: {
                            inc: evt.keyCode === KeyCodes.DOWN_ARROW ? 1 : -1
                        }
                    });
                    evt.stopPropagation();
                    evt.preventDefault();
                break;
                case KeyCodes.ENTER:
                    dispatcher.dispatch({
                        name: 'DEFAULT_CORPARCH_FOCUSED_ITEM_SELECT',
                        payload: {}
                    });
                    evt.stopPropagation();
                    evt.preventDefault();
                break;
                case KeyCodes.TAB:
                    props.handleTab();
                    evt.stopPropagation();
                break;
            }
        };

        return <input type="text" className="tt-input"
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    value={props.value}
                    placeholder={util.translate('defaultCorparch__name_or_description')}
                    ref={item => item ? item.focus() : null} />;
    };

    // ------------------------- <SearchResultRow /> ------------------------

    const SearchResultRow:React.SFC<{
        data:SearchResultRow;
        hasFocus:boolean;

    }> = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch({
                name: 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED',
                payload: {
                    itemId: props.data.id
                }
            });
            evt.stopPropagation();
            evt.preventDefault();
        };

        return (
            <p className={`tt-suggestion${props.hasFocus ? ' focus' : ''}`}>
                <a onClick={handleClick}>
                    {props.data.name}
                </a>
                {'\u00a0'}
                <span className="num">
                    {props.data.size_info}
                </span>
                {
                    props.data.found_in.length > 0 ?
                        <span className="found-in">,{'\u00a0'}
                            {props.data.found_in.map(foundIn => util.translate(foundIn))}
                        </span>
                    : null
                }
            </p>
        );
    };

    // ---------------------------- <SearchLoaderBar /> --------------------------

    const SearchLoaderBar:React.SFC<{
        isActive:boolean;

    }> = (props) => {
        if (props.isActive) {
            return (
                <div className="ajax-loader">
                    <img src={util.createStaticUrl('img/ajax-loader-bar.gif')}
                                alt={util.translate('global__processing')} />
                </div>
            );

        } else {
            return null;
        }
    };

    // ---------------------------- <SearchTab /> -----------------------------------

    const SearchTab:React.SFC<{
        availSearchKeywords:Immutable.List<SearchKeyword>;
        isWaitingForSearchResults:boolean;
        currSearchResult:Immutable.List<SearchResultRow>;
        currSearchPhrase:string;
        hasSelectedKeywords:boolean;
        focusedRowIdx:number;
        handleTab:()=>void;

    }> = (props) => {
        return (
            <div>
                <div className="labels">
                    {props.availSearchKeywords.map(item => <SearchKeyword key={item.id} {...item} />)}
                    {props.hasSelectedKeywords ? <ResetKeyword /> : null}
                    <div className="labels-hint">
                        {util.translate('defaultCorparch__hold_ctrl_for_multiple')}
                    </div>
                </div>
                <div className="autocomplete-wrapper">
                    <SearchInput value={props.currSearchPhrase} handleTab={props.handleTab} />
                    <SearchLoaderBar isActive={props.isWaitingForSearchResults} />
                    {props.currSearchResult.size > 0 ?
                        (<div className="tt-menu">
                            {props.currSearchResult.map((item, i) =>
                                    <SearchResultRow key={item.id} data={item}
                                            hasFocus={i === props.focusedRowIdx} />)}
                        </div>) : null}
                </div>
            </div>
        );
    };

    // ----------------------------- <CorpusButton /> --------------------------

    const CorpusButton:React.SFC<{
        isWaitingToSwitch:boolean;
        corpusIdent:Kontext.FullCorpusIdent;
        isWidgetVisible:boolean;
        onClick:()=>void;

    }> = (props) => {

        const handleKeyDown = (evt:React.KeyboardEvent) => {
            if (evt.keyCode === KeyCodes.ENTER || evt.keyCode === KeyCodes.ESC) {
                props.onClick();
                evt.stopPropagation();
                evt.preventDefault();
            }
        };

        return (
            <button type="button"
                    className={`util-button${props.isWaitingToSwitch ? ' waiting': ''}`}
                    onClick={props.onClick} onKeyDown={handleKeyDown}>
                {props.isWaitingToSwitch ? <layoutViews.AjaxLoaderBarImage htmlClass="loader" /> : null }
                <span className="corpus-name" title={props.corpusIdent.id}>{props.corpusIdent.name}</span>
            </button>
        );
    };

    // ------------------------------- <SubcorpSelection /> -----------------------------

    const SubcorpSelection:React.SFC<{
        currSubcorpus:string;
        origSubcorpName:string;
        availSubcorpora:Immutable.List<Kontext.SubcorpListItem>;

    }> = (props) => {

        const handleSubcorpChange = (evt) => {
            dispatcher.dispatch({
                name: 'QUERY_INPUT_SELECT_SUBCORP',
                payload: {
                    subcorp: props.availSubcorpora.get(evt.target.value).v,
                    pubName: props.availSubcorpora.get(evt.target.value).pub,
                    foreign: props.availSubcorpora.get(evt.target.value).foreign
                }
            });
        };

        const selItemIdx = () => {
            const orig = props.origSubcorpName && props.currSubcorpus !== props.origSubcorpName ?
                props.origSubcorpName :
                props.currSubcorpus;
            return props.availSubcorpora.findIndex(v => v.v === orig);
        };
        return (
            <span id="subcorp-selector-wrapper">
                <select id="subcorp-selector" name="usesubcorp" value={selItemIdx()}
                        onChange={handleSubcorpChange}>
                    {props.availSubcorpora.map((item, i) => {
                        return <option key={item.v} value={i}>{item.n}</option>;
                    })}
                </select>
            </span>
        )
    };

    // ------------------------- <CorplistWidget /> -------------------------------

    class CorplistWidget extends React.Component<CorplistWidgetProps, CorplistWidgetModelState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = widgetModel.getState();
            this._handleCloseClick = this._handleCloseClick.bind(this);
            this._handleTabSwitch = this._handleTabSwitch.bind(this);
            this._handleModelChange = this._handleModelChange.bind(this);
            this._handleOnShow = this._handleOnShow.bind(this);
            this._handleKeypress = this._handleKeypress.bind(this);
            this._handleWidgetButtonClick = this._handleWidgetButtonClick.bind(this);
            this._handleAreaClick = this._handleAreaClick.bind(this);
        }

        _handleKeypress(evt) {
            if (this.state.isVisible) {
                switch (evt.keyCode) {
                    case KeyCodes.TAB:
                        this._handleTabSwitch(1 - this.state.activeTab);
                        evt.preventDefault();
                        evt.stopPropagation();
                    break;
                    case KeyCodes.ESC:
                        this._handleCloseClick();
                        evt.preventDefault();
                        evt.stopPropagation();
                    break;
                }
            }
        }

        _handleOnShow() {
            dispatcher.dispatch({
                name: 'DEFAULT_CORPARCH_WIDGET_SHOW',
                payload: {}
            });
        }

        _handleCloseClick() {
            dispatcher.dispatch({
                name: 'DEFAULT_CORPARCH_WIDGET_HIDE',
                payload: {}
            });
        }

        _handleWidgetButtonClick() {
            if (this.state.isVisible) {
                this._handleCloseClick();

            } else {
                this._handleOnShow();
            }
        }

        _handleTabSwitch(v) {
            dispatcher.dispatch({
                name: 'DEFAULT_CORPARCH_SET_ACTIVE_TAB',
                payload: {
                    value: v
                }
            });
        }

        _handleAreaClick() {
            dispatcher.dispatch({
                name: 'DEFAULT_CORPARCH_SET_ACTIVE_TAB',
                payload: {
                    value: this.state.activeTab
                }
            });
        }

        _handleModelChange(state:CorplistWidgetModelState) {
            this.setState(state);
        }

        componentDidMount() {
            this.modelSubscription = widgetModel.addListener(this._handleModelChange);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        _renderWidget() {
            return (
                <layoutViews.PopupBox customClass="corplist-widget"
                        onCloseClick={this._handleCloseClick}
                        onAreaClick={this._handleAreaClick}
                        keyPressHandler={this._handleKeypress}>
                    <TabMenu onItemClick={this._handleTabSwitch} activeTab={this.state.activeTab}
                                onEscKey={this._handleCloseClick} />
                    {this.state.activeTab === 0 ?
                        <ListsTab dataFav={this.state.dataFav} dataFeat={this.state.dataFeat}
                                anonymousUser={this.state.anonymousUser}
                                activeListItem={this.state.activeListItem} /> :
                        <SearchTab availSearchKeywords={this.state.availSearchKeywords}
                                isWaitingForSearchResults={this.state.isWaitingForSearchResults}
                                currSearchResult={this.state.currSearchResult}
                                currSearchPhrase={this.state.currSearchPhrase}
                                hasSelectedKeywords={this.state.availSearchKeywords.find(x => x.selected) !== undefined}
                                focusedRowIdx={this.state.focusedRowIdx}
                                handleTab={this._handleCloseClick} />
                    }
                    <div className="footer">
                        <span>
                            {this.state.activeTab === 0 ?
                                util.translate('defaultCorparch__hit_tab_to_see_other') :
                                util.translate('defaultCorparch__hit_tab_to_see_fav')}
                        </span>
                    </div>
                </layoutViews.PopupBox>
            );
        }

        render() {
            return (
                <div className="CorplistWidget">
                    <div>
                        <CorpusButton isWaitingToSwitch={this.state.isBusy}
                                corpusIdent={this.state.corpusIdent} onClick={this._handleWidgetButtonClick}
                                isWidgetVisible={this.state.isVisible} />
                        {this.state.isVisible ? this._renderWidget() : null}
                        {this.state.availableSubcorpora.size > 0 ?
                            (<span>
                                <strong className="subc-separator">{'\u00a0/\u00a0'}</strong>
                                <SubcorpSelection currSubcorpus={this.state.currSubcorpus}
                                    origSubcorpName={this.state.origSubcorpName}
                                    availSubcorpora={this.state.availableSubcorpora} />
                            </span>) :
                            null
                        }
                        {!this.state.anonymousUser ?
                            <StarComponent currFavitemId={this.state.currFavitemId} /> :
                            null
                        }
                    </div>
                </div>
            );
        }
    }


    return CorplistWidget;

}