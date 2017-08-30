/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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


export function init(dispatcher, he, subcorpLinesStore) {

    const layoutViews = he.getLayoutViews();

    // ------------------------ <TrUnfinishedLine /> --------------------------

    const TrUnfinishedLine = (props) => {

        return (
            <tr>
                <td />
                <td>
                    {props.item.name}
                </td>
                <td className="processing">
                    {he.translate('global__processing')}
                </td>
                <td className="num">{he.formatDate(props.item.created, 1)}</td>
                <td />
            </tr>
        );
    };


    // ------------------------ <TrDataLine /> --------------------------

    const TrDataLine = (props) => {

        const handleCheckbox = () => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_SELECT_LINE',
                props: {
                    idx: props.idx
                }
            });
        };

        const renderLabel = () => {
            const item = props.item;
            if (!item.deleted) {
                const title = he.translate('subclist__search_in_subc');
                const href = he.createActionLink(
                    'first_form',
                    [
                        ['corpname', item.corpname],
                        ['usesubcorp', item.usesubcorp]
                    ]
                );
                return <a title={title} href={href}>{item.name}</a>;

            } else {
                return <span>{props.item.name}</span>;
            }
        };

        const handleActionClick = (evt) => {
            props.actionButtonHandle(props.idx, evt);
        };

        return (
            <tr>
                <td>
                    {!props.item.deleted
                        ? <input type="checkbox" checked={props.item.selected} onChange={handleCheckbox} />
                        : null}
                </td>
                <td>
                    {renderLabel()}
                </td>
                <td className="num">
                {   props.item.size ? he.formatNumber(props.item.size) : '-'}
                </td>
                <td>
                    {he.formatDate(props.item.created, 1)}
                </td>
                <td className="action-link">
                    {props.item.cql ?
                        <a onClick={handleActionClick}
                                title={he.translate('subclist__click_to_access_the_backup')}>{'\u2713'}</a> :
                        null
                    }
                </td>
            </tr>
        );
    };

    // ------------------------ <ThSortable /> --------------------------

    const ThSortable = (props) => {

        const renderSortFlag = () => {
            if (props.sortKey) {
                if (props.sortKey.reverse) {
                    return <img className="sort-flag" src={he.createStaticUrl('img/sort_desc.svg')} />;

                } else {
                    return <img className="sort-flag" src={he.createStaticUrl('img/sort_asc.svg')} />;
                }

            } else {
                return null;
            }
        };

        const handleSortClick = () => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_SORT_LINES',
                props: {
                    colName: props.ident,
                    reverse: props.sortKey ? !props.sortKey.reverse : false
                }
            });
        };

        const getTitle = () => {
            if (props.sortKey) {
                return he.translate('global__sorted_click_change');
            }
            return he.translate('global__click_to_sort');
        };

        return (
            <th>
                <a onClick={handleSortClick} title={getTitle()}>
                    {props.label}
                    {renderSortFlag()}
                </a>
            </th>
        );
    };

    // ------------------------ <DataTable /> --------------------------

    class DataTable extends React.Component {

        constructor(props) {
            super(props);
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this.state = this._fetchStoreState();
        }

        _fetchStoreState() {
            return {
                lines: subcorpLinesStore.getLines(),
                sortKey: subcorpLinesStore.getSortKey(),
                unfinished: subcorpLinesStore.getUnfinished()
            }
        }

        _handleStoreChange() {
            this.setState(this._fetchStoreState());
        }

        componentDidMount() {
            subcorpLinesStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            subcorpLinesStore.removeChangeListener(this._handleStoreChange);
        }

        _exportSortKey(name) {
            if (name === this.state.sortKey.name) {
                return this.state.sortKey;
            }
            return null;
        }

        render() {
            return (
                <table className="data">
                    <tbody>
                        <tr>
                            <th />
                            <ThSortable ident="name" sortKey={this._exportSortKey('name')} label={he.translate('subclist__col_name')} />
                            <ThSortable ident="size" sortKey={this._exportSortKey('size')} label={he.translate('subclist__col_size')} />
                            <ThSortable ident="created" sortKey={this._exportSortKey('created')} label={he.translate('subclist__col_created')} />
                            <th>{he.translate('subclist__col_backed_up')}</th>
                        </tr>
                        {this.state.unfinished.map(item => <TrUnfinishedLine key={item.name} item={item} /> )}
                        {this.state.lines.map((item, i) => (
                            <TrDataLine key={`${i}:${item.name}`} idx={i} item={item} actionButtonHandle={this.props.actionButtonHandle} />
                        ))}
                    </tbody>
                </table>
            );
        }
    }

    // ------------------------ <FilterForm /> --------------------------

    const FilterForm = (props) => {

        const handleShowDeleted = () => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_UPDATE_FILTER',
                props: {
                    corpname: props.filter['corpname'],
                    show_deleted: !props.filter['show_deleted']
                }
            });
        };

        const handleCorpusSelection = (evt) => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_UPDATE_FILTER',
                props: {
                    corpname: evt.target.value,
                    show_deleted: props.filter['show_deleted']
                }
            });
        };

        return (
            <form className="filter">
                <fieldset>
                    <legend>{he.translate('subclist__filter_heading')}</legend>
                    <div>
                        <label>{he.translate('global__corpus')}:{'\u00A0'}
                            <select value={props.filter.corpname}
                                    onChange={handleCorpusSelection}>
                                <option value="">--</option>
                                {props.relatedCorpora.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label>
                            {he.translate('subclist__show_deleted')}:{'\u00A0'}
                            <input type="checkbox" onChange={handleShowDeleted} checked={props.filter['show_deleted']} />
                        </label>
                    </div>
                </fieldset>
            </form>
        );
    };

    // ------------------------ <FormActionTemplate /> --------------------------

    const FormActionTemplate = (props) => {

        return (
            <form className="subc-action">
                <fieldset>
                    <legend>
                        <img src={he.createStaticUrl('img/collapse.svg')} alt="action form" />
                    </legend>
                    {props.children}
                </fieldset>
            </form>
        );
    };

    // ------------------------ <FormActionReuse /> --------------------------

    class FormActionReuse extends React.Component {

        constructor(props) {
            super(props);
            this._handleSubmit = this._handleSubmit.bind(this);
            this._handleNameChange = this._handleNameChange.bind(this);
            this._handleCqlChange = this._handleCqlChange.bind(this);
            this.state = {
                newName: this.props.data.usesubcorp + ' (' + he.translate('global__copy') + ')',
                newCql: this.props.data.cql
            };
        }

        _handleSubmit() {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_REUSE_QUERY',
                props: {
                    idx: this.props.idx,
                    newName: this.state.newName,
                    newCql: this.state.newCql
                }
            });
        }

        _handleNameChange(evt) {
            const newState = he.cloneState(this.state);
            newState.newName = evt.target.value;
            this.setState(newState);
        }

        _handleCqlChange(evt) {
            const newState = he.cloneState(this.state);
            newState.newCql = evt.target.value;
            this.setState(newState);
        }

        render() {
            return (
                <FormActionTemplate>
                    <div>
                        <label>{he.translate('global__name')}:{'\u00A0'}
                            <input type="text" style={{width: '20em'}}
                                    defaultValue={this.state.newName}
                                    onChange={this._handleNameChange} />
                        </label>
                    </div>
                    <div>
                        <label>{he.translate('global__cql_query')}:{'\u00A0'}
                            <textarea defaultValue={this.props.data.cql}
                                onChange={this._handleCqlChange} rows="4" />
                        </label>
                    </div>
                    <div>
                        <button type="button" className="default-button"
                            onClick={this._handleSubmit}>{he.translate('subcform__create_subcorpus')}</button>
                    </div>
                    <p>
                        (<img src={he.createStaticUrl('img/warning-icon.svg')}
                                alt={he.translate('global__warning')}
                                style={{width: '1em', marginRight: '0.4em', verticalAlign: 'middle'}} />
                        {he.translate('subclist__reuse_query_warn')})
                    </p>
                </FormActionTemplate>
            );
        }
    }

    // ------------------------ <FormActionWipe /> --------------------------

    const FormActionWipe = (props) => {

        const handleSubmit = () => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_WIPE_SUBCORPUS',
                props: {
                    idx: props.idx
                }
            });
        };

        return (
            <FormActionTemplate>
                <p>{he.translate('subclist__info_subc_will_be_wiped')}</p>
                <button type="button" className="default-button"
                        onClick={handleSubmit}>
                    {he.translate('global__confirm')}
                </button>
            </FormActionTemplate>
        );
    };


    // ------------------------ <FormActionRestore /> --------------------------

    const FormActionRestore = (props) => {

        const handleSubmit = () => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_RESTORE_SUBCORPUS',
                props: {
                    idx: props.idx
                }
            });
        };

        return (
            <FormActionTemplate>
                <p>{he.translate('subclist__info_subc_will_be_restored')}</p>
                <button type="button" className="default-button"
                        onClick={handleSubmit}>
                    {he.translate('global__confirm')}
                </button>
            </FormActionTemplate>
        );
    };


    // ------------------------ <ActionBox /> --------------------------

    class ActionBox extends React.Component {

        constructor(props) {
            super(props);
            this._handleActionSelect = this._handleActionSelect.bind(this);
            this.state = {
                data: subcorpLinesStore.getRow(this.props.idx),
                action: null
            };
        }

        _handleActionSelect(evt) {
            const newState = he.cloneState(this.state);
            newState.action = evt.target.value;
            this.setState(newState);
        }

        _renderActionForm() {
            switch (this.state.action) {
                case 'restore':
                    return <FormActionRestore idx={this.props.idx} data={this.state.data} />;
                case 'reuse':
                    return <FormActionReuse idx={this.props.idx} data={this.state.data} />;
                case 'wipe':
                    return <FormActionWipe idx={this.props.idx} data={this.state.data} />;
            }
        }

        _renderActionMenu() {
            if (this.state.data.cql) {
                if (this.state.data.deleted) {
                    return [
                        <option key="empty" value="">--</option>,
                        <option key="restore" value="restore">{he.translate('subclist__action_restore')}{'\u2026'}</option>,
                        <option key="reuse" value="reuse">{he.translate('subclist__action_reuse')}{'\u2026'}</option>,
                        <option key="wipe" value="wipe">{he.translate('subclist__action_wipe')}{'\u2026'}</option>
                    ];

                } else {
                    return [
                        <option key="empty" value="">--</option>,
                        <option key="reuse" value="reuse">{he.translate('subclist__action_reuse')}{'\u2026'}</option>
                    ]
                }

            } else {
                return [];
            }
        }

        render() {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.onCloseClick}>
                    <layoutViews.PopupBox onCloseClick={this.props.onCloseClick} customClass="subcorp-actions">
                        <div>
                            <h3>{he.translate('subclist__backup_of_{subcname}', {subcname: this.state.data.name})}</h3>
                            <span className="actions">
                                {he.translate('global__actions') + ':\u00A0'}
                            </span>
                            <select onChange={this._handleActionSelect}>
                                {this._renderActionMenu()}
                            </select>
                            {this._renderActionForm()}
                        </div>
                    </layoutViews.PopupBox>
                </layoutViews.ModalOverlay>
            )
        }
    }


    // ------------------------ <SubcorpList /> --------------------------

    class SubcorpList extends React.Component {

        constructor(props) {
            super(props);
            this._storeChangeListener = this._storeChangeListener.bind(this);
            this._handleDeleteButton = this._handleDeleteButton.bind(this);
            this._handleActionButton = this._handleActionButton.bind(this);
            this._handleActionsClose = this._handleActionsClose.bind(this);
            this.state = this._fetchStoreState();
        }

        _fetchStoreState() {
            return {
                hasSelectedLines: subcorpLinesStore.hasSelectedLines(),
                filter: subcorpLinesStore.getFilter(),
                relatedCorpora: subcorpLinesStore.getRelatedCorpora(),
                actionBoxVisible: null
            };
        }

        _storeChangeListener() {
            this.setState(this._fetchStoreState());
        }

        componentDidMount() {
            subcorpLinesStore.addChangeListener(this._storeChangeListener);
        }

        componentWillUnmount() {
            subcorpLinesStore.removeChangeListener(this._storeChangeListener);
        }

        _handleDeleteButton() {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_DELETE_SELECTED_SUBCORPORA',
                props: {}
            });
        }

        _handleActionButton(idx, evt) {
            const newState = he.cloneState(this.state);
            newState.actionBoxVisible = idx;
            this.setState(newState);
        }

        _handleActionsClose() {
            const newState = he.cloneState(this.state);
            newState.actionBoxVisible = null;
            this.setState(newState);
        }

        render() {
            return (
                <div>
                    <section className="inner">
                        <FilterForm filter={this.state.filter} relatedCorpora={this.state.relatedCorpora} />
                    </section>
                    {this.state.actionBoxVisible !== null
                        ? <ActionBox onCloseClick={this._handleActionsClose} idx={this.state.actionBoxVisible} />
                        : null}
                    <DataTable actionButtonHandle={this._handleActionButton} />
                    <div className="actions">
                        {this.state.hasSelectedLines
                            ? <button type="button" className="default-button"
                                onClick={this._handleDeleteButton}>{he.translate('subclist__delete_selected_btn')}</button>
                            : null}
                    </div>
                </div>
            );
        }
    }

    return {
        SubcorpList: SubcorpList
    };
}