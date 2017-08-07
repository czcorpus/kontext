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

    const queryTypes = {
        'iquery': he.translate('query__qt_basic'),
        'lemma': he.translate('query__qt_lemma'),
        'phrase': he.translate('query__qt_phrase'),
        'word': he.translate('query__qt_word_form'),
        'char': he.translate('query__qt_word_part'),
        'cql': he.translate('query__qt_cql')
    };

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
    };

    // -------------------- <ArchivedOnlyCheckbox /> ------------------------

    const ArchivedOnlyCheckbox = (props) => {
        const handleChange = () => {
            dispatcher.dispatch({
                actionType: 'QUERY_STORAGE_SET_ARCHIVED_ONLY',
                props: {
                    value: !props.value
                }
            });
        };

        return <input type="checkbox" checked={props.value} onChange={handleChange} />;
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
                    <label>
                        {he.translate('qhistory__checkbox_archived_only')}:{'\u00a0'}
                        <ArchivedOnlyCheckbox value={props.archivedOnly} />
                    </label>
                </fieldset>
            </form>
        );
    };

    // -------------------- <AlignedQueryInfo /> ------------------------

    const TRAlignedQueryInfo = (props) => {
        return (
            <tr>
                <td className="query">{props.query}</td>
                <td className="query-type">({queryTypes[props.query_type]})</td>
            </tr>
        );
    };

    // -------------------- <QueryInfo /> ------------------------

    const QueryInfo = (props) => {

        return (
            <table className="query-info">
                <tbody>
                    <tr>
                        <td className="query">{props.query}</td>
                        <td className="query-type">({queryTypes[props.query_type]})</td>
                    </tr>
                    {props.aligned.map(v => <TRAlignedQueryInfo key={v.corpname}
                                query={v.query} query_type={v.query_type} />)}
                </tbody>
            </table>
        );
    }

    // -------------------- <SavedNameInfo /> ------------------------

    const SavedNameInfo = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch({
                actionType: 'QUERY_STORAGE_SET_EDITING_QUERY_ID',
                props: {
                    value: props.queryId
                }
            });
        };

        if (props.hasEditor) {
            return <SaveItemForm name={props.editingQueryName} />

        } else {
            if (props.name) {
                return (
                    <div>
                        {he.translate('query__save_as_saved_as')}:{'\u00a0'}
                        <span className="saved-name">{props.name}</span>
                        {'\u00a0'}
                        <span className="edit-action">
                        (<a onClick={handleClick}>{he.translate('global__edit')}</a>)
                        </span>
                    </div>
                );

            } else {
                return (
                    <div>
                        <a className="save-action" onClick={handleClick}>
                            {he.translate('global__save')}
                        </a>
                    </div>
                );
            }
        }
    }

    // -------------------- <SaveItemForm /> ------------------------

    const SaveItemForm = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'QUERY_STORAGE_EDITOR_SET_NAME',
                props: {
                    value: evt.target.value
                }
            });
        };

        const handleSubmitClick = () => {
            dispatcher.dispatch({
                actionType: 'QUERY_STORAGE_EDITOR_CLICK_SAVE',
                props: {}
            });
        };

        const handleCloseClick = () => {
            dispatcher.dispatch({
                actionType: 'QUERY_STORAGE_CLEAR_EDITING_QUERY_ID',
                props: {}
            });
        };

        return (
            <form>
                <a onClick={handleCloseClick}>
                    <img src={he.createStaticUrl('img/close-icon.svg')} alt={he.translate('global__close')}
                                style={{width: '1em', verticalAlign: 'middle'}} />
                </a>
                {'\u00a0'}
                <input type="text" style={{width: '15em'}} value={props.name}
                        onChange={handleInputChange}
                        ref={item => item ? item.focus() : null} />
                {'\u00a0'}
                <button type="button" className="default-button"
                        onClick={handleSubmitClick}>
                    {he.translate('global__save')}
                </button>
            </form>
        );
    };

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
            <div className="history-entry">
                <span className="date">
                    {he.formatDate(new Date(props.data.created * 1000), 1)}
                </span>
                <div className="heading">
                    <strong>
                        {props.data.idx + 1}{'\u00a0\u23F5'}
                    </strong>
                    {'\u00a0'}
                    <span className="corpname">
                        {props.data.human_corpname}
                        {props.data.usesubcorp ? ':' + props.data.usesubcorp : ''}
                    </span>
                    {props.data.aligned.map(v => <span className="corpname"> + {v.human_corpname}</span>)}
                </div>
                <QueryInfo human_corpname={props.data.human_corpname} query={props.data.query}
                        query_type={props.data.query_type} usesubcorp={props.data.usesubcorp}
                        aligned={props.data.aligned} />
                <SavedNameInfo name={props.data.name} queryId={props.data.query_id}
                        hasEditor={props.hasEditor}
                        editingQueryName={props.editingQueryName} />
                <div className="footer">
                    <a className="open-in-form" onClick={handleFormClick}>
                        {he.translate('qhistory__open_in_form')}
                    </a>
                </div>
            </div>
        );
    };

    // -------------------- <LoadMoreBlock /> ------------------------

    const LoadMoreBlock = (props) => {

        const handleClick = () => {
            dispatcher.dispatch({
                actionType: 'QUERY_STORAGE_LOAD_MORE',
                props: {}
            });
        };

        return (
            <div className="last-row">
                <a onClick={handleClick}>
                    {props.storeIsBusy ?
                    (<img src={he.createStaticUrl('img/ajax-loader.gif')}
                            alt={he.translate('global__loading')} />) :
                    <span>{he.translate('qhistory__load_more_link')}</span>
                    }
                </a>
            </div>
        );
    };

    // -------------------- <NoDataBlock /> ------------------------

    const NoDataBlock = (props) => {
        return (
            <div className="last-row">
                {he.translate('global__no_data_found')}
            </div>
        );
    };

    // -------------------- <DataTableFooter /> ------------------------

    const DataTableFooter = (props) => {
        if (props.dataLength > 0) {
            if (props.hasMoreItems) {
                return <LoadMoreBlock storeIsBusy={props.storeIsBusy} />

            } else {
                return null;
            }

        } else {
            return <NoDataBlock />;
        }
    };

    // -------------------- <DataTable /> ------------------------

    const DataTable = (props) => {
        return (
            <div>
                    {props.data.map((item, i) => {
                        const hasEditor = item.query_id === props.editingQueryId;
                        return <DataRow key={i + props.offset} data={item} hasEditor={hasEditor}
                                        editingQueryName={hasEditor ? props.editingQueryName : undefined} />;
                    })}
                    <DataTableFooter dataLength={props.data.size} storeIsBusy={props.storeIsBusy}
                            hasMoreItems={props.hasMoreItems} />
            </div>
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
                hasMoreItems: queryHistoryStore.getHasMoreItems(),
                archivedOnly: queryHistoryStore.getArchivedOnly(),
                editingQueryId: queryHistoryStore.getEditingQueryId(),
                editingQueryName: queryHistoryStore.getEditingQueryName()
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
                            storeIsBusy={this.state.storeIsBusy}
                            archivedOnly={this.state.archivedOnly} />
                    <DataTable data={this.state.data} offset={this.state.offset}
                            storeIsBusy={this.state.storeIsBusy}
                            hasMoreItems={this.state.hasMoreItems}
                            editingQueryId={this.state.editingQueryId}
                            editingQueryName={this.state.editingQueryName} />
                </div>
            );
        }
    }


    return {
        RecentQueriesPageList: RecentQueriesPageList
    };

}