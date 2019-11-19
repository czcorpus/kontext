/*
 * Copyright (c) 2018 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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
import {IActionDispatcher} from 'kombo';
import {Kontext} from '../../types/common';
import {PublicSubcorpListState, PublicSubcorpListModel,
    DataItem, Actions, SearchTypes} from '../../models/subcorp/listPublic';
import { Subscription } from 'rxjs';

export interface Views {
    List:React.ComponentClass<ListProps>;
}

export interface ListProps {

}

export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
        model:PublicSubcorpListModel) {

    const layoutViews = he.getLayoutViews();

    // -------------------------- <SearchTypeSelect /> -------------------

    const SearchTypeSelect:React.SFC<{
        value:string;

    }> = (props) => {

        const handleChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch({
                name: Actions.SET_SEARCH_TYPE,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <label>
                {he.translate('pubsubclist__search_type')}{'\u00a0'}
                <select value={props.value} onChange={handleChange}>
                    <option value={SearchTypes.BY_CODE}>
                        {he.translate('pubsubclist__search_by_code')}
                    </option>
                    <option value={SearchTypes.BY_AUTHOR}>
                        {he.translate('pubsubclist__search_by_author')}
                    </option>
                </select>
            </label>
        );
    };

    // -------------------------- <PropertyPrefixInput /> ----------------

    class QueryInput extends React.PureComponent<{
        value:string;
        minPrefixSize:number;

    }, {}> {

        private inputRef:React.RefObject<HTMLInputElement>;

        constructor(props) {
            super(props);
            this.handleChange = this.handleChange.bind(this);
            this.inputRef = React.createRef();
        }

        handleChange(evt:React.ChangeEvent<HTMLInputElement>) {
            dispatcher.dispatch({
                name: Actions.SET_SEARCH_QUERY,
                payload: {
                    value: evt.target.value
                }
            });
        }

        componentDidMount() {
            if (this.inputRef.current) {
                this.inputRef.current.focus();
            }
        }

        render() {
            return (
                <label>
                    <input className="CodePrefixInput"
                            type="text"
                            value={this.props.value}
                            onChange={this.handleChange}
                            ref={this.inputRef} />
                        {'\u00a0'}<span className="note">
                        ({he.translate('pubsubclist__input_prefix_warn_{min_size}', {min_size: this.props.minPrefixSize})})
                        </span>
                </label>
            );
        }
    }

    // -------------------------- <Filter /> -------------------------

    const Filter:React.SFC<{
        query:string;
        searchType:SearchTypes;
        minQuerySize:number;

    }> = (props) => {

        return (
            <fieldset className="Filter">
                <SearchTypeSelect value={props.searchType} />{'\u00a0'}:{'\u00a0'}
                <QueryInput value={props.query} minPrefixSize={props.minQuerySize} />
            </fieldset>
        );
    };

    // -------------------------- <DetailExpandSwitch /> -----------------------

    const DetailExpandSwitch:React.SFC<{
        expanded:boolean;
        onClick:()=>void;

    }> = (props) => {
        return (
            <a className="DetailExpandSwitch" onClick={props.onClick}
                        title={he.translate('pubsubclist__view_detail')}>
                {props.expanded ?
                    <>
                        <layoutViews.ImgWithMouseover
                            src={he.createStaticUrl('img/sort_desc.svg')}
                            alt={he.translate('global__click_to_expand')} />
                            {he.translate('pubsubclist__view_detail')}:
                    </> :
                    <>
                        <layoutViews.ImgWithMouseover
                            src={he.createStaticUrl('img/next-page.svg')}
                            alt={he.translate('global__click_to_hide')} />
                        {he.translate('pubsubclist__view_detail')}{'\u2026'}
                    </>
                }
            </a>
        );
    };


    // -------------------------- <DataRow /> -------------------------

    class DataRow extends React.Component<{item:DataItem}, {expanded:boolean}> {

        constructor(props) {
            super(props);
            this.state = {expanded: false};
            this._handleExpandAction = this._handleExpandAction.bind(this);
            this._handleUseInQueryButton = this._handleUseInQueryButton.bind(this);
        }

        private _handleExpandAction():void {
            this.setState({expanded: !this.state.expanded});
        }

        private _handleUseInQueryButton():void {
            dispatcher.dispatch({
                name: Actions.USE_IN_QUERY,
                payload: {
                    corpname: this.props.item.corpname,
                    id: this.props.item.ident
                }
            });
        }

        render() {
            return <li className="DataRow">
                <button type="button" className="util-button use-in-query"
                        onClick={this._handleUseInQueryButton}>
                    {he.translate('pubsubclist__use_in_query')}
                </button>
                <h3>
                    {`${this.props.item.corpname} / ${this.props.item.origName}`}
                    {'\u00a0'}<span className="code">({this.props.item.ident})</span>
                </h3>
                <span className="author">
                    {he.translate('pubsubclist__author')}:{'\u00a0'}
                    <strong>{this.props.item.author}</strong><br />
                </span>
                <DetailExpandSwitch expanded={this.state.expanded}
                    onClick={this._handleExpandAction} />
                {this.state.expanded ?
                        <div className="description">
                            <div dangerouslySetInnerHTML={{__html: this.props.item.description}} />
                        </div> :
                    null
                }
            </li>;
        }
    };

    // -------------------------- <DataTable /> -------------------------

    const DataList:React.SFC<{
        hasQuery:boolean;
        data:Immutable.List<DataItem>;

    }> = (props) => {
        if (props.hasQuery) {
            return (
                <ul className="DataList">
                    {props.data.size > 0 ?
                        props.data.map(item => <DataRow key={item.ident} item={item} />) :
                        <li>
                            <p className="no-result">
                                {he.translate('pubsubclist__no_result')}
                            </p>
                        </li>
                    }
                </ul>
            );

        } else {
            return null;
        }
    };

    // -------------------------- <List /> -------------------------

    class List extends React.Component<ListProps, PublicSubcorpListState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
            this.state = model.getState();
        }

        _modelChangeHandler(state:PublicSubcorpListState):void {
            this.setState(state);
        }

        componentDidMount():void {
            this.modelSubscription = model.addListener(this._modelChangeHandler);
        }

        componentWillUnmount():void {
            this.modelSubscription.unsubscribe();
        }

        render() {
            return (
                <div className="List">
                    <form>
                        <Filter searchType={this.state.searchType}
                                query={this.state.searchQuery}
                                minQuerySize={this.state.minQuerySize} />
                    </form>
                    {this.state.isBusy ?
                        <div className="loader"><layoutViews.AjaxLoaderImage /></div> :
                        <DataList data={this.state.data} hasQuery={this.state.searchQuery.length >= this.state.minQuerySize} />
                    }
                    <p className="disclaimer">
                        <img src={he.createStaticUrl('img/info-icon.svg')} alt={he.translate('global__info_icon')} />
                        {he.translate('pubsubclist__operator_disclaimer')}
                    </p>
                </div>
            );
        }
    }

    return {
        List: List
    };

}