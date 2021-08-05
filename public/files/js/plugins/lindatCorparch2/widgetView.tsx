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
import { Keyboard, List } from 'cnc-tskit';
import { Kontext } from '../../types/common';
import { FavListItem, CorplistWidgetModelState, CorplistWidgetModel } from './widget';
import { CorplistItem } from './common';
import { SearchKeyword, SearchResultRow } from './search';
import { IActionDispatcher, BoundWithProps, Bound } from 'kombo';
import { Actions } from './actions';
import { Actions as QueryActions, ActionName as QueryActionName } from '../../models/query/actions';
import { CorpusSwitchModel, CorpusSwitchModelState } from '../../models/common/corpusSwitch';

import * as S from './style';


export interface WidgetViewModuleArgs {
    dispatcher:IActionDispatcher;
    util:Kontext.ComponentHelpers;
    widgetModel:CorplistWidgetModel;
    corpusSwitchModel:CorpusSwitchModel;
}

export function init({
    dispatcher,
    util,
    widgetModel,
    corpusSwitchModel}:WidgetViewModuleArgs
):React.ComponentClass<{}> {

    const layoutViews = util.getLayoutViews();

    // ----------------------- <FavStar /> --------------------------------------

    const FavStar:React.FC<{
        ident:string;
        trashTTL:number;

    }> = (props) => {

        const handleRemoveClick = () => {
            dispatcher.dispatch<typeof Actions.WidgetFavItemAdd|typeof Actions.WidgetFavItemRemove>({
                name: props.trashTTL === null ?
                        Actions.WidgetFavItemRemove.name :
                        Actions.WidgetFavItemAdd.name,
                payload: {
                    itemId: props.ident
                }
            });
        };

        return (
            <a onClick={handleRemoveClick}>
                {props.trashTTL === null ?
                    <S.StarredImg className="starred" src={util.createStaticUrl('img/starred.svg')}
                            alt={util.translate('lindatCorparch2__click_to_remove_item_from_fav')}
                            title={util.translate('lindatCorparch2__click_to_remove_item_from_fav')} /> :
                    <S.StarredImg className="starred" src={util.createStaticUrl('img/starred_grey.svg')}
                            alt={util.translate('lindatCorparch2__not_in_fav')}
                            title={util.translate('lindatCorparch2__not_in_fav')} />
                }
            </a>
        );
    };

    // -------------------------- <TRFavoriteItem /> ----------------------------------

    const TRFavoriteItem:React.FC<{
        data:FavListItem;
        isActive:boolean;

    }> = (props) => {

        const handleItemClick = () => {
            dispatcher.dispatch<typeof Actions.WidgetFavItemClick>({
                name: Actions.WidgetFavItemClick.name,
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
                                        util.translate('lindatCorparch2__item_will_be_removed')}
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

    const FavoritesBox:React.FC<{
        data:Array<FavListItem>;
        anonymousUser:boolean;
        activeIdx:number;

    }> = (props) => {

        return (
            <table className="favorite-list">
                <tbody>
                    <tr>
                        <th>
                            {util.translate('lindatCorparch2__fav_items')}
                        </th>
                        <th />
                        <th />
                    </tr>
                    {props.anonymousUser ?
                        <tr>
                            <td colSpan={3}>{util.translate('lindatCorparch2__please_log_in_to_see_fav')}</td>
                        </tr> :
                        List.map((item, i) =>
                            <TRFavoriteItem key={item.id} data={item} isActive={i === props.activeIdx} />,
                            props.data
                        )
                    }
                </tbody>
            </table>
        );
    };

    // --------------------------- <TRFeaturedItem /> --------------------------------

    const TRFeaturedItem:React.FC<{
        data:CorplistItem;
        isActive:boolean;

    }> = (props) => {

        const handleItemClick = () => {
            dispatcher.dispatch<typeof Actions.WidgetFeatItemClick>({
                name: Actions.WidgetFeatItemClick.name,
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

    const FeaturedBox:React.FC<{
        data:Array<CorplistItem>;
        activeIdx:number;

    }> = (props) => {
        return (
            <table className="featured-list">
                <tbody>
                    <tr>
                        <th colSpan={2}>
                            {util.translate('lindatCorparch2__featured_corpora')}
                        </th>
                    </tr>
                    {List.map((item, i) =>
                        <TRFeaturedItem key={item.id} data={item} isActive={i === props.activeIdx} />,
                        props.data
                    )}
                </tbody>
            </table>
        );
    }

    // ------------------------- <StarComponent /> ------------------------

    const StarComponent:React.FC<{
        currFavitemId:string;

    }> = (props) => {

        const renderIcon = () => {
            const style = {width: '1.6em'};
            if (props.currFavitemId) {
                return <img src={util.createStaticUrl('img/starred.svg')}
                        title={util.translate('lindatCorparch2__in_fav')}
                        alt={util.translate('lindatCorparch2__in_fav')}
                        style={style} />;

            } else {
                return <img src={util.createStaticUrl('img/starred_grey.svg')}
                        title={util.translate('defaultCorparch__not_in_fav')}
                        alt={util.translate('defaultCorparch__not_in_fav')}
                        style={style} />;
            }
        };

        const handleStarClick = () => {
            dispatcher.dispatch<typeof Actions.WidgetStarIconClick>({
                name: Actions.WidgetStarIconClick.name,
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

    const TabMenu:React.FC<{
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
                        {util.translate('lindatCorparch2__my_list')}
                    </a>
                    {'\u00a0|\u00a0'}
                    <a data-func="search" className={props.activeTab === 1 ? 'current' : null}
                            onClick={clickHandler(1)}>
                        {util.translate('lindatCorparch2__other_corpora')}
                    </a>
                </span>
            </div>
        );
    };

    // ----------------------------- <ListsTab /> -------------------------------

    const ListsTab:React.FC<{
        dataFav:Array<FavListItem>;
        dataFeat:Array<CorplistItem>;
        anonymousUser:boolean;
        activeListItem:[number, number];

    }> = (props) => {

        const handleKeyDown = (evt:React.KeyboardEvent) => {
            const argMap = {
                [Keyboard.Value.DOWN_ARROW]: [0, 1],
                [Keyboard.Value.UP_ARROW]: [0, -1],
                [Keyboard.Value.LEFT_ARROW]: [-1, 0],
                [Keyboard.Value.RIGHT_ARROW]: [1, 0]
            };
            if (Keyboard.isArrowKey(evt.keyCode)) {
                dispatcher.dispatch<typeof Actions.WidgetMoveFocusToNextItem>({
                    name: Actions.WidgetMoveFocusToNextItem.name,
                    payload: {
                        change: argMap[evt.key]
                    }
                });
                evt.preventDefault();
                evt.stopPropagation();

            } else if (evt.key === Keyboard.Value.ENTER) {
                dispatcher.dispatch<typeof Actions.WidgetEnterOnActiveItem>({
                    name: Actions.WidgetEnterOnActiveItem.name,
                    payload: {}
                });
                evt.preventDefault();
                evt.stopPropagation();
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

    const SearchKeyword:React.FC<{
        key:string;
        id:string;
        label:string;
        color:string;
        selected:boolean;

    }> = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch<typeof Actions.WidgetKeywordClick>({
                name: Actions.WidgetKeywordClick.name,
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

    const ResetKeyword:React.FC<{}> = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch<typeof Actions.WidgetKeywordResetClick>({
                name: Actions.WidgetKeywordResetClick.name,
                payload: {}
            });
        };

        return (
            <a className="keyword reset" onClick={handleClick}>
                <span className="overlay">
                    {util.translate('lindatCorparch2__no_keyword')}
                </span>
            </a>
        );
    };

    // ------------------------- <SearchInput /> ---------------------------------------

    const SearchInput:React.FC<{
        value:string;
        handleTab:()=>void;

    }> = (props) => {

        const handleInput = (evt) => {
            dispatcher.dispatch<typeof Actions.WidgetSearchInputChanged>({
                name: Actions.WidgetSearchInputChanged.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        const handleKeyDown = (evt) => {

            switch (evt.keyC) {
                case Keyboard.Value.DOWN_ARROW:
                case Keyboard.Value.UP_ARROW:
                    dispatcher.dispatch<typeof Actions.WidgetFocusSearchRow>({
                        name: Actions.WidgetFocusSearchRow.name,
                        payload: {
                            inc: evt.key === Keyboard.Value.DOWN_ARROW ? 1 : -1
                        }
                    });
                    evt.stopPropagation();
                    evt.preventDefault();
                break;
                case Keyboard.Value.ENTER:
                    dispatcher.dispatch<typeof Actions.WidgetFocusedItemSelect>({
                        name: Actions.WidgetFocusedItemSelect.name,
                        payload: {}
                    });
                    evt.stopPropagation();
                    evt.preventDefault();
                break;
                case Keyboard.Value.TAB:
                    props.handleTab();
                    evt.stopPropagation();
                break;
            }
        };

        return <input type="text" className="tt-input"
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    value={props.value}
                    placeholder={util.translate('lindatCorparch2__name_or_description')}
                    ref={item => item ? item.focus() : null} />;
    };

    // ------------------------- <SearchResultRow /> ------------------------

    const SearchResultRow:React.FC<{
        data:SearchResultRow;
        hasFocus:boolean;

    }> = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch<typeof Actions.WidgetSearchResultClick>({
                name: Actions.WidgetSearchResultClick.name,
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
                            {List.map(foundIn => util.translate(foundIn), props.data.found_in)}
                        </span>
                    : null
                }
            </p>
        );
    };

    // ---------------------------- <SearchLoaderBar /> --------------------------

    const SearchLoaderBar:React.FC<{
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

    const SearchTab:React.FC<{
        availSearchKeywords:Array<SearchKeyword>;
        isWaitingForSearchResults:boolean;
        currSearchResult:Array<SearchResultRow>;
        currSearchPhrase:string;
        hasSelectedKeywords:boolean;
        focusedRowIdx:number;
        handleTab:()=>void;

    }> = (props) => {
        return (
            <div>
                <div className="labels">
                    {List.map(item => <SearchKeyword key={item.id} {...item} />, props.availSearchKeywords)}
                    {props.hasSelectedKeywords ? <ResetKeyword /> : null}
                    <div className="labels-hint">
                        {util.translate('lindatCorparch2__hold_ctrl_for_multiple')}
                    </div>
                </div>
                <div className="autocomplete-wrapper">
                    <SearchInput value={props.currSearchPhrase} handleTab={props.handleTab} />
                    <SearchLoaderBar isActive={props.isWaitingForSearchResults} />
                    {props.currSearchResult.length > 0 ?
                        (<S.TtMenu>
                            {List.map((item, i) =>
                                <SearchResultRow key={item.id} data={item} hasFocus={i === props.focusedRowIdx} />,
                                props.currSearchResult
                            )}
                        </S.TtMenu>) : null}
                </div>
            </div>
        );
    };

    // ----------------------------- <CorpusButton /> --------------------------

    interface CorpusButtonProps {
        corpusIdent:Kontext.FullCorpusIdent;
        isWidgetVisible:boolean;
        onClick:()=>void;
    }

    const CorpusButton:React.FC<CorpusSwitchModelState & CorpusButtonProps> = (props) => {

        const handleKeyDown = (evt:React.KeyboardEvent) => {
            if (evt.key === Keyboard.Value.ENTER || evt.key === Keyboard.Value.ESC) {
                props.onClick();
                evt.stopPropagation();
                evt.preventDefault();
            }
        };

        return (
            <button type="button"
                    className={`util-button${props.isBusy ? ' waiting': ''}`}
                    onClick={props.onClick} onKeyDown={handleKeyDown}>
                {props.isBusy ? <layoutViews.AjaxLoaderBarImage htmlClass="loader" /> : null }
                <span className="corpus-name" title={props.corpusIdent.name}>{props.corpusIdent.id}</span>
            </button>
        );
    };

    // ----------------------------- <BoundCorpusButton /> --------------------------

    const BoundCorpusButton = BoundWithProps<CorpusButtonProps, CorpusSwitchModelState>(CorpusButton, corpusSwitchModel);

    // ------------------------------- <SubcorpSelection /> -----------------------------

    const SubcorpSelection:React.FC<{
        currSubcorpus:string;
        origSubcorpName:string;
        availSubcorpora:Array<Kontext.SubcorpListItem>;

    }> = (props) => {

        const handleSubcorpChange = (evt) => {
            dispatcher.dispatch<QueryActions.QueryInputSelectSubcorp>({
                name: QueryActionName.QueryInputSelectSubcorp,
                payload: {
                    subcorp: props.availSubcorpora[evt.target.value].v,
                    pubName: props.availSubcorpora[evt.target.value].pub,
                    foreign: props.availSubcorpora[evt.target.value].foreign
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
                    {List.map((item, i) =>
                        <option key={item.v} value={i}>{item.n}</option>,
                        props.availSubcorpora
                    )}
                </select>
            </span>
        )
    };

    // ------------------------- <CorplistWidget /> -------------------------------

    class CorplistWidget extends React.PureComponent<CorplistWidgetModelState> {

        constructor(props) {
            super(props);
            this._handleCloseClick = this._handleCloseClick.bind(this);
            this._handleTabSwitch = this._handleTabSwitch.bind(this);
            this._handleOnShow = this._handleOnShow.bind(this);
            this._handleKeypress = this._handleKeypress.bind(this);
            this._handleWidgetButtonClick = this._handleWidgetButtonClick.bind(this);
            this._handleAreaClick = this._handleAreaClick.bind(this);
        }

        _handleKeypress(evt) {
            if (this.props.isVisible) {
                switch (evt.key) {
                    case Keyboard.Value.TAB:
                        this._handleTabSwitch(1 - this.props.activeTab);
                        evt.preventDefault();
                        evt.stopPropagation();
                    break;
                    case Keyboard.Value.ESC:
                        this._handleCloseClick();
                        evt.preventDefault();
                        evt.stopPropagation();
                    break;
                }
            }
        }

        _handleOnShow() {
            dispatcher.dispatch<typeof Actions.WidgetShow>({
                name: Actions.WidgetShow.name,
                payload: {}
            });
        }

        _handleCloseClick() {
            dispatcher.dispatch<typeof Actions.WidgetHide>({
                name: Actions.WidgetHide.name,
                payload: {}
            });
        }

        _handleWidgetButtonClick() {
            if (this.props.isVisible) {
                this._handleCloseClick();

            } else {
                this._handleOnShow();
            }
        }

        _handleTabSwitch(v) {
            dispatcher.dispatch<typeof Actions.WidgetSetActiveTab>({
                name: Actions.WidgetSetActiveTab.name,
                payload: {
                    value: v
                }
            });
        }

        _handleAreaClick() {
            dispatcher.dispatch<typeof Actions.WidgetSetActiveTab>({
                name: Actions.WidgetSetActiveTab.name,
                payload: {
                    value: this.props.activeTab
                }
            });
        }

        _renderWidget() {
            return (
                <layoutViews.PopupBox customClass="corplist-widget"
                        onCloseClick={this._handleCloseClick}
                        onAreaClick={this._handleAreaClick}
                        keyPressHandler={this._handleKeypress}>
                    <TabMenu onItemClick={this._handleTabSwitch} activeTab={this.props.activeTab}
                                onEscKey={this._handleCloseClick} />
                    {this.props.activeTab === 0 ?
                        <ListsTab dataFav={this.props.dataFav} dataFeat={this.props.dataFeat}
                                anonymousUser={this.props.anonymousUser}
                                activeListItem={this.props.activeListItem} /> :
                        <SearchTab availSearchKeywords={this.props.availSearchKeywords}
                                isWaitingForSearchResults={this.props.isWaitingForSearchResults}
                                currSearchResult={this.props.currSearchResult}
                                currSearchPhrase={this.props.currSearchPhrase}
                                hasSelectedKeywords={this.props.availSearchKeywords.find(x => x.selected) !== undefined}
                                focusedRowIdx={this.props.focusedRowIdx}
                                handleTab={this._handleCloseClick} />
                    }
                    <div className="footer">
                        <span>
                            {this.props.activeTab === 0 ?
                                util.translate('lindatCorparch2__hit_tab_to_see_other') :
                                util.translate('lindatCorparch2__hit_tab_to_see_fav')}
                        </span>
                    </div>
                </layoutViews.PopupBox>
            );
        }

        render() {
            return (
                <S.CorplistWidget>
                    <div>
                        <BoundCorpusButton
                            corpusIdent={this.props.corpusIdent}
                            onClick={this._handleWidgetButtonClick}
                            isWidgetVisible={this.props.isVisible} />
                        {this.props.isVisible ? this._renderWidget() : null}
                        {this.props.availableSubcorpora.length > 0 ?
                            (<span>
                                <strong className="subc-separator">{'\u00a0/\u00a0'}</strong>
                                <SubcorpSelection currSubcorpus={this.props.currSubcorpus}
                                    origSubcorpName={this.props.currSubcorpusOrigName}
                                    availSubcorpora={this.props.availableSubcorpora} />
                            </span>) :
                            null
                        }
                        {!this.props.anonymousUser ?
                            <StarComponent currFavitemId={this.props.currFavitemId} /> :
                            null
                        }
                    </div>
                </S.CorplistWidget>
            );
        }
    }


    return Bound(CorplistWidget, widgetModel);

}