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
import {ActionDispatcher} from '../../app/dispatcher';
import {Kontext} from '../../types/common';
import { CorplistWidgetModel, FavListItem, CorplistWidgetModelState } from './widget';
import { CorplistItem } from './common';
import { SearchKeyword, SearchResultRow } from './search';
import { PluginInterfaces } from '../../types/plugins';


export interface WidgetViewModuleArgs {
    dispatcher:ActionDispatcher;
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

    const FavStar:React.SFC<{
        ident:string;
        trashTTL:number;

    }> = (props) => {

        const handleRemoveClick = () => {
            dispatcher.dispatch({
                actionType: props.trashTTL === null ?
                        'DEFAULT_CORPARCH_FAV_ITEM_REMOVE' :
                        'DEFAULT_CORPARCH_FAV_ITEM_ADD',
                props: {
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

    /**
     *
     */
    const TRFavoriteItem:React.SFC<{
        data:FavListItem;

    }> = (props) => {

        const handleItemClick = () => {
            dispatcher.dispatch({
                actionType: 'DEFAULT_CORPARCH_FAV_ITEM_CLICK',
                props: {
                    itemId: props.data.id
                }
            });
        };

        return (
            <tr className={`data-item${props.data.trashTTL !== null ? ' in-trash' : null}`}>
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

    /**
     *
     * @param {*} props
     */
    const FavoritesBox:React.SFC<{
        data:Immutable.List<FavListItem>;
        anonymousUser:boolean;

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
                        props.data.map(item => <TRFavoriteItem key={item.id} data={item} />)
                    }
                </tbody>
            </table>
        );
    };

    /**
     *
     */
    const TRFeaturedItem:React.SFC<{
        data:CorplistItem;

    }> = (props) => {

        const handleItemClick = () => {
            dispatcher.dispatch({
                actionType: 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK',
                props: {
                    itemId: props.data.id
                }
            });
        };


        return (
            <tr className="data-item">
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

    /**
     *
     */
    const FeaturedBox:React.SFC<{
        data:Immutable.List<CorplistItem>;

    }> = (props) => {
        return (
            <table className="featured-list">
                <tbody>
                    <tr>
                        <th colSpan={2}>
                            {util.translate('defaultCorparch__featured_corpora')}
                        </th>
                    </tr>
                    {props.data.map(item => <TRFeaturedItem key={item.id} data={item} />)}
                </tbody>
            </table>
        );
    }

    /**
     *
     */
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
                actionType: 'DEFAULT_CORPARCH_STAR_ICON_CLICK',
                props: {
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

    /**
     *
     */
    const TabMenu:React.SFC<{
        activeTab:number;
        onItemClick:(v:number)=>void;

    }> = (props) => {
        return (
            <div className="menu">
                <a data-func="my-corpora" className={props.activeTab === 0 ? 'current' : null}
                        onClick={() => props.onItemClick(0)}>
                    {util.translate('defaultCorparch__my_list')}
                </a>
                {'\u00a0|\u00a0'}
                <a data-func="search" className={props.activeTab === 1 ? 'current' : null}
                        onClick={() => props.onItemClick(1)}>
                    {util.translate('defaultCorparch__other_corpora')}
                </a>
            </div>
        );
    };

    /**CorplistItem
     *
     */
    const ListsTab:React.SFC<{
        dataFav:Immutable.List<FavListItem>;
        dataFeat:Immutable.List<CorplistItem>;
        anonymousUser:boolean;

    }> = (props) => {
        return (
            <div className="tables">
                <FavoritesBox data={props.dataFav}
                            anonymousUser={props.anonymousUser} />
                <FeaturedBox data={props.dataFeat} />
            </div>
        );
    };

    /**
     *
     */
    const SearchKeyword:React.SFC<{
        key:string;
        id:string;
        label:string;
        color:string;
        selected:boolean;

    }> = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch({
                actionType: 'DEFAULT_CORPARCH_KEYWORD_CLICKED',
                props: {
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

    /**
     *
     * @param {*} props
     */
    const ResetKeyword:React.SFC<{}> = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch({
                actionType: 'DEFAULT_CORPARCH_KEYWORD_RESET_CLICKED',
                props: {}
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

    /**
     *
     */
    const SearchInput:React.SFC<{
        value:string;

    }> = (props) => {

        const handleInput = (evt) => {
            dispatcher.dispatch({
                actionType: 'DEFAULT_CORPARCH_SEARCH_INPUT_CHANGED',
                props: {
                    value: evt.target.value
                }
            });
        };

        return <input type="text" className="tt-input"
                onChange={handleInput} value={props.value}
                placeholder={util.translate('defaultCorparch__name_or_description')}
                ref={item => item ? item.focus() : null} />;
    };

    /**
     *
     */
    const SearchResultRow:React.SFC<{
        data:SearchResultRow;

    }> = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch({
                actionType: 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED',
                props: {
                    itemId: props.data.id
                }
            });
            evt.stopPropagation();
            evt.preventDefault();
        };

        return (
            <p className="tt-suggestion">
                <a onClick={handleClick}>
                    {props.data.name}
                </a>
                {
                    props.data.found_in ?
                        <span className="found-in">({util.translate('defaultCorparch__found_in_{values}',
                            {values: props.data.found_in.join(', ')})})</span> :
                        null
                }
                {'\u00a0'}
                <span className="num">
                    {props.data.size_info}
                </span>
            </p>
        );
    };

    /**
     *
     */
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

    /**
     *
     */
    const SearchTab:React.SFC<{
        availSearchKeywords:Immutable.List<SearchKeyword>;
        isWaitingForSearchResults:boolean;
        currSearchResult:Immutable.List<SearchResultRow>;
        currSearchPhrase:string;
        hasSelectedKeywords:boolean;

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
                    <SearchInput value={props.currSearchPhrase} />
                    <SearchLoaderBar isActive={props.isWaitingForSearchResults} />
                    {props.currSearchResult.size > 0 ?
                        (<div className="tt-menu">
                            {props.currSearchResult.map(item => <SearchResultRow key={item.id} data={item} />)}
                        </div>) : null}
                </div>
            </div>
        );
    };

    /**
     *
     */
    const CorpusButton:React.SFC<{
        isWaitingToSwitch:boolean;
        corpusIdent:Kontext.FullCorpusIdent;
        onClick:()=>void;

    }> = (props) => {
        return (
            <button type="button"
                    className={`util-button${props.isWaitingToSwitch ? ' waiting': ''}`}
                    onClick={props.onClick}>
                {props.isWaitingToSwitch ? <layoutViews.AjaxLoaderBarImage htmlClass="loader" /> : null }
                <span className="corpus-name" title={props.corpusIdent.name}>{props.corpusIdent.id}</span>
            </button>
        );
    };

    /**
     *
     */
    const SubcorpSelection:React.SFC<{
        currSubcorpus:string;
        origSubcorpName:string;
        availSubcorpora:Immutable.List<Kontext.SubcorpListItem>;

    }> = (props) => {

        const handleSubcorpChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SELECT_SUBCORP',
                props: {
                    subcorp: props.availSubcorpora.get(evt.target.value).v,
                    pubName: props.availSubcorpora.get(evt.target.value).pub,
                }
            });
        };

        const selItemIdx = () => {
            const orig = props.currSubcorpus !== props.origSubcorpName ?
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

    /**
     *
     */
    class CorplistWidget extends React.Component<CorplistWidgetProps, CorplistWidgetModelState> {

        constructor(props) {
            super(props);
            this.state = widgetModel.getState();
            this._handleCloseClick = this._handleCloseClick.bind(this);
            this._handleTabSwitch = this._handleTabSwitch.bind(this);
            this._handleModelChange = this._handleModelChange.bind(this);
            this._handleOnShow = this._handleOnShow.bind(this);
            this._handleKeypress = this._handleKeypress.bind(this);
        }

        _handleKeypress(evt) {
            if (this.state.isVisible) {
                switch (evt.keyCode) {
                    case 9:
                        this._handleTabSwitch(1 - this.state.activeTab);
                        evt.preventDefault();
                        evt.stopPropagation();
                    break;
                    case 27:
                        this._handleCloseClick();
                        evt.preventDefault();
                        evt.stopPropagation();
                    break;
                }
            }
        }

        _handleOnShow() {
            dispatcher.dispatch({
                actionType: 'DEFAULT_CORPARCH_WIDGET_SHOW',
                props: {}
            });
        }

        _handleCloseClick() {
            dispatcher.dispatch({
                actionType: 'DEFAULT_CORPARCH_WIDGET_HIDE',
                props: {}
            });
        }

        _handleTabSwitch(v) {
            dispatcher.dispatch({
                actionType: 'DEFAULT_CORPARCH_SET_ACTIVE_TAB',
                props: {
                    value: v
                }
            });
        }

        _handleModelChange(state:CorplistWidgetModelState) {
            this.setState(state);
        }

        componentDidMount() {
            widgetModel.addChangeListener(this._handleModelChange);
            util.addGlobalKeyEventHandler(this._handleKeypress);
        }

        componentWillUnmount() {
            widgetModel.removeChangeListener(this._handleModelChange);
            util.removeGlobalKeyEventHandler(this._handleKeypress);
        }

        _renderWidget() {
            return (
                <layoutViews.PopupBox customClass="corplist-widget"
                        onCloseClick={this._handleCloseClick}>
                    <TabMenu onItemClick={this._handleTabSwitch} activeTab={this.state.activeTab} />
                    {this.state.activeTab === 0 ?
                        <ListsTab dataFav={this.state.dataFav} dataFeat={this.state.dataFeat}
                                anonymousUser={this.state.anonymousUser} /> :
                        <SearchTab availSearchKeywords={this.state.availSearchKeywords}
                                isWaitingForSearchResults={this.state.isWaitingForSearchResults}
                                currSearchResult={this.state.currSearchResult}
                                currSearchPhrase={this.state.currSearchPhrase}
                                hasSelectedKeywords={this.state.availSearchKeywords.find(x => x.selected) !== undefined} />
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
                                corpusIdent={this.state.corpusIdent} onClick={this._handleOnShow} />
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
                    {this.state.isVisible ? this._renderWidget() : null}
                </div>
            );
        }
    }


    return CorplistWidget;

}