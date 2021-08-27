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

import * as React from 'react';
import { IActionDispatcher, Bound } from 'kombo';
import { Actions } from '../actions';
import { pipe, List } from 'cnc-tskit';

import * as Kontext from '../../../types/kontext';
import { CorplistTableModel, CorplistTableModelState, KeywordInfo } from '../corplist';
import { CorplistItem, Filters } from '../common';
import { CorpusInfoBoxProps } from '../../../views/overview';
import { CorpusInfoType } from '../../../models/common/layout';
import * as S from './style';
import * as S2 from '../commonStyle';


export interface CorplistViews {

    CorplistTable:React.ComponentClass<{}, CorplistTableModelState>;

    CorplistHeader:React.FC<{

    }>;

    FilterForm:React.ComponentClass<{}, CorplistTableModelState>;

    FavStar:React.FC<{
        corpusId:string;
        corpusName:string;
        favId:string;
    }>;

    CorpKeywordLink:React.FC<{
        keyword:string;
        label:string;
    }>;
}

export interface CorplistViewModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    CorpusInfoBox:React.FC<CorpusInfoBoxProps>;
    listModel:CorplistTableModel;
}


export function init({dispatcher, he, CorpusInfoBox, listModel}:CorplistViewModuleArgs):CorplistViews {

    const layoutViews = he.getLayoutViews();

    // ---------------------------------------------------------------------
    // -------------------------- dataset components -----------------------
    // ---------------------------------------------------------------------

    // -------------------------------- <CorplistHeader /> -----------------


    const CorplistHeader:React.FC<{}> = (props) => {

        return (
            <tr>
                <th>{he.translate('defaultCorparch__corpus_name')}</th>
                <th>{he.translate('defaultCorparch__size_in_positions')}</th>
                <th>{he.translate('defaultCorparch__corpus_labels')}</th>
                <th></th>
                <th></th>
            </tr>
        );
    };

    // -------------------------------- <FavStar /> -----------------

    const FavStar:CorplistViews['FavStar'] = (props) => {

        const handleClick = () => {
            dispatcher.dispatch<typeof Actions.ListStarClicked>({
                name: Actions.ListStarClicked.name,
                payload: {
                    corpusId: props.corpusId,
                    favId: props.favId
                }
            });
        };
        const imgUrl = props.favId !== null ?
            he.createStaticUrl('img/starred.svg') :
            he.createStaticUrl('img/starred_grey.svg');
        return <img className="starred" src={imgUrl} onClick={handleClick} />;
    };

    // -------------------------------- <CorplistRow /> -----------------

    /**
     * A single dataset row
     */
    const CorplistRow:React.FC<{
        enableUserActions:boolean;
        row:CorplistItem;
        detailClickHandler:(corpId:string)=>void;

    }> = (props) => {
        const renderFavStar = () => {
            if (props.enableUserActions) {
                return <FavStar corpusId={props.row.id}
                                    corpusName={props.row.name}
                                    favId={props.row.fav_id} />;

            } else {
                return null;
            }
        };

        const handleDetailClick = (corpusId, evt) => {
            props.detailClickHandler(corpusId);
        };

        const keywords = props.row.keywords.map((k, i) => {
            return <CorpKeywordLink key={i} keyword={k[0]} label={k[1]} />;
        });
        const link = he.createActionLink('query', {corpname: props.row.id});
        const size = props.row.size_info ? props.row.size_info : '-';

        return (
            <tr>
                <td className="corpname">
                    <a href={link}>
                        {props.row.name}
                    </a>
                </td>
                <td className="num">
                    {size}
                </td>
                <td>
                    {keywords}
                </td>
                <td>
                    {renderFavStar()}
                </td>
                <td>
                    <p className="desc" style={{display: 'none'}}></p>
                    <a className="detail" onClick={handleDetailClick.bind(null, props.row.id)}>
                        {he.translate('defaultCorparch__corpus_details')}
                    </a>
                </td>
            </tr>
        );
    };

    // -------------------------------- <ListExpansion /> -----------------

    /**
     * Provides a link allowing to load more items with current
     * query and filter settings.
     */
    const ListExpansion:React.FC<{
        offset:number;

    }> = (props) => {

        const linkClickHandler = () => {
            dispatcher.dispatch<typeof Actions.ExpansionClicked>({
                name: Actions.ExpansionClicked.name,
                payload: {
                    offset: props.offset
                }
            });
        };
        return (
            <tr className="load-more">
                <td colSpan={5}>
                    <a onClick={linkClickHandler}>{he.translate('global__load_more')}</a>
                </td>
            </tr>
        );
    };

    // -------------------------------- <CorplistTable /> -----------------

    class CorplistTable extends React.PureComponent<CorplistTableModelState> {

        constructor(props) {
            super(props);
            this._detailClickHandler = this._detailClickHandler.bind(this);
            this._detailCloseHandler = this._detailCloseHandler.bind(this);
        }

        _detailClickHandler(corpusId) {
            dispatcher.dispatch<typeof Actions.CorpusInfoRequired>({
                name: Actions.CorpusInfoRequired.name,
                payload: {
                    corpusId: corpusId
                }
            });
        }

        _detailCloseHandler() {
            dispatcher.dispatch<typeof Actions.CorpusInfoClosed>({
                name: Actions.CorpusInfoClosed.name
            });
        }

        _renderDetailBox() {
            if (this.props.detailData) {
                return (
                    <layoutViews.PopupBox
                            onCloseClick={this._detailCloseHandler}
                            customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}
                            takeFocus={true}>
                        <CorpusInfoBox data={{...this.props.detailData, type:CorpusInfoType.CORPUS}}
                                    isWaiting={this.props.isBusy} />
                    </layoutViews.PopupBox>
                );

            } else {
                return null;
            }
        }

        render() {
            const rows = List.map(
                (row, i) => <CorplistRow key={row.id} row={row}
                                    enableUserActions={!this.props.anonymousUser}
                                    detailClickHandler={this._detailClickHandler} />,
                this.props.rows
            );
            const expansion = this.props.nextOffset ?
                <ListExpansion offset={this.props.nextOffset} /> :
                null;

            return (
                <S.CorplistTable>
                    {this._renderDetailBox()}
                    <table className="data corplist">
                        <tbody>
                            <CorplistHeader />
                            {rows}
                            {expansion}
                        </tbody>
                    </table>
                </S.CorplistTable>
            );
        }
    }

    // -------------------------------- <CorpKeywordLink /> -----------------

    /**
     * a single keyword link shown within a dataset table row
     */
    const CorpKeywordLink:CorplistViews['CorpKeywordLink'] = (props) => {

        const handleClick = (e) => {
            e.preventDefault();
            dispatcher.dispatch<typeof Actions.KeywordClicked>({
                name: Actions.KeywordClicked.name,
                payload: {
                    keywordId: props.keyword,
                    status: true,
                    attachToCurrent: e.ctrlKey || e.metaKey
                }
            });
        };

        return (
            <S2.KeywordLink onClick={handleClick}>
                <span className="overlay">{props.label}</span>
            </S2.KeywordLink>
        );
    };

    // ------------------------------------------------------------------
    // -------------------------- form components -----------------------
    // ------------------------------------------------------------------

    // -------------------------------- <KeywordLink /> -----------------

    /**
     * A keyword link from the filter form
     */
    const KeywordLink:React.FC<{
        keyword:KeywordInfo;
        iconFile?:string;

    }> = (props) => {

        const handleClickFn = (active) => (e) => {
            e.preventDefault();
            dispatcher.dispatch<typeof Actions.KeywordClicked>({
                name: Actions.KeywordClicked.name,
                payload: {
                    keywordId: props.keyword.ident,
                    status: active,
                    attachToCurrent: e.ctrlKey || e.metaKey
                }
            });
        };

        const style = props.keyword.color && !props.keyword.selected ? {backgroundColor: props.keyword.color} : null;
        if (!props.keyword.selected) {
            const link = he.createActionLink('corplist', {keyword: props.keyword.ident});
            return (
                <S2.KeywordLink className={props.iconFile ? ' iconized' : ''} href={link}
                        onClick={handleClickFn(true)}>
                    <span className="overlay" style={style}>
                        {props.iconFile ? <img className="icon" src={props.iconFile} /> : null}
                        {props.keyword.label}
                    </span>
                </S2.KeywordLink>
            );

        } else {
            return (
                <S2.KeywordLink className={props.iconFile ? 'selected iconized' : 'selected'}
                            onClick={handleClickFn(false)}>
                    <span className="overlay" style={style}>
                        {props.iconFile ? <img className="icon" src={props.iconFile} /> : null}
                        {props.keyword.label}
                    </span>
                </S2.KeywordLink>
            );
        }
    }

    // -------------------------------- <ResetLink /> -----------------

    /**
     * A keyword-like link to reset currently set keywords
     */
    const ResetLink:React.FC<{

    }> = (props) => {

        const handleClick = (e) => {
            e.preventDefault();
            dispatcher.dispatch<typeof Actions.KeywordResetClicked>({
                name: Actions.KeywordResetClicked.name
            });
        };

        return (
            <a className="reset" onClick={handleClick}>
                {he.translate('defaultCorparch__no_keyword')}
            </a>
        );
    };

    // -------------------------------- <KeywordsField /> -----------------

    /**
     * A form fieldset containing all the available keywords
     */
    const KeywordsField:React.FC<{
        label:string;
        keywords:Array<KeywordInfo>;
        favouritesOnly:boolean;
        anonymousUser:boolean;
    }> = (props) => {

        const hasSelectedKeywords = () => {
            return List.some(v => v.selected, props.keywords);
        };

        return (
            <layoutViews.ExpandableArea initialExpanded={true} alwaysExpanded={true} label={props.label}>
                <fieldset className="keywords">
                    <div className="buttons">
                        {!props.anonymousUser ?
                            <KeywordLink
                                key={'favorites'}
                                keyword={{
                                    ident: 'favourites',
                                    label: he.translate('defaultCorparch__favourites_filter_label'),
                                    color: 'transparent',
                                    visible: true,
                                    selected: props.favouritesOnly}}
                                iconFile={he.createStaticUrl('img/starred.svg')} /> :
                            null
                        }
                        {pipe(
                            props.keywords,
                            List.filter(v => v.visible),
                            List.map(
                                (keyword, i) => <KeywordLink key={i} keyword={keyword} />
                            )
                        )}
                        {hasSelectedKeywords() || props.favouritesOnly ? <ResetLink  /> : null}
                        <div className="inline-label hint">
                            ({he.translate('defaultCorparch__hold_ctrl_for_multiple')})
                        </div>
                    </div>
                </fieldset>
            </layoutViews.ExpandableArea>
        );
    };

    // -------------------------------- <MinSizeInput /> -----------------

    /**
     * An input to specify minimum corpus size
     */
    const MinSizeInput:React.FC<{
        value:string;
        currFilter:Filters;

    }> = (props) => {

        const changeHandler = (e) => {
            dispatcher.dispatch<typeof Actions.FilterChanged>({
                name: Actions.FilterChanged.name,
                payload: {...props.currFilter, minSize: e.target.value}
            });
        };

        return <input className="min-max" type="text"
                    value={props.value}
                    onChange={changeHandler} />;
    };

    // -------------------------------- <MaxSizeInput /> -----------------

    /**
     * An input to specify maximum corpus size
     */
    const MaxSizeInput:React.FC<{
        value:string;
        currFilter:Filters;

    }> = (props) => {

        const changeHandler = (e) => {
            dispatcher.dispatch<typeof Actions.FilterChanged>({
                name: Actions.FilterChanged.name,
                payload: {
                    ...props.currFilter,
                    maxSize: e.target.value
                }
            });
        };

        return <input className="min-max" type="text"
                        value={props.value}
                        onChange={changeHandler} />;
    };

    // -------------------------------- <NameSearchInput /> -----------------

    class NameSearchInput extends React.PureComponent<{
        value:string;
        currFilter:Filters;

    }> {

        private _timer:number;

        constructor(props) {
            super(props);
            this._timer = null;
            this._changeHandler = this._changeHandler.bind(this);
        }

        _changeHandler(e) {
            if (this._timer) {
                window.clearTimeout(this._timer);
            }
            this._timer = window.setTimeout(((value) => () => {
                dispatcher.dispatch<typeof Actions.FilterChanged>({
                    name: Actions.FilterChanged.name,
                    payload: {
                        ...this.props.currFilter,
                        corpusName: value
                    }
                });
                window.clearTimeout(this._timer);
            })(e.target.value), 300);
        }

        render() {
            return <input type="text" defaultValue={this.props.value} onChange={this._changeHandler} />;
        }
    }

    // -------------------------------- <FilterInputFieldset /> -----------------

    /**
     * A fieldset containing non-keyword filter inputs.
     */
    const FilterInputFieldset:React.FC<{
        filters:Filters;
    }> = (props) => (
        <div className="advanced-filter">
            <layoutViews.ExpandableArea initialExpanded={true}
                    label={he.translate('defaultCorparch__advanced_filters')}>
                <fieldset>
                    <span>{he.translate('defaultCorparch__size_from')}: </span>
                    <MinSizeInput value={props.filters.minSize} currFilter={props.filters}  />
                    <span className="inline-label">{he.translate('defaultCorparch__size_to')}: </span>
                    <MaxSizeInput value={props.filters.maxSize} currFilter={props.filters}  />
                    <div className="hint">
                        {'(' + he.translate('defaultCorparch__you_can_use_suffixes_size') + ')'}
                    </div>
                    <p>
                        <span>
                        {he.translate('defaultCorparch__corpus_name_input_label')}: </span>
                        <NameSearchInput value={props.filters.name} currFilter={props.filters} />
                    </p>
                </fieldset>
            </layoutViews.ExpandableArea>
        </div>
    );

    // -------------------------------- <FilterForm /> -----------------

    /**
     * Filter form root component
     */
    class FilterForm extends React.PureComponent<CorplistTableModelState> {

        _renderLoader() {
            if (this.props.isBusy) {
                return <img className="ajax-loader" src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                                alt={he.translate('global__loading')} title={he.translate('global__loading')} />;

            } else {
                return null;
            }
        }

        render() {
            return (
                <S.FilterForm className="inner">
                    <div style={{height: '1em'}}>
                        {this._renderLoader()}
                    </div>
                    <KeywordsField
                        keywords={this.props.keywords}
                        label={he.translate('defaultCorparch__keywords_field_label')}
                        favouritesOnly={this.props.favouritesOnly}
                        anonymousUser={this.props.anonymousUser}/>
                    <FilterInputFieldset
                        filters={this.props.filters} />
                </S.FilterForm>
            )
        }
    }

    return {
        CorplistTable: Bound(CorplistTable, listModel),
        CorplistHeader,
        FilterForm: Bound(FilterForm, listModel),
        FavStar,
        CorpKeywordLink
    };
}