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


export function init(dispatcher, he, layoutViews, queryHistoryStore) {

    // -------------------- <QueryTypeSelector /> ------------------------

    const queryTypes = {
        'iquery': he.translate('query__qt_basic'),
        'lemma': he.translate('query__qt_lemma'),
        'phrase': he.translate('query__qt_phrase'),
        'word': he.translate('query__qt_word_form'),
        'char': he.translate('query__qt_word_part'),
        'cql': he.translate('query__qt_cql')
    };

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
                    {he.translate('qhistory__sel_anytime')}
                </option>
                <option value="iquery">
                    {he.translate('query__qt_basic')}
                </option>
                <option value="lemma">
                    {he.translate('query__qt_lemma')}
                </option>
                <option value="phrase">
                    {he.translate('query__qt_phrase')}
                </option>
                <option value="word">
                    {he.translate('query__qt_word_form')}
                </option>
                <option value="char">
                    {he.translate('query__qt_word_part')}
                </option>
                <option value="cql">
                    {he.translate('query__qt_cql')}
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
                        {he.translate('qhistory__filter_legend')}
                    </legend>
                    <label>
                        {he.translate('qhistory__curr_corp_only_label')}:{'\u00a0'}
                        <CurrentCorpCheckbox value={props.currentCorpusOnly} />
                    </label>
                    <label>
                        {he.translate('qhistory__query_type_sel')}:{'\u00a0'}
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
                    {he.translate('qhistory__th_query')}
                </th>
                <th>
                    {he.translate('qhistory__th_datetime')}
                </th>
                <th></th>
            </tr>
        );
    };

    // -------------------- <AlignedQueryInfo /> ------------------------

    const TRAlignedQueryInfo = (props) => {
        return (
            <tr>
                <td className="corpname">
                    {props.human_corpname}
                    {'\u00a0\u23F5'}
                </td>
                <td className="query">{props.query}</td>
                <td className="query-type">({queryTypes[props.query_type]})</td>
            </tr>
        );
    };

    // -------------------- <QueryInfo /> ------------------------

    const QueryInfo = (props) => {

        return (
            <table>
                <tbody>
                    <tr>
                        <td className="corpname">
                            {props.human_corpname}
                            {props.usesubcorp ? ':' + props.usesubcorp : ''}
                            {'\u00a0\u23F5'}
                        </td>
                        <td className="query">{props.query}</td>
                        <td className="query-type">({queryTypes[props.query_type]})</td>
                    </tr>
                    {props.aligned.map(v => <TRAlignedQueryInfo key={v.corpname}
                                human_corpname={v.human_corpname} query={v.query} query_type={v.query_type} />)}
                </tbody>
            </table>
        );
    }

    // -------------------- <DataRow /> ------------------------

    const DataRow = (props) => {

        const handleFormClick = () => {
            dispatcher.dispatch({
                actionType: 'QUERY_STORAGE_OPEN_QUERY_FORM',
                props: {
                    idx: props.data.idx
                }
            });
        };

        return (
            <tr className="data-item">
                <td className="num">
                    {props.data.idx + 1}.
                </td>
                <td>
                    <QueryInfo human_corpname={props.data.human_corpname} query={props.data.query}
                            query_type={props.data.query_type} usesubcorp={props.data.usesubcorp}
                            aligned={props.data.aligned} />
                </td>
                <td className="date">
                    {he.formatDate(new Date(props.data.created * 1000), 1)}
                </td>
                <td>
                    <a onClick={handleFormClick}>
                        {he.translate('qhistory__open_in_form')}
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
                <td colSpan="4">
                    <a onClick={handleClick}>
                        {props.storeIsBusy ?
                        (<img src={he.createStaticUrl('img/ajax-loader.gif')}
                                alt={he.translate('global__loading')} />) :
                        <span>{he.translate('qhistory__load_more_link')}</span>
                        }
                    </a>
                </td>
            </tr>
        );
    };

    // -------------------- <TRNoData /> ------------------------

    const TRNoData = (props) => {
        return (
            <tr className="last-row">
                <td colSpan="4">
                    {he.translate('global__no_data_found')}
                </td>
            </tr>
        );
    };

    const DataTableFooter = (props) => {
        if (props.dataLength > 0) {
            if (props.hasMoreItems) {
                return <TRLoadMoreLink storeIsBusy={props.storeIsBusy} />

            } else {
                return null;
            }

        } else {
            return <TRNoData />;
        }
    };

    // -------------------- <DataTable /> ------------------------

    const DataTable = (props) => {

        return (
            <table className="data">
                <tbody>
                    <TRDataHeading />
                    {props.data.map((item, i) => <DataRow key={i + props.offset} data={item} />)}
                    <DataTableFooter dataLength={props.data.size} storeIsBusy={props.storeIsBusy}
                            hasMoreItems={props.hasMoreItems} />
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
                storeIsBusy: queryHistoryStore.getIsBusy(),
                hasMoreItems: queryHistoryStore.getHasMoreItems()
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
                            storeIsBusy={this.state.storeIsBusy}
                            hasMoreItems={this.state.hasMoreItems} />
                </div>
            );
        }
    }


    return {
        RecentQueriesPageList: RecentQueriesPageList
    };

}