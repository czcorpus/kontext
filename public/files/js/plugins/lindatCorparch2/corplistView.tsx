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
import {Kontext} from '../../types/common';
import {CorplistTableModel, CorplistTableModelState, Filters, KeywordInfo} from './corplist';
import { CorplistItem } from './common';
import { CorpusInfoBoxProps } from '../../views/overview';
import { CorpusInfoType } from '../../models/common/layout';
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { pipe, List } from 'cnc-tskit';
import { Actions, ActionName } from './actions';

import * as S from './style';


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
        const link = he.createActionLink('query', [['corpname', props.row.id]]);
        const size = props.row.size_info ? props.row.size_info : '-';
        const pmltq = () => {
            if (props.row.pmltq !== 'no') {
            return <a href={props.row.pmltq} title={"Inspect " + props.row.name + " in PML-TQ"}>
                     <S.LindatPmltqLogo src={he.createStaticUrl('img/syntax-tree-icon.svg')} /></a>
            }
        }
        const tconnect = () => {
            if (props.row.tokenConnect.length > 0) {
            return <span title="Dictionaries are avaliable for this corpus">
                     <S.DictLogo src={he.createStaticUrl('img/book-solid.gif')} /></span>
            }
        }

        const access = () => {
            if (props.row.access.indexOf("anonymous") == -1 && !props.enableUserActions) {
            return <span><S.LockedLogo src={he.createStaticUrl('img/locked.svg')} /></span>
            }
        }

        const download = () => {
            if (props.row.access.indexOf("anonymous") == 0 && props.row.repo !== 'no') {
            return <a href={props.row.repo} title={"Download " + props.row.name}>
                     <S.DownloadLogo src={he.createStaticUrl('img/download-solid.gif')} /></a>
            }
        }

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
                    {pmltq()}
                    {tconnect()}
                    {access()}
                    {download()}
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
            <S.TrLoadMore>
                <td colSpan={5}>
                    <a onClick={linkClickHandler}>{he.translate('global__load_more')}</a>
                </td>
            </S.TrLoadMore>
        );
    };

    // -------------------------------- <CorplistTable /> -----------------

    class CorplistTable extends React.Component<CorplistTableProps & CorplistTableModelState> {

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
                name: ActionName.CorpusInfoClosed,
                payload: {}
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
            let rows = List.map((row, i) => {
                return <CorplistRow key={row.id} row={row}
                                    enableUserActions={!this.props.anonymousUser}
                                    detailClickHandler={this._detailClickHandler} />;
            }, this.props.rows);
            let expansion = null;

            if (this.props.nextOffset) {
                expansion = <ListExpansion offset={this.props.nextOffset} />;
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
            dispatcher.dispatch<Actions.KeywordClicked>({
                name: ActionName.KeywordClicked,
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

    }> = (props) => {

        const handleClickFn = (active) => (e) => {
            e.preventDefault();
            dispatcher.dispatch<Actions.KeywordClicked>({
                name: ActionName.KeywordClicked,
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
                <a className="keyword" href={link}
                        onClick={handleClickFn(true)}>
                    <span className="overlay" style={style} >{props.keyword.label}</span>
                </a>
            );

        } else {
            return (
                <span className="keyword current"
                            onClick={handleClickFn(false)}>
                    <span className="overlay" style={style}>{props.keyword.label}</span>
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
                name: ActionName.KeywordResetClicked,
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

    }> = (props) => {

        const hasSelectedKeywords = () => {
            return props.keywords.some(v => v.selected);
        };

        return (
            <fieldset className="keywords">
                <legend>{props.label}</legend>
                {pipe(
                    props.keywords,
                    List.filter(v => v.visible),
                    List.map((keyword, i) => <KeywordLink key={i} keyword={keyword} />)
                )}
                {hasSelectedKeywords() ? <ResetLink  /> : null}
                <div className="inline-label hint">
                    ({he.translate('defaultCorparch__hold_ctrl_for_multiple')})
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

    }> = (props) => {

        const changeHandler = (e) => {
            dispatcher.dispatch<Actions.FilterChanged>({
                name: ActionName.FilterChanged,
                payload: {minSize: e.target.value}
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

    }> = (props) => {

        const changeHandler = (e) => {
            dispatcher.dispatch<Actions.FilterChanged>({
                name: ActionName.FilterChanged,
                payload: {maxSize: e.target.value}
            });
        };

        return <input className="min-max" type="text"
                        value={props.value}
                        onChange={changeHandler} />;
    };

        // -------------------------------- <SortBySizeCheckbox /> -----------------

    /**
     * An input to specify sorting by corpus size
     */
    class SortBySizeCheckbox extends React.Component<{
    },
    {
        sortBySize:boolean;
    }> {

        constructor(props) {
            super(props);
            this.state = {
              sortBySize: false,
            };
            this._changeHandler = this._changeHandler.bind(this);
        }

        _changeHandler(e) {
            const value = e.target.checked ? "size" : "name";
            this.setState({
              sortBySize: !this.state.sortBySize
            });
            dispatcher.dispatch<Actions.FilterChanged>({
                name: ActionName.FilterChanged,
                payload: {sortBySize: value}
            });
        };

        render() {
            return <input className="sortBySizeCheckbox" type="checkbox"
                          name="sortBySize"
                          checked={this.state.sortBySize}
                          onChange={this._changeHandler}/>;
        }
    };

    // -------------------------------- <NameSearchInput /> -----------------

    class NameSearchInput extends React.PureComponent<{
        value:string;

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
                    payload: {corpusName: value}
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
                            <MinSizeInput value={this.props.filters.minSize}  />
                            <span className="inline-label">{he.translate('defaultCorparch__size_to')}: </span>
                            <MaxSizeInput value={this.props.filters.maxSize}  />
                            <div className="hint">
                                {'(' + he.translate('defaultCorparch__you_can_use_suffixes_size') + ')'}
                            </div>
                            <p>
                                <span>
                                {he.translate('defaultCorparch__corpus_name_input_label')}: </span>
                                <NameSearchInput value={this.props.filters.name} />
                            </p>
                            <p>
                                <SortBySizeCheckbox/> Sort by size
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
    class FilterForm extends React.Component<FilterFormProps & CorplistTableModelState> {

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
                        label={he.translate('defaultCorparch__keywords_field_label')} />
                    <FilterInputFieldset
                        filters={this.props.filters} />
                </section>
            )
        }
    }

    return {
        CorplistTable: BoundWithProps<CorplistTableProps, CorplistTableModelState>(CorplistTable, listModel),
        CorplistHeader: CorplistHeader,
        FilterForm: BoundWithProps<FilterFormProps, CorplistTableModelState>(FilterForm, listModel),
        FavStar: FavStar,
        CorpKeywordLink: CorpKeywordLink
    };
}
