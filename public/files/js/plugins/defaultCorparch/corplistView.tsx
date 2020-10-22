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
import { Actions, ActionName } from './actions';
import { pipe, List } from 'cnc-tskit';

import { Kontext } from '../../types/common';
import { CorplistTableModel, CorplistTableModelState, KeywordInfo } from './corplist';
import { CorplistItem, Filters } from './common';
import { CorpusInfoBoxProps } from '../../views/overview';
import { CorpusInfoType } from '../../models/common/layout';
import { Action } from 'rxjs/internal/scheduler/Action';


export interface CorplistViews {

    CorplistTable:React.ComponentClass<{}, CorplistTableModelState>;

    CorplistHeader:React.SFC<{

    }>;

    FilterForm:React.ComponentClass<{}, CorplistTableModelState>;

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
            dispatcher.dispatch<Actions.ListStarClicked>({
                name: ActionName.ListStarClicked,
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

    class CorplistTable extends React.PureComponent<CorplistTableModelState> {

        constructor(props) {
            super(props);
            this._detailClickHandler = this._detailClickHandler.bind(this);
            this._detailCloseHandler = this._detailCloseHandler.bind(this);
        }

        _detailClickHandler(corpusId) {
            dispatcher.dispatch<Actions.CorpusInfoRequired>({
                name: ActionName.CorpusInfoRequired,
                payload: {
                    corpusId: corpusId
                }
            });
        }

        _detailCloseHandler() {
            dispatcher.dispatch<Actions.CorpusInfoClosed>({
                name: ActionName.CorpusInfoClosed
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
            dispatcher.dispatch<Actions.KeywordClicked>({
                name: ActionName.KeywordClicked,
                payload: {
                    keywordId: props.keyword,
                    status: true,
                    attachToCurrent: e.ctrlKey || e.metaKey
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
            dispatcher.dispatch<Actions.KeywordClicked>({
                name: ActionName.KeywordClicked,
                payload: {
                    keywordId: props.keyword.ident,
                    status: active,
                    attachToCurrent: e.ctrlKey || e.metaKey
                }
            });
        };

        const style = props.keyword.color && !props.keyword.selected ? {backgroundColor: props.keyword.color} : null;
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
                <span className={`keyword selected${props.iconFile ? ' iconized' : ''}`}
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
            dispatcher.dispatch<Actions.KeywordResetClicked>({
                name: ActionName.KeywordResetClicked
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
            return List.some(v => v.selected, props.keywords);
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
            return (
                <div className="advanced-filter">
                    <layoutViews.ExpandButton isExpanded={this.state.expanded} onClick={this._handleLegendClick}/>
                    <a onClick={this._handleLegendClick}>{he.translate('defaultCorparch__advanced_filters')}</a>
                    {
                        this.state.expanded ?
                        <fieldset>
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
                        </fieldset> :
                        null
                    }
                </div>
            );
        }
    }

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
        CorplistTable: Bound(CorplistTable, listModel),
        CorplistHeader: CorplistHeader,
        FilterForm: Bound(FilterForm, listModel),
        FavStar: FavStar,
        CorpKeywordLink: CorpKeywordLink
    };
}