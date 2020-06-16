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
import { IActionDispatcher } from 'kombo';
import { Subscription } from 'rxjs';
import { Actions, ActionName } from './actions';

import { Kontext } from '../../types/common';
import { CorplistTableModel, CorplistTableModelState, KeywordInfo } from './corplist';
import { CorplistItem, Filters } from './common';
import { CorpusInfoBoxProps } from '../../views/overview';
import { CorpusInfoType } from '../../models/common/layout';


export interface CorplistTableProps {
    anonymousUser:boolean;
}

export interface FilterFormProps {
    keywords:Array<[string, string, boolean, string]>;
    filters:{
        name:Array<string>;
        minSize:Array<string>;
        maxSize:Array<string>;
    };
}

export interface CorplistViews {

    CorplistTable:React.ComponentClass<CorplistTableProps>;

    CorplistHeader:React.SFC<{

    }>;

    FilterForm:React.ComponentClass<FilterFormProps>;

    FavStar:React.SFC<{
        corpusId:string;
        corpusName:string;
        favId:string;
    }>;

    CorpKeywordLink:React.SFC<{
        keyword:string;
        label:string;
    }>;
}

export interface CorplistViewModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    CorpusInfoBox:React.SFC<CorpusInfoBoxProps>;
    listModel:CorplistTableModel;
}


export function init({dispatcher, he, CorpusInfoBox, listModel}:CorplistViewModuleArgs):CorplistViews {

    const layoutViews = he.getLayoutViews();

    // ---------------------------------------------------------------------
    // -------------------------- dataset components -----------------------
    // ---------------------------------------------------------------------

    // -------------------------------- <CorplistHeader /> -----------------


    const CorplistHeader:React.SFC<{}> = (props) => {

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
            dispatcher.dispatch({
                name: 'LIST_STAR_CLICKED',
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
    const CorplistRow:React.SFC<{
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
        const link = he.createActionLink('first_form', [['corpname', props.row.id]]);
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
    const ListExpansion:React.SFC<{
        offset:number;

    }> = (props) => {

        const linkClickHandler = () => {
            dispatcher.dispatch<Actions.ExpansionClicked>({
                name: ActionName.ExpansionClicked,
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

    class CorplistTable extends React.Component<CorplistTableProps, CorplistTableModelState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
            this._detailClickHandler = this._detailClickHandler.bind(this);
            this._detailCloseHandler = this._detailCloseHandler.bind(this);
            this.state = listModel.getInitialState();
        }

        _modelChangeHandler(state) {
            this.setState(state);
        }

        _detailClickHandler(corpusId) {
            dispatcher.dispatch({
                name: 'CORPARCH_CORPUS_INFO_REQUIRED',
                payload: {
                    corpusId: corpusId
                }
            });
        }

        _detailCloseHandler() {
            dispatcher.dispatch({
                name: 'CORPARCH_CORPUS_INFO_CLOSED',
                payload: {}
            });
        }

        componentDidMount() {
            this.modelSubscription = listModel.addListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        _renderDetailBox() {
            if (this.state.detailData) {
                return (
                    <layoutViews.PopupBox
                            onCloseClick={this._detailCloseHandler}
                            customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}
                            takeFocus={true}>
                        <CorpusInfoBox data={{...this.state.detailData, type:CorpusInfoType.CORPUS}}
                                    isWaiting={this.state.isBusy} />
                    </layoutViews.PopupBox>
                );

            } else {
                return null;
            }
        }

        render() {
            let rows = this.state.rows.map((row, i) => {
                return <CorplistRow key={row.id} row={row}
                                    enableUserActions={!this.props.anonymousUser}
                                    detailClickHandler={this._detailClickHandler} />;
            });
            let expansion = null;

            if (this.state.nextOffset) {
                expansion = <ListExpansion offset={this.state.nextOffset} />;
            }

            return (
                <div>
                    {this._renderDetailBox()}
                    <table className="data corplist">
                        <tbody>
                            <CorplistHeader />
                            {rows}
                            {expansion}
                        </tbody>
                    </table>
                </div>
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
            dispatcher.dispatch({
                name: 'KEYWORD_CLICKED',
                payload: {
                    keyword: props.keyword,
                    status: true,
                    ctrlKey: e.ctrlKey || e.metaKey
                }
            });
        };

        return (
            <a className="keyword" onClick={handleClick}>
                <span className="overlay">{props.label}</span>
            </a>
        );
    };

    // ------------------------------------------------------------------
    // -------------------------- form components -----------------------
    // ------------------------------------------------------------------

    // -------------------------------- <KeywordLink /> -----------------

    /**
     * A keyword link from the filter form
     */
    const KeywordLink:React.SFC<{
        keyword:KeywordInfo;
        iconFile?:string;

    }> = (props) => {

        const handleClickFn = (active) => (e) => {
            e.preventDefault();
            dispatcher.dispatch({
                name: 'KEYWORD_CLICKED',
                payload: {
                    keyword: props.keyword.ident,
                    status: active,
                    ctrlKey: e.ctrlKey || e.metaKey
                }
            });
        };

        const style = props.keyword.color ? {backgroundColor: props.keyword.color} : null;
        if (!props.keyword.selected) {
            const link = he.createActionLink('corplist', [['keyword', props.keyword.ident]]);
            return (
                <a className={`keyword${props.iconFile ? ' iconized' : ''}`} href={link}
                        onClick={handleClickFn(true)}>
                    <span className="overlay" style={style}>
                        {props.iconFile ? <img className="icon" src={props.iconFile} /> : null}
                        {props.keyword.label}
                    </span>
                </a>
            );

        } else {
            return (
                <span className={`keyword current${props.iconFile ? ' iconized' : ''}`}
                            onClick={handleClickFn(false)}>
                    <span className="overlay" style={style}>
                        {props.iconFile ? <img className="icon" src={props.iconFile} /> : null}
                        {props.keyword.label}
                    </span>
                </span>
            );
        }
    }

    // -------------------------------- <ResetLink /> -----------------

    /**
     * A keyword-like link to reset currently set keywords
     */
    const ResetLink:React.SFC<{

    }> = (props) => {

        const handleClick = (e) => {
            e.preventDefault();
            dispatcher.dispatch({
                name: 'KEYWORD_RESET_CLICKED',
                payload: {}
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
    const KeywordsField:React.SFC<{
        label:string;
        keywords:Array<KeywordInfo>;
        favouritesOnly:boolean;
        anonymousUser:boolean;
    }> = (props) => {

        const hasSelectedKeywords = () => {
            return props.keywords.some(v => v.selected);
        };

        return (
            <fieldset className="keywords">
                <legend>{props.label}</legend>
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
                    {props.keywords.filter(v => v.visible).map((keyword, i) =>
                            <KeywordLink key={i} keyword={keyword} />
                    )}
                    {hasSelectedKeywords() || props.favouritesOnly ? <ResetLink  /> : null}
                    <div className="inline-label hint">
                        ({he.translate('defaultCorparch__hold_ctrl_for_multiple')})
                    </div>
                </div>
            </fieldset>
        );
    };

    // -------------------------------- <MinSizeInput /> -----------------

    /**
     * An input to specify minimum corpus size
     */
    const MinSizeInput:React.SFC<{
        value:string;
        currFilter:Filters;

    }> = (props) => {

        const changeHandler = (e) => {
            dispatcher.dispatch<Actions.FilterChanged>({
                name: ActionName.FilterChanged,
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
    const MaxSizeInput:React.SFC<{
        value:string;
        currFilter:Filters;

    }> = (props) => {

        const changeHandler = (e) => {
            dispatcher.dispatch<Actions.FilterChanged>({
                name: ActionName.FilterChanged,
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
                dispatcher.dispatch<Actions.FilterChanged>({
                    name: ActionName.FilterChanged,
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
    class FilterInputFieldset extends React.Component<{
        filters:Filters;
    },
    {
        expanded:boolean;
    }> {

        constructor(props) {
            super(props);
            this._handleLegendClick = this._handleLegendClick.bind(this);
            this.state = {expanded: false};
        }

        _handleLegendClick() {
            const newState = he.cloneState(this.state);
            newState.expanded = !this.state.expanded;
            this.setState(newState);
        }

        render() {
            let fields;
            let fieldsetClasses;

            if (this.state.expanded) {
                fieldsetClasses = 'advanced-filter';
                fields = (
                    <div>
                        <span>{he.translate('defaultCorparch__size_from')}: </span>
                        <MinSizeInput value={this.props.filters.minSize} currFilter={this.props.filters}  />
                        <span className="inline-label">{he.translate('defaultCorparch__size_to')}: </span>
                        <MaxSizeInput value={this.props.filters.maxSize} currFilter={this.props.filters}  />
                        <div className="hint">
                            {'(' + he.translate('defaultCorparch__you_can_use_suffixes_size') + ')'}
                        </div>
                        <p>
                            <span>
                            {he.translate('defaultCorparch__corpus_name_input_label')}: </span>
                            <NameSearchInput value={this.props.filters.name} currFilter={this.props.filters} />
                        </p>
                    </div>
                );

            } else {
                fieldsetClasses = 'advanced-filter closed';
                fields = null;
            }

            return (
                <fieldset className={fieldsetClasses}>
                    <legend onClick={this._handleLegendClick}>{he.translate('defaultCorparch__advanced_filters')}</legend>
                    {fields}
                </fieldset>
            );
        }
    }

    // -------------------------------- <FilterForm /> -----------------

    /**
     * Filter form root component
     */
    class FilterForm extends React.PureComponent<FilterFormProps & CorplistTableModelState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
        }

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
                <section className="inner">
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
                </section>
            )
        }
    }

    return {
        CorplistTable: CorplistTable,
        CorplistHeader: CorplistHeader,
        FilterForm: FilterForm,
        FavStar: FavStar,
        CorpKeywordLink: CorpKeywordLink
    };
}