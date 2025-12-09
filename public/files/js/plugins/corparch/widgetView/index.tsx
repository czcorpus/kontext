/*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { IActionDispatcher, BoundWithProps, useModel } from 'kombo';

import * as Kontext from '../../../types/kontext.js';
import { CorplistWidgetModel, FavListItem, CorplistWidgetModelState } from '../widget.js';
import { CorplistItem } from '../common.js';
import { SearchKeyword, SearchResultRow } from '../search.js';
import { Actions } from '../actions.js';
import { Keyboard, Strings, List } from 'cnc-tskit';
import { CorpusSwitchModel } from '../../../models/common/corpusSwitch.js';
import { init as subcInit } from './subcorp.js';
import { PublicSubcorpListModel } from '../../../models/subcorp/listPublic.js';
import * as S from './style.js';
import * as S2 from '../commonStyle.js';


export interface WidgetViewModuleArgs {
    dispatcher:IActionDispatcher;
    util:Kontext.ComponentHelpers;
    widgetModel:CorplistWidgetModel;
    corpusSwitchModel:CorpusSwitchModel;
    publicSubcModel:PublicSubcorpListModel;
}


export function init({
    dispatcher,
    util,
    widgetModel,
    publicSubcModel,
    corpusSwitchModel}:WidgetViewModuleArgs
):React.FC<{widgetId:string}> {

    const layoutViews = util.getLayoutViews();
    const {SubcorpWidget, SubcorpSelection} = subcInit(dispatcher, util, publicSubcModel);

    // ----------------------- <FavStar /> --------------------------------------

    const FavStar:React.FC<{
        widgetId:string;
        ident:string;
        trashTTL:number;

    }> = (props) => {

        const handleRemoveClick = () => {
            if (props.trashTTL === null) {
                dispatcher.dispatch<typeof Actions.WidgetFavItemRemove>({
                    name: Actions.WidgetFavItemRemove.name,
                    payload: {
                        widgetId: props.widgetId,
                        itemId: props.ident
                    }
                });

            } else {
                dispatcher.dispatch<typeof Actions.WidgetFavItemAdd>({
                    name: Actions.WidgetFavItemAdd.name,
                    payload: {
                        widgetId: props.widgetId,
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
        widgetId:string;
        data:FavListItem;
        isActive:boolean;

    }> = (props) => {

        const handleItemClick = () => {
            dispatcher.dispatch<typeof Actions.WidgetFavItemClick>({
                name: Actions.WidgetFavItemClick.name,
                payload: {
                    widgetId: props.widgetId,
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
                    {List.size(props.data.corpora) > 1 ? '\u2264\u00a0' : null}
                    {props.data.size_info}
                </td>
                <td className="tools">
                    <FavStar widgetId={props.widgetId} ident={props.data.id} trashTTL={props.data.trashTTL} />
                </td>
            </tr>
        );
    }

    // -------------------------- <FavoritesBox /> ---------------------

    const FavoritesBox:React.FC<{
        widgetId: string;
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
                                <TRFavoriteItem widgetId={props.widgetId} key={item.id} data={item}
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
        widgetId:string;
        data:CorplistItem;
        isActive:boolean;

    }> = (props) => {

        const handleItemClick = () => {
            dispatcher.dispatch<typeof Actions.WidgetFeatItemClick>({
                name: Actions.WidgetFeatItemClick.name,
                payload: {
                    widgetId: props.widgetId,
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
        widgetId:string;
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
                    {List.empty(props.data) ?
                        <tr><td colSpan={2}>N/A</td></tr> :
                        List.map(
                            (item, i) => (
                                <TRFeaturedItem widgetId={props.widgetId} key={item.id} data={item}
                                    isActive={i === props.activeIdx} />
                            ),
                            props.data
                        )
                    }
                </tbody>
            </table>
        );
    }

    // ------------------------- <StarComponent /> ------------------------

    const StarComponent:React.FC<{
        widgetId:string;
        currFavitemId:string;
        isBusy:boolean;

    }> = ({widgetId, currFavitemId, isBusy}) => {

        const renderIcon = () => {
            const style = {width: '1.6em'};
            if (isBusy) {
                return <layoutViews.AjaxLoaderBarImage />;

            } else if (currFavitemId) {
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
            dispatcher.dispatch<typeof Actions.WidgetStarIconClick>({
                name: Actions.WidgetStarIconClick.name,
                payload: {
                    widgetId: widgetId,
                    status: currFavitemId ? false : true,
                    itemId: currFavitemId
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
            <S.TabMenu>
                <a data-func="my-corpora" className={props.activeTab === 0 ? 'current' : null}
                        onClick={clickHandler(0)} data-text={util.translate('defaultCorparch__my_list')}>
                    {util.translate('defaultCorparch__my_list')}
                </a>
                <span className="separ">|</span>
                <a data-func="search" className={props.activeTab === 1 ? 'current' : null}
                        onClick={clickHandler(1)} data-text={util.translate('defaultCorparch__other_corpora')}>
                    {util.translate('defaultCorparch__other_corpora')}
                </a>
                <span className="separ">|</span>
                <a data-func="public-subcorpora" className={props.activeTab === 2 ? 'current' : null}
                    onClick={clickHandler(2)} data-text={util.translate('defaultCorparch__public_subcorpora')}>
                    {util.translate('defaultCorparch__public_subcorpora')}
                </a>
            </S.TabMenu>
        );
    };

    // ----------------------------- <ListsTab /> -------------------------------

    const ListsTab:React.FC<{
        widgetId:string;
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
                    dispatcher.dispatch<typeof Actions.WidgetMoveFocusToNextListItem>({
                        name: Actions.WidgetMoveFocusToNextListItem.name,
                        payload: {
                            widgetId: props.widgetId,
                            change: argMap[evt.key]
                        }
                    });
                    evt.preventDefault();
                    evt.stopPropagation();
                break;
                case Keyboard.Value.ENTER:
                    dispatcher.dispatch<typeof Actions.WidgetEnterOnActiveListItem>({
                        name: Actions.WidgetEnterOnActiveListItem.name,
                        payload: {widgetId: props.widgetId},
                    });
                    evt.preventDefault();
                    evt.stopPropagation();
                break;
            }
        };

        return (
            <div className="tables" onKeyDown={handleKeyDown}
                    tabIndex={-1} ref={item => item ? item.focus() : null}>
                <FavoritesBox widgetId={props.widgetId} data={props.dataFav}
                        anonymousUser={props.anonymousUser}
                        activeIdx={props.activeListItem[0] === 0 ?
                            props.activeListItem[1] : null} />
                <FeaturedBox widgetId={props.widgetId} data={props.dataFeat}
                        activeIdx={props.activeListItem[0] === 1 ?
                            props.activeListItem[1] : null} />
            </div>
        );
    };

    // -------------------------- <SearchKeyword /> ---------------------

    const SearchKeyword:React.FC<{
        widgetId:string;
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
                    widgetId: props.widgetId,
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

    const ResetKeyword:React.FC<{widgetId:string}> = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch<typeof Actions.KeywordResetClicked>({
                name: Actions.KeywordResetClicked.name,
                payload: {
                    widgetId: props.widgetId
                }
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
        widgetId:string;
        value:string;
        handleTab?:()=>void;

    }> = (props) => {

        const handleInput = (evt) => {
            dispatcher.dispatch<typeof Actions.WidgetSearchInputChanged>({
                name: Actions.WidgetSearchInputChanged.name,
                payload: {
                    widgetId: props.widgetId,
                    value: evt.target.value
                }
            });
        };

        const handleKeyDown = (evt) => {

            switch (evt.key) {
                case Keyboard.Value.DOWN_ARROW:
                case Keyboard.Value.UP_ARROW:
                    dispatcher.dispatch<typeof Actions.WidgetFocusSearchRow>({
                        name: Actions.WidgetFocusSearchRow.name,
                        payload: {
                            widgetId: props.widgetId,
                            inc: evt.key === Keyboard.Value.DOWN_ARROW ? 1 : -1
                        }
                    });
                    evt.stopPropagation();
                    evt.preventDefault();
                break;
                case Keyboard.Value.ENTER:
                    dispatcher.dispatch<typeof Actions.WidgetFocusedItemSelect>({
                        name: Actions.WidgetFocusedItemSelect.name,
                        payload: {widgetId: props.widgetId},
                    });
                    evt.stopPropagation();
                    evt.preventDefault();
                break;
                case Keyboard.Value.TAB:
                    if (props.handleTab) {
                        props.handleTab();
                        evt.stopPropagation();
                        evt.preventDefault();
                    }
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
        widgetId:string;
        data:SearchResultRow;
        hasFocus:boolean;

    }> = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch<typeof Actions.WidgetSearchResultItemClicked>({
                name: Actions.WidgetSearchResultItemClicked.name,
                payload: {
                    widgetId: props.widgetId,
                    itemId: props.data.id,
                }
            });
            evt.stopPropagation();
            evt.preventDefault();
        };

        return (
            <S.TTSuggestion className={props.hasFocus ? ' focus' : ''}>
                <a onClick={handleClick}>
                    {props.data.name}
                </a>
                {props.data.size > 0 ?
                    <span className="metadata">
                        (<span className="label">{util.translate('global__size')}:</span>
                        <span>{props.data.size_info}</span>
                        { props.data.found_in.length > 0 ?
                            <>
                                ,{'\u00a0'}<span className="label">{util.translate('defaultCorparch__found_in')}:</span>
                                <span>{props.data.found_in.map(foundIn => util.translate(foundIn))}</span>
                            </>
                        : null
                        }
                        )
                    </span> :
                    null
                }
            </S.TTSuggestion>
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
        widgetId:string;
        availSearchKeywords:Array<SearchKeyword>;
        isWaitingForSearchResults:boolean;
        currSearchResult:Array<SearchResultRow>;
        currSearchPhrase:string;
        hasSelectedKeywords:boolean;
        focusedRowIdx:number;
        handleTab?:()=>void;

    }> = (props) => {
        return (
            <S.SearchTab>
                <div>
                    {List.map(
                        item => <SearchKeyword widgetId={props.widgetId} key={item.id} {...item} />,
                        props.availSearchKeywords
                    )}
                    {props.hasSelectedKeywords ? <ResetKeyword widgetId={props.widgetId}/> : null}
                    {List.empty(props.availSearchKeywords) ?
                        null :
                        <div className="labels-hint">
                            {util.translate('defaultCorparch__hold_ctrl_for_multiple')}
                        </div>
                    }
                </div>
                <div className="autocomplete-wrapper">
                    <div className="input-wrapper">
                        <SearchInput widgetId={props.widgetId} value={props.currSearchPhrase} handleTab={props.handleTab} />
                    </div>
                    <SearchLoaderBar isActive={props.isWaitingForSearchResults} />
                </div>
                {props.currSearchResult.length > 0 ?
                    <S.TTMenu>
                        <ul className="tt-search-list">
                            {props.currSearchResult.map((item, i) =>
                                    <SearchResultRow widgetId={props.widgetId} key={item.id} data={item}
                                            hasFocus={i === props.focusedRowIdx} />)}
                        </ul>
                    </S.TTMenu> :
                    null
                }
            </S.SearchTab>
        );
    };

    // ----------------------------- <CorpusButton /> --------------------------

    interface CorpusButtonProps {
        corpusIdent:Kontext.FullCorpusIdent;
        isBusy:boolean;
        isWidgetVisible:boolean;
        onClick:()=>void;
    }

    const CorpusButton:React.FC<CorpusButtonProps> = (props) => {

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

    // ------------------------- <CorplistWidget /> -------------------------------

    const CorplistWidget:React.FC<{widgetId:string}> = (props) => {

        const state = useModel(widgetModel);

        const _handleKeypress = (evt) => {
            if (state.isVisible) {
                switch (evt.key) {
                    case Keyboard.Value.TAB:
                        _handleTabSwitch((state.activeTab + 1)  % 3);
                        evt.preventDefault();
                        evt.stopPropagation();
                    break;
                    case Keyboard.Value.ESC:
                        _handleCloseClick();
                        evt.preventDefault();
                        evt.stopPropagation();
                    break;
                }
            }
        }

        const _handleOnShow = () => {
            dispatcher.dispatch<typeof Actions.WidgetShow>({
                name: Actions.WidgetShow.name,
                payload: {
                    widgetId: props.widgetId
                }
            });
        }

        const _handleCloseClick = () => {
            dispatcher.dispatch<typeof Actions.WidgetHide>({
                name: Actions.WidgetHide.name,
                payload: {
                    widgetId: props.widgetId
                }
            });
        }

        const _handleWidgetButtonClick = () => {
            if (state.isVisible) {
                _handleCloseClick();

            } else {
                _handleOnShow();
            }
        }

        const _handleTabSwitch = (v:number) => {
            dispatcher.dispatch<typeof Actions.WidgetSetActiveTab>({
                name: Actions.WidgetSetActiveTab.name,
                payload: {
                    widgetId: props.widgetId,
                    value: v,
                }
            });
        }

        const _handleAreaClick = () => {
            dispatcher.dispatch<typeof Actions.WidgetSetActiveTab>({
                name: Actions.WidgetSetActiveTab.name,
                payload: {
                    widgetId: props.widgetId,
                    value: state.activeTab,
                }
            });
        }

        const renderActiveWidget = () => {
            switch (state.activeTab) {
                case 0:
                    return <ListsTab widgetId={props.widgetId}
                            dataFav={state.dataFav} dataFeat={state.dataFeat}
                            anonymousUser={state.anonymousUser}
                            activeListItem={state.activeListItem} />;
                case 1:
                    return <SearchTab widgetId={props.widgetId}
                            availSearchKeywords={state.availSearchKeywords}
                            isWaitingForSearchResults={state.isWaitingForSearchResults}
                            currSearchResult={state.currSearchResult}
                            currSearchPhrase={state.currSearchPhrase}
                            hasSelectedKeywords={List.find(
                                x => x.selected, state.availSearchKeywords) !== undefined}
                            focusedRowIdx={state.focusedRowIdx} />
                case 2:
                    return <SubcorpWidget widgetId={props.widgetId} />
                default:
                    return null;
            }
        }

        const _renderWidget = () => {
            return (
                <layoutViews.PopupBox customClass="active-widget"
                        onCloseClick={_handleCloseClick}
                        onAreaClick={_handleAreaClick}
                        keyPressHandler={_handleKeypress}
                        customStyle={{
                            minHeight: '12em',
                            minWidth: '50em',
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '0.7em 0 0 0'
                        }}
                        >
                    <TabMenu onItemClick={_handleTabSwitch} activeTab={state.activeTab}
                                onEscKey={_handleCloseClick} />
                    <div className="contents">
                        {renderActiveWidget()}
                    </div>
                    <div className="footer">
                        <span>
                            {util.translate('defaultCorparch__hit_tab_to_cycle_sections')}
                        </span>
                    </div>
                </layoutViews.PopupBox>
            );
        }

        return (
            <S.CorplistWidget>
                <div>
                    <CorpusButton
                        corpusIdent={state.corpusIdent}
                        onClick={_handleWidgetButtonClick}
                        isWidgetVisible={state.isVisible}
                        isBusy={state.isBusyButton} />
                    {state.isVisible ? _renderWidget() : null}
                    {state.availableSubcorpora.length > 0 ?
                        (<span>
                            <strong className="subc-separator">{'\u00a0/\u00a0'}</strong>
                            <SubcorpSelection
                                widgetId={props.widgetId}
                                    corpusName={state.corpusIdent.id}
                                    currSubcorpus={state.corpusIdent.usesubcorp}
                                    subcName={state.corpusIdent.subcName}
                                    availSubcorpora={state.availableSubcorpora} />
                            </span>) :
                            null
                    }
                    {!state.anonymousUser ?
                        <StarComponent widgetId={props.widgetId}
                            currFavitemId={state.currFavitemId} isBusy={state.isBusyWidget} /> :
                        null
                    }
                </div>
            </S.CorplistWidget>
        );
    }


    return CorplistWidget;

}