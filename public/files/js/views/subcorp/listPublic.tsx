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
import { IActionDispatcher, Bound } from 'kombo';
import * as Kontext from '../../types/kontext';
import { PublicSubcorpListState, PublicSubcorpListModel } from '../../models/subcorp/listPublic';
import { Actions } from '../../models/subcorp/actions';
import { List } from 'cnc-tskit';

import * as S from './style';
import { SubcorpListItem } from '../../models/subcorp/list';


export interface Views {
    ListPublic:React.ComponentClass;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
        model:PublicSubcorpListModel) {

    const layoutViews = he.getLayoutViews();


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
            dispatcher.dispatch<typeof Actions.SetSearchQuery>({
                name: Actions.SetSearchQuery.name,
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

                        </span>
                </label>
            );
        }
    }

    // -------------------------- <Filter /> -------------------------

    const Filter:React.FC<{
        query:string;
        minQuerySize:number;

    }> = (props) => {

        return (
            <S.Filter>
                <QueryInput value={props.query} minPrefixSize={props.minQuerySize} />
                <p className="note">
                    {he.translate('pubsubclist__search_type_{min_size}', {min_size: props.minQuerySize})}
                </p>
            </S.Filter>
        );
    };

    // -------------------------- <DetailExpandSwitch /> -----------------------

    const DetailExpandSwitch:React.FC<{
        expanded:boolean;
        onClick:()=>void;

    }> = (props) => {
        return (
            <S.DetailExpandSwitch onClick={props.onClick}
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
            </S.DetailExpandSwitch>
        );
    };


    // -------------------------- <DataRow /> -------------------------

    class DataRow extends React.Component<{item:SubcorpListItem}, {expanded:boolean}> {

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
            dispatcher.dispatch<typeof Actions.UseInQuery>({
                name: Actions.UseInQuery.name,
                payload: {
                    corpname: this.props.item.corpus_name,
                    id: this.props.item.id
                }
            });
        }

        render() {
            return <S.DataRow>
                <button type="button" className="util-button use-in-query"
                        onClick={this._handleUseInQueryButton}>
                    {he.translate('pubsubclist__use_in_query')}
                </button>
                <h3>
                    {`${this.props.item.corpus_name} / ${this.props.item.name}`}
                </h3>
                <table className="props">
                    <tbody>
                        <tr className="created">
                            <th>{he.translate('global__creation_date')}:</th>
                            <td>{he.formatDate(this.props.item.created)}</td>
                        </tr>
                        <tr className="author">
                            <th>{he.translate('pubsubclist__author')}:</th>
                            <td>{this.props.item.author_fullname}</td>
                        </tr>
                        <tr className="code">
                            <th>{he.translate('subclist__public_code')}:</th>
                            <td>
                                <a href={he.createActionLink(
                                    'query', {
                                        corpname: this.props.item.corpus_name,
                                        usesubcorp: this.props.item.id
                                    })
                                } title={he.translate('pubsubclist__use_in_query')}>
                                    {this.props.item.id}
                                </a>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <DetailExpandSwitch expanded={this.state.expanded}
                    onClick={this._handleExpandAction} />
                {this.state.expanded ?
                        <div className="description">
                            <div dangerouslySetInnerHTML={{__html: this.props.item.public_description}} />
                        </div> :
                    null
                }
            </S.DataRow>;
        }
    };

    // -------------------------- <DataTable /> -------------------------

    const DataList:React.FC<{
        hasQuery:boolean;
        data:Array<SubcorpListItem>;

    }> = (props) => {
        if (props.hasQuery) {
            return (
                <S.DataList>
                    {props.data.length > 0 ?
                        List.map(item => <DataRow key={item.id} item={item} />, props.data) :
                        <li>
                            <p className="no-result">
                                {he.translate('pubsubclist__no_result')}
                            </p>
                        </li>
                    }
                </S.DataList>
            );

        } else {
            return null;
        }
    };

    // -------------------------- <ListPublic /> -------------------------

    const ListPublic:React.FC<PublicSubcorpListState> = (props) => {
        return (
            <S.ListPublic>
                <form>
                    <fieldset>
                        <legend>{he.translate('pubsubclist__filter_legend')}</legend>
                        <Filter query={props.searchQuery}
                            minQuerySize={props.minQuerySize} />
                    </fieldset>
                </form>
                {props.isBusy ?
                    <div className="loader"><layoutViews.AjaxLoaderImage /></div> :
                    <DataList data={props.data} hasQuery={props.searchQuery.length >= props.minQuerySize} />
                }
                <p className="disclaimer">
                    <img src={he.createStaticUrl('img/info-icon.svg')} alt={he.translate('global__info_icon')} />
                    {he.translate('pubsubclist__operator_disclaimer')}
                </p>
            </S.ListPublic>
        );
    }

    return {
        ListPublic: Bound(ListPublic, model)
    };

}