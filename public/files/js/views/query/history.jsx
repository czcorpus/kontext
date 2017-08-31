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
                    <label>
                        {he.translate('qhistory__checkbox_archived_only')}:{'\u00a0'}
                        <ArchivedOnlyCheckbox value={props.archivedOnly} />
                    </label>
                </fieldset>
            </form>
        );
    };

    // -------------------- <AlignedQueryInfo /> ------------------------

    const AlignedQueryInfo = (props) => {
        return (
            <div className="query-line">
                <span className="query-type">{queryTypes[props.query_type]}{'\u00a0\u23F5\u00a0'}</span>
                <span className="query">{props.query}</span>
            </div>
        );
    };

    // -------------------- <TextTypesInfo /> ------------------------

    class TextTypesInfo extends React.Component {

        constructor(props) {
            super(props);
            this.state = {
                expanded: false
            };
            this._handleExpandClick = this._handleExpandClick.bind(this);
        }

        _handleExpandClick() {
            this.setState({expanded: !this.state.expanded});
        }

        render() {
            if (Object.keys(this.props.textTypes).length > 0) {
                return (
                    <div className="text-types-info">
                        <a className="switch" onClick={this._handleExpandClick}
                                title={he.translate(this.state.expanded ? 'global__click_to_hide' : 'global__click_to_expand')}>
                            {he.translate('qhistory__attached_text_types')}
                            {!this.state.expanded ? '\u00a0\u2026' : null}
                        </a>
                        {this.state.expanded ? ':' : null}
                        {this.state.expanded ?
                            (<ul>
                                {Object.keys(this.props.textTypes).map(k => <li key={k}><strong>{k}</strong>: {this.props.textTypes[k].join(', ')}</li>)}
                            </ul>) : null
                        }
                    </div>
                );

            } else {
                return null;
            }
        }
    };

    // -------------------- <QueryInfo /> ------------------------

    const QueryInfo = (props) => {

        return (
            <div className="query-info">
                <div className="query-line">
                    <span className="query-type">{queryTypes[props.query_type]}{'\u00a0\u23F5\u00a0'}</span>
                    <span className="query">{props.query}</span>
                </div>
                {props.aligned.map(v => <AlignedQueryInfo key={v.corpname}
                            query={v.query} query_type={v.query_type} />)}
                <TextTypesInfo textTypes={props.textTypes} />
            </div>
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
            return <SaveItemForm name={props.editingQueryName} keepArchived={props.editingQueryKeepArchived} />;

        } else {
            if (props.name) {
                return (
                    <div>
                        {he.translate('query__save_as_saved_as')}:{'\u00a0'}
                        <span className="saved-name">{props.name}</span>
                        {'\u00a0'}
                        <a className="util-button" onClick={handleClick}>{he.translate('global__edit')}{'\u2026'}</a>
                    </div>
                );

            } else {
                return (
                    <div>
                        <a className="util-button" onClick={handleClick}>
                            {he.translate('query__save_button')}{'\u2026'}
                        </a>
                    </div>
                );
            }
        }
    }

    // -------------------- <ArchiveFlagSelection /> ------------------------

    const ArchiveFlagSelection = (props) => {

        const handleKeepArchivedChange = () => {
            dispatcher.dispatch({
                actionType: 'QUERY_STORAGE_EDITOR_SET_KEEP_ARCHIVED',
                props: {
                    value: !props.keepArchived
                }
            });
        };

        return (
            <select value={props.keepArchived} onChange={handleKeepArchivedChange} style={{verticalAlign: 'middle'}}>
                <option value={true}>{he.translate('query__save_as_keep_archived')}</option>
                <option value={false}>{he.translate('query__save_as_transient')}</option>
            </select>
        );
    };

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

        const handleKeyDown = (evt) => {
            if (evt.keyCode === 27) {
                evt.preventDefault();
                evt.stopPropagation();
                handleCloseClick();

            } else if (evt.keyCode === 13) {
                evt.preventDefault();
                evt.stopPropagation();
                handleSubmitClick();
            }
        };

        return (
            <form onKeyDown={handleKeyDown}>
                <a onClick={handleCloseClick}>
                    <img src={he.createStaticUrl('img/close-icon.svg')} alt={he.translate('global__close')}
                                style={{width: '1em', verticalAlign: 'middle'}} />
                </a>
                {'\u00a0'}
                <ArchiveFlagSelection keepArchived={props.keepArchived} />
                {'\u00a0'}
                {props.keepArchived ?
                    <input type="text" style={{width: '15em'}}
                            value={props.keepArchived ? props.name : ''}
                            onChange={handleInputChange} disabled={!props.keepArchived}
                            ref={item => item ? item.focus() : null} /> :
                    null
                }
                {'\u00a0'}
                <button type="button" className="default-button"
                        onClick={handleSubmitClick}>
                    {he.translate('global__ok')}
                </button>
                <br />
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
            <li>
                <span className="date">
                    {he.formatDate(new Date(props.data.created * 1000), 1)}
                </span>
                <div className="heading">
                    <strong>
                        {props.data.idx + 1}.
                    </strong>
                    {'\u00a0'}
                    <span className="corpname">
                        {props.data.human_corpname}
                        {props.data.subcorpname ?
                            <em className="subcorpname" title={he.translate('global__subcorpus')}>: {props.data.subcorpname}</em> :
                            null
                        }
                    </span>
                    {props.data.aligned.map(v => <span key={v.corpname} className="corpname"> + {v.human_corpname}</span>)}
                </div>
                <QueryInfo human_corpname={props.data.human_corpname} query={props.data.query}
                        query_type={props.data.query_type} subcorpname={props.data.subcorpname}
                        aligned={props.data.aligned} textTypes={props.data.selected_text_types} />
                <div className="footer">
                    <a className="open-in-form util-button" onClick={handleFormClick}>
                        {he.translate('qhistory__open_in_form')}
                        {'\u2026'}
                    </a>
                    {props.data.query_id ?
                    <SavedNameInfo name={props.data.name} queryId={props.data.query_id}
                            hasEditor={props.hasEditor}
                            editingQueryName={props.editingQueryName}
                            editingQueryKeepArchived={props.editingQueryKeepArchived} /> :
                            null /* legacy query history record cannot be archived  */
                    }
                </div>
            </li>
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
                    <ul className="history-entries">
                        {props.data.map((item, i) => {
                            const hasEditor = item.query_id === props.editingQueryId;
                            return <DataRow key={i + props.offset} data={item} hasEditor={hasEditor}
                                            editingQueryName={hasEditor ? props.editingQueryName : undefined}
                                            editingQueryKeepArchived={hasEditor ? props.editingQueryKeepArchived : undefined} />;
                        })}
                    </ul>
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
                editingQueryName: queryHistoryStore.getEditingQueryName(),
                editingQueryKeepArchived: queryHistoryStore.getEditingQueryKeepArchived()
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
                            editingQueryName={this.state.editingQueryName}
                            editingQueryKeepArchived={this.state.editingQueryKeepArchived} />
                </div>
            );
        }
    }


    return {
        RecentQueriesPageList: RecentQueriesPageList
    };

}