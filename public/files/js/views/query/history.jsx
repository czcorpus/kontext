/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
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

import * as React from 'vendor/react';
import {init as inputInit} from './input';


export function init(dispatcher, utils, layoutViews, queryHistoryStore) {

    // -------------------- <QueryTypeSelector /> ------------------------

    const QueryTypeSelector = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'QUERY_STORAGE_SET_QUERY_TYPE',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <select value={props.value} onChange={handleChange}>
                <option value="">
                    {utils.translate('qhistory__sel_anytime')}
                </option>
                <option value="iquery">
                    {utils.translate('query__qt_basic')}
                </option>
                <option value="lemma">
                    {utils.translate('query__qt_lemma')}
                </option>
                <option value="phrase">
                    {utils.translate('query__qt_phrase')}
                </option>
                <option value="word">
                    {utils.translate('query__qt_word_form')}
                </option>
                <option value="char">
                    {utils.translate('query__qt_word_part')}
                </option>
                <option value="cql">
                    {utils.translate('query__qt_cql')}
                </option>
            </select>
        );
    };

    // -------------------- <CurrentCorpCheckbox /> ------------------------

    const CurrentCorpCheckbox = (props) => {

        const handleChange = () => {
            dispatcher.dispatch({
                actionType: 'QUERY_STORAGE_SET_CURRENT_CORPUS_ONLY',
                props: {
                    value: !props.value
                }
            });
        };

        return <input type="checkbox" checked={props.value} onChange={handleChange}
                    style={{verticalAlign: 'middle'}} />;
    }


    // -------------------- <FilterForm /> ------------------------

    const FilterForm = (props) => {
        return (
            <form className="query-history-filter">
                <fieldset>
                    <legend>
                        {utils.translate('qhistory__filter_legend')}
                    </legend>
                    <label>
                        {utils.translate('qhistory__curr_corp_only_label')}:{'\u00a0'}
                        <CurrentCorpCheckbox value={props.currentCorpusOnly} />
                    </label>
                    {'\u00a0'}
                    <label>
                        {utils.translate('qhistory__query_type_sel')}:{'\u00a0'}
                        <QueryTypeSelector value={props.queryType} />
                    </label>
                </fieldset>
            </form>
        );
    };

    // -------------------- <TRDataHeading /> ------------------------

    const TRDataHeading = (props) => {
        return (
            <tr>
                <th />
                <th>
                    {utils.translate('qhistory__th_query')}
                </th>
                <th>
                    {utils.translate('qhistory__th_corpus')}
                </th>
                <th>
                    {utils.translate('qhistory__th_query_type')}
                </th>
                <th>
                    {utils.translate('qhistory__th_datetime')}
                </th>
                <th></th>
            </tr>
        );
    };

    // -------------------- <DataRow /> ------------------------

    const DataRow = (props) => {

        const handleFormClick = () => {
            // (corpusId:string, queryType:string, query
            dispatcher.dispatch({
                actionType: 'QUERY_STORAGE_OPEN_QUERY_FORM',
                props: {
                    corpusId: props.data.corpname,
                    queryType: props.data.query_type,
                    query: props.data.query
                }
            });
        };

        return (
            <tr className="data-item">
                <td className="num">
                    {props.idx + 1}.
                </td>
                <td>
                    <div className="query" title={props.data.query}>{props.data.query}</div>
                    <div className="details">{props.data.details}</div>
                </td>
                <td className="corpname">
                    {props.data.humanCorpname}
                </td>
                <td>
                    {props.data.query_type_translated}
                </td>
                <td className="date">
                    {props.data.created[0]}
                    <strong>{props.data.created[1]}</strong>
                </td>
                <td>
                    <a onClick={handleFormClick}>
                        {utils.translate('qhistory__open_in_form')}
                    </a>
                </td>
            </tr>
        );
    };

    // -------------------- <LoadMoreLink /> ------------------------

    const TRLoadMoreLink = (props) => {

        const handleClick = () => {
            dispatcher.dispatch({
                actionType: 'QUERY_STORAGE_LOAD_MORE',
                props: {}
            });
        };

        return (
            <tr className="last-row">
                <td colSpan="7">
                    <a onClick={handleClick}>
                        {props.storeIsBusy ?
                        (<img src={utils.createStaticUrl('img/ajax-loader.gif')}
                                alt={utils.translate('global__loading')} />) :
                        <span>{utils.translate('qhistory__load_more_link')}</span>
                        }
                    </a>
                </td>
            </tr>
        );
    }

    // -------------------- <DataTable /> ------------------------

    const DataTable = (props) => {
        return (
            <table className="data">
                <tbody>
                    <TRDataHeading />
                    {props.data.map((item, i) => <DataRow key={i + props.offset} idx={i + props.offset} data={item} />)}
                    <TRLoadMoreLink storeIsBusy={props.storeIsBusy} />
                </tbody>
            </table>
        );
    };

    // -------------------- <RecentQueriesPageList /> ------------------------

    class RecentQueriesPageList extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchStoreState();
            this._handleStoreChange = this._handleStoreChange.bind(this);
        }

        _fetchStoreState() {
            return {
                queryType: queryHistoryStore.getQueryType(),
                currentCorpusOnly: queryHistoryStore.getCurrentCorpusOnly(),
                offset: queryHistoryStore.getOffset(),
                data: queryHistoryStore.getData(),
                storeIsBusy: queryHistoryStore.getIsBusy()
            };
        }

        _handleStoreChange() {
            this.setState(this._fetchStoreState());
        }

        componentDidMount() {
            queryHistoryStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            queryHistoryStore.removeChangeListener(this._handleStoreChange);
        }

        render() {
            return (
                <div className="RecentQueriesPageList">
                    <FilterForm queryType={this.state.queryType}
                            currentCorpusOnly={this.state.currentCorpusOnly}
                            storeIsBusy={this.state.storeIsBusy} />
                    <DataTable data={this.state.data} offset={this.state.offset}
                            storeIsBusy={this.state.storeIsBusy} />
                </div>
            );
        }
    }


    return {
        RecentQueriesPageList: RecentQueriesPageList
    };

}