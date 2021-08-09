/*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IActionDispatcher, Bound, BoundWithProps } from 'kombo';

import * as Kontext from '../../../types/kontext';
import { CorplistWidgetModel, FavListItem, CorplistWidgetModelState } from '../widget';
import { CorplistItem } from '../common';
import { SearchKeyword, SearchResultRow } from '../search';
import { Actions } from '../actions';
import { Keyboard, Strings, List } from 'cnc-tskit';
import { Actions as QueryActions } from '../../../models/query/actions';
import { CorpusSwitchModel, CorpusSwitchModelState } from '../../../models/common/corpusSwitch';
import * as S from './style';
import * as S2 from '../commonStyle';


export interface WidgetViewModuleArgs {
    dispatcher:IActionDispatcher;
    util:Kontext.ComponentHelpers;
    widgetModel:CorplistWidgetModel;
    corpusSwitchModel:CorpusSwitchModel;
}

export interface WidgetViews {

}


export function init({
    dispatcher,
    util,
    widgetModel,
    corpusSwitchModel}:WidgetViewModuleArgs
):React.ComponentClass<{}, CorplistWidgetModelState> {

    const layoutViews = util.getLayoutViews();

    // ----------------------- <FavStar /> --------------------------------------

    const FavStar:React.FC<{
        ident:string;
        trashTTL:number;

    }> = (props) => {

        const handleRemoveClick = () => {
            if (props.trashTTL === null) {
                dispatcher.dispatch<typeof Actions.FavItemRemove>({
                    name: Actions.FavItemRemove.name,
                    payload: {
                        itemId: props.ident
                    }
                });

            } else {
                dispatcher.dispatch<typeof Actions.FavItemAdd>({
                    name: Actions.FavItemAdd.name,
                    payload: {
                        itemId: props.ident
                    }
                });
            }
        };

        const rmTitle = util.translate('defaultCorparch__click_to_remove_item_from_fav');
        const addTitle = util.translate('defaultCorparch__not_in_fav');
        return (
            <a onClick={handleRemoveClick}>
                {props.trashTTL === null ?
                    <img className="starred" src={util.createStaticUrl('img/starred.svg')}
                        alt={rmTitle} title={rmTitle} /> :
                    <img className="starred" src={util.createStaticUrl('img/starred_grey.svg')}
                            alt={addTitle} title={addTitle} />
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
            dispatcher.dispatch<typeof Actions.FavItemClick>({
                name: Actions.FavItemClick.name,
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

        const shortName = Strings.shortenText(props.data.name, 50);

        return (
            <tr className={htmlClasses.join(' ')}>
                <td>
                    <a className="corplist-item"
                            title={props.data.trashTTL === null ?
                                    (shortName.length < props.data.name.length ?
                                        props.data.name : props.data.description) :
                                    util.translate('defaultCorparch__item_will_be_removed')}
                            onClick={handleItemClick}>
                        {shortName}
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
                            {util.translate('defaultCorparch__fav_items')}
                        </th>
                        <th />
                        <th />
                    </tr>
                    {props.anonymousUser ?
                        <tr>
                            <td colSpan={3}>
                                {util.translate('defaultCorparch__please_log_in_to_see_fav')}
                            </td>
                        </tr> :
                        List.map(
                            (item, i) => (
                                <TRFavoriteItem key={item.id} data={item}
                                        isActive={i === props.activeIdx} />
                            ),
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
            dispatcher.dispatch<typeof Actions.FeatItemClick>({
                name: Actions.FeatItemClick.name,
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

    const StarComponent:React.FC<{
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
            dispatcher.dispatch<typeof Actions.StarIconClick>({
                name: Actions.StarIconClick.name,
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
            switch (evt.key) {
                case Keyboard.Value.DOWN_ARROW:
                case Keyboard.Value.UP_ARROW:
                case Keyboard.Value.LEFT_ARROW:
                case Keyboard.Value.RIGHT_ARROW:
                    dispatcher.dispatch<typeof Actions.MoveFocusToNextListItem>({
                        name: Actions.MoveFocusToNextListItem.name,
                        payload: {
                            change: argMap[evt.key]
                        }
                    });
                    evt.preventDefault();
                    evt.stopPropagation();
                break;
                case Keyboard.Value.ENTER:
                    dispatcher.dispatch<typeof Actions.EnterOnActiveListItem>({
                        name: Actions.EnterOnActiveListItem.name
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
                        activeIdx={props.activeListItem[0] === 0 ?
                            props.activeListItem[1] : null} />
                <FeaturedBox data={props.dataFeat}
                        activeIdx={props.activeListItem[0] === 1 ?
                            props.activeListItem[1] : null} />
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
            dispatcher.dispatch<typeof Actions.KeywordClicked>({
                name: Actions.KeywordClicked.name,
                payload: {
                    keywordId: props.id,
                    status: !props.selected,
                    attachToCurrent: evt.ctrlKey || evt.metaKey
                }
            });
        };

        const style = {
            backgroundColor: props.color,
            borderColor: props.color
        };

        return (
            <S2.KeywordLink className={props.selected ? 'selected' : undefined} onClick={handleClick}>
                <span className="overlay" style={style}>
                    {props.label}
                </span>
            </S2.KeywordLink>
        );
    };

   // ----------------------------- <ResetKeyword /> ----------------------------------

    const ResetKeyword:React.FC<{}> = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch<typeof Actions.KeywordResetClicked>({
                name: Actions.KeywordResetClicked.name
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

    const SearchInput:React.FC<{
        value:string;
        handleTab:()=>void;

    }> = (props) => {

        const handleInput = (evt) => {
            dispatcher.dispatch<typeof Actions.SearchInputChanged>({
                name: Actions.SearchInputChanged.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        const handleKeyDown = (evt) => {

            switch (evt.key) {
                case Keyboard.Value.DOWN_ARROW:
                case Keyboard.Value.UP_ARROW:
                    dispatcher.dispatch<typeof Actions.FocusSearchRow>({
                        name: Actions.FocusSearchRow.name,
                        payload: {
                            inc: evt.key === Keyboard.Value.DOWN_ARROW ? 1 : -1
                        }
                    });
                    evt.stopPropagation();
                    evt.preventDefault();
                break;
                case Keyboard.Value.ENTER:
                    dispatcher.dispatch<typeof Actions.FocusedItemSelect>({
                        name: Actions.FocusedItemSelect.name
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
                    placeholder={util.translate('defaultCorparch__name_or_description')}
                    ref={item => item ? item.focus() : null} />;
    };

    // ------------------------- <SearchResultRow /> ------------------------

    const SearchResultRow:React.FC<{
        data:SearchResultRow;
        hasFocus:boolean;

    }> = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch<typeof Actions.SearchResultItemClicked>({
                name: Actions.SearchResultItemClicked.name,
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
                <div>
                    {List.map(
                        item => <SearchKeyword key={item.id} {...item} />,
                        props.availSearchKeywords
                    )}
                    {props.hasSelectedKeywords ? <ResetKeyword /> : null}
                    <div className="labels-hint">
                        {util.translate('defaultCorparch__hold_ctrl_for_multiple')}
                    </div>
                </div>
                <div className="autocomplete-wrapper">
                    <SearchInput value={props.currSearchPhrase} handleTab={props.handleTab} />
                    <SearchLoaderBar isActive={props.isWaitingForSearchResults} />
                    {props.currSearchResult.length > 0 ?
                        <S.TTMenu>
                            {props.currSearchResult.map((item, i) =>
                                    <SearchResultRow key={item.id} data={item}
                                            hasFocus={i === props.focusedRowIdx} />)}
                        </S.TTMenu> :
                        null
                    }
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
                {props.isBusy ?
                    <layoutViews.AjaxLoaderBarImage htmlClass="loader" /> :
                    null
                }
                <span className="corpus-name" title={props.corpusIdent.id}>
                    {props.corpusIdent.name}
                </span>
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
            dispatcher.dispatch<typeof QueryActions.QueryInputSelectSubcorp>({
                name: QueryActions.QueryInputSelectSubcorp.name,
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
                    {props.availSubcorpora.map((item, i) => {
                        return <option key={item.v} value={i}>{item.n}</option>;
                    })}
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
                name: Actions.WidgetShow.name
            });
        }

        _handleCloseClick() {
            dispatcher.dispatch<typeof Actions.WidgetHide>({
                name: Actions.WidgetHide.name
            });
        }

        _handleWidgetButtonClick() {
            if (this.props.isVisible) {
                this._handleCloseClick();

            } else {
                this._handleOnShow();
            }
        }

        _handleTabSwitch(v:number) {
            dispatcher.dispatch<typeof Actions.SetActiveTab>({
                name: Actions.SetActiveTab.name,
                payload: {
                    value: v
                }
            });
        }

        _handleAreaClick() {
            dispatcher.dispatch<typeof Actions.SetActiveTab>({
                name: Actions.SetActiveTab.name,
                payload: {
                    value: this.props.activeTab
                }
            });
        }

        _renderWidget() {
            return (
                <layoutViews.PopupBox customClass="active-widget"
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
                                hasSelectedKeywords={List.find(
                                    x => x.selected, this.props.availSearchKeywords) !== undefined}
                                focusedRowIdx={this.props.focusedRowIdx}
                                handleTab={this._handleCloseClick} />
                    }
                    <div className="footer">
                        <span>
                            {this.props.activeTab === 0 ?
                                util.translate('defaultCorparch__hit_tab_to_see_other') :
                                util.translate('defaultCorparch__hit_tab_to_see_fav')}
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
                                <SubcorpSelection currSubcorpus={this.props.corpusIdent.usesubcorp}
                                    origSubcorpName={this.props.corpusIdent.origSubcorpName}
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