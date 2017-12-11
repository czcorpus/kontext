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

/// <reference path="../../vendor.d.ts/react.d.ts" />

import * as React from 'vendor/react';

export function init(dispatcher, util, widgetStore, queryStore) {

    const layoutViews = util.getLayoutViews();

    /**
     *
     * @param {*} props
     */
    const TRFavoriteItem = (props) => {

        const handleItemClick = () => {
            dispatcher.dispatch({
                actionType: 'DEFAULT_CORPARCH_FAV_ITEM_CLICK',
                props: {
                    itemId: props.data.id
                }
            });
        };

        const handleRemoveClick = () => {
            dispatcher.dispatch({
                actionType: 'DEFAULT_CORPARCH_FAV_ITEM_REMOVE',
                props: {
                    itemId: props.data.id
                }
            });
        };

        return (
            <tr className="data-item">
                <td>
                    <a className="corplist-item"
                            title={props.data.description}
                            onClick={handleItemClick}>
                        {props.data.name}
                    </a>
                </td>
                <td className="num">
                    {props.data.size_info}
                </td>
                <td className="tools">
                    {props.editEnable ?
                        (<a onClick={handleRemoveClick}>
                            <img className="remove"
                                alt={util.translate('defaultCorparch__click_to_remove_item_from_fav')}
                                title={util.translate('defaultCorparch__click_to_remove_item_from_fav')}
                                src={util.createStaticUrl('img/close-icon.svg')} />
                        </a>) :
                        null}
                </td>
            </tr>
        );
    }

    /**
     *
     * @param {*} props
     */
    const FavoritesBox = (props) => {
        return (
            <table className="favorite-list">
                <tbody>
                    <tr>
                        <th>
                            {util.translate('defaultCorparch__fav_items')}
                        </th>
                        <th />
                        <th className="conf">
                            <a onClick={props.onChangeEditEnable}>
                                <img className="config"
                                    title={util.translate('defaultCorparch__click_to_unlock_removal')}
                                    alt={util.translate('defaultCorparch__click_to_unlock_removal')}
                                    src={util.createStaticUrl('img/config-icon_16x16.png')} />
                            </a>
                        </th>
                    </tr>
                    {props.anonymousUser ?
                        <tr><td colSpan="3">{util.translate('defaultCorparch__please_log_in_to_see_fav')}</td></tr> :
                        props.data.map(item => <TRFavoriteItem key={item.id} data={item} editEnable={props.editEnable} />)
                    }
                </tbody>
            </table>
        );
    };

    /**
     *
     * @param {*} props
     */
    const TRFeaturedItem = (props) => {

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
     * @param {*} props
     */
    const FeaturedBox = (props) => {
        return (
            <table className="featured-list">
                <tbody>
                    <tr>
                        <th colSpan="2">
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
     * @param {*} props
     */
    const StarComponent = (props) => {

        const renderIcon = () => {
            const style = {width: '2em'};
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
    const TabMenu = (props) => {
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

    /**
     *
     * @param {*} props
     */
    const ListsTab = (props) => {
        return (
            <div className="tables">
                <FavoritesBox data={props.dataFav} editEnable={props.editEnable}
                            onChangeEditEnable={props.onChangeEditEnable}
                            anonymousUser={props.anonymousUser} />
                <FeaturedBox data={props.dataFeat} />
            </div>
        );
    };

    /**
     *
     * @param {*} props
     */
    const SearchKeyword = (props) => {

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
    const ResetKeyword = (props) => {

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
     * @param {*} props
     */
    const SearchInput = (props) => {

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
     * @param {*} props
     */
    const SearchResultRow = (props) => {

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
                {'\u00a0'}
                <span className="num">
                    {props.data.size_info}
                </span>
            </p>
        );
    };

    /**
     *
     * @param {*} props
     */
    const SearchLoaderBar = (props) => {
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
     * @param {*} props
     */
    const SearchTab = (props) => {
        return (
            <div>
                <div className="labels">
                    <ResetKeyword />
                    {props.availSearchKeywords.map(item => <SearchKeyword key={item.id} {...item} />)}
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
     * @param {*} props
     */
    const CorpusButton = (props) => {
        return (
            <button type="button" className="util-button" onClick={props.onClick}>
                {props.isWaitingToSwitch ?
                    <img src={util.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={util.translate('global__loading')} /> :
                    <span title={props.corpusIdent.name}>{props.corpusIdent.canonicalId}</span>
                }
            </button>
        );
    };

    /**
     *
     * @param {*} props
     */
    const SubcorpSelection = (props) => {

        const handleSubcorpChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SELECT_SUBCORP',
                props: {
                    subcorp: evt.target.value
                }
            });
        };

        return (
            <span id="subcorp-selector-wrapper">
                <select id="subcorp-selector" name="usesubcorp" value={props.currSubcorpus}
                        onChange={handleSubcorpChange}>
                    {props.availSubcorpora.map(item => {
                        return <option key={item.v} value={item.v}>{item.n}</option>;
                    })}
                </select>
            </span>
        )
    };

    /**
     *
     */
    class CorplistWidget extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchStoreState();
            this._handleCloseClick = this._handleCloseClick.bind(this);
            this._handleTabSwitch = this._handleTabSwitch.bind(this);
            this._handleChangeEditEnable = this._handleChangeEditEnable.bind(this);
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._handleOnShow = this._handleOnShow.bind(this);
            this._handleKeypress = this._handleKeypress.bind(this);
        }

        _fetchStoreState() {
            return {
                corpusIdent: widgetStore.getCorpusIdent(),
                anonymousUser: widgetStore.getIsAnonymousUser(),
                dataFav: widgetStore.getDataFav(),
                dataFeat: widgetStore.getDataFeat(),
                isWaitingToSwitch: widgetStore.getIsWaitingToSwitch(),
                currFavitemId: widgetStore.getCurrFavitemId(),
                currSubcorpus: queryStore.getCurrentSubcorpus(),
                availSubcorpora: queryStore.getAvailableSubcorpora(),
                availSearchKeywords: widgetStore.getAvailKeywords(),
                isWaitingForSearchResults: widgetStore.getIsWaitingForSearchResults(),
                currSearchResult: widgetStore.getcurrSearchResult(),
                currSearchPhrase: widgetStore.getCurrSearchPhrase(),
                visible: false,
                activeTab: 0,
                editEnable: false
            }
        }

        _handleKeypress(evt) {
            if (this.state.visible) {
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
            const tmp = this._fetchStoreState();
            tmp['visible'] = !this.state.visible;
            this.setState(tmp);
        }

        _handleCloseClick() {
            const tmp = this._fetchStoreState();
            tmp['visible'] = false;
            this.setState(tmp);
        }

        _handleTabSwitch(v) {
            const tmp = this._fetchStoreState();
            tmp['visible'] = this.state.visible;
            tmp['activeTab'] = v
            this.setState(tmp);
        }

        _handleChangeEditEnable() {
            const tmp = this._fetchStoreState();
            tmp['visible'] = this.state.visible;
            tmp['activeTab'] = this.state.activeTab;
            tmp['editEnable'] = !this.state.editEnable;
            this.setState(tmp);
        }

        _handleStoreChange() {
            const tmp = this._fetchStoreState();
            tmp['visible'] = this.state.visible;
            tmp['activeTab'] = this.state.activeTab;
            tmp['editEnable'] = this.state.editEnable;
            this.setState(tmp);
        }

        componentDidMount() {
            widgetStore.addChangeListener(this._handleStoreChange);
            queryStore.addChangeListener(this._handleStoreChange);
            util.addGlobalKeyEventHandler(this._handleKeypress);
        }

        componentWillUnmount() {
            widgetStore.removeChangeListener(this._handleStoreChange);
            queryStore.removeChangeListener(this._handleStoreChange);
            util.removeGlobalKeyEventHandler(this._handleKeypress);
        }

        _renderWidget() {
            return (
                <layoutViews.PopupBox customClass="corplist-widget"
                        onCloseClick={this._handleCloseClick}>
                    <TabMenu onItemClick={this._handleTabSwitch} activeTab={this.state.activeTab} />
                    {this.state.activeTab === 0 ?
                        <ListsTab dataFav={this.state.dataFav} dataFeat={this.state.dataFeat}
                                editEnable={this.state.editEnable}
                                onChangeEditEnable={this._handleChangeEditEnable}
                                anonymousUser={this.state.anonymousUser} /> :
                        <SearchTab availSearchKeywords={this.state.availSearchKeywords}
                                isWaitingForSearchResults={this.state.isWaitingForSearchResults}
                                currSearchResult={this.state.currSearchResult}
                                currSearchPhrase={this.state.currSearchPhrase} />
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
                        <CorpusButton isWaitingToSwitch={this.state.isWaitingToSwitch}
                                corpusIdent={this.state.corpusIdent} onClick={this._handleOnShow} />
                        {this.state.availSubcorpora.size > 0 ?
                            (<span>
                                <strong>{'\u00a0:\u00a0'}</strong>
                                <SubcorpSelection currSubcorpus={this.state.currSubcorpus}
                                    availSubcorpora={this.state.availSubcorpora} />
                            </span>) :
                            null
                        }
                        {!this.state.anonymousUser ?
                            <StarComponent currFavitemId={this.state.currFavitemId} /> :
                            null
                        }
                    </div>
                    {this.state.visible ? this._renderWidget() : null}
                </div>
            );
        }
    }


    return CorplistWidget;

}