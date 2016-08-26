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


import React from 'vendor/react';


export function init(dispatcher, mixins, layoutViews, subcorpLinesStore) {


    // ------------------------ <TrUnfinishedLine /> --------------------------

    const TrUnfinishedLine = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <tr>
                    <td />
                    <td>
                        {this.props.item.name}
                    </td>
                    <td className="processing">
                        {this.translate('global__processing')}
                    </td>
                    <td className="num">{this.formatDate(this.props.item.created)}</td>
                    <td />
                    <td />
                </tr>
            );
        }
    });


    // ------------------------ <TrDataLine /> --------------------------

    const TrDataLine = React.createClass({

        mixins : mixins,

        _handleCheckbox : function () {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_SELECT_LINE',
                props: {
                    idx: this.props.idx
                }
            });
        },

        _renderLabel : function () {
            const item = this.props.item;
            if (!item.deleted) {
                const title = this.translate('subclist__search_in_subc');
                const href = this.createActionLink(
                    'first_form',
                    [
                        ['corpname', item.corpname],
                        ['usesubcorp', item.usesubcorp]
                    ]
                );
                return <a title={title} href={href}>{item.name}</a>;

            } else {
                return <span>{this.props.item.name}</span>;
            }
        },

        _handleActionClick : function (evt) {
            this.props.actionButtonHandle(this.props.idx, evt);
        },

        render : function () {
            return (
                <tr>
                    <td>
                        {!this.props.item.deleted
                            ? <input type="checkbox" checked={this.props.item.selected} onChange={this._handleCheckbox} />
                            : null}
                    </td>
                    <td>{this._renderLabel()}</td>
                    <td className="num">
                    {this.props.item.size
                        ? this.formatNumber(this.props.item.size)
                        : '-'}
                    </td>
                    <td className="num">{this.formatDate(this.props.item.created)}</td>
                    <td className="num">
                        {this.props.item.cql ? '\u2713' : null}
                    </td>
                    <td>
                        {this.props.item.cql
                            ? <a className="action-link" onClick={this._handleActionClick}>
                                    {this.translate('global__options')}{'\u00A0\u2026'}</a>
                            : null}
                    </td>
                </tr>
            );
        }
    });

    // ------------------------ <ThSortable /> --------------------------

    const ThSortable = React.createClass({

        mixins : mixins,

        _renderSortFlag : function () {
            if (this.props.sortKey) {
                if (this.props.sortKey.reverse) {
                    return <img className="sort-flag" src={this.createStaticUrl('img/sort_desc.svg')} />;

                } else {
                    return <img className="sort-flag" src={this.createStaticUrl('img/sort_asc.svg')} />;
                }

            } else {
                return null;
            }
        },

        _handleSortClick : function () {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_SORT_LINES',
                props: {
                    colName: this.props.ident,
                    reverse: this.props.sortKey ? !this.props.sortKey.reverse : false
                }
            });
        },

        render : function () {
            return (
                <th>
                    <a onClick={this._handleSortClick}>
                        {this.props.label}
                        {this._renderSortFlag()}
                    </a>
                </th>
            );
        }
    });

    // ------------------------ <DataTable /> --------------------------

    const DataTable = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                lines: subcorpLinesStore.getLines(),
                sortKey: subcorpLinesStore.getSortKey(),
                unfinished: subcorpLinesStore.getUnfinished()
            }
        },

        _handleStoreChange : function () {
            this.setState({
                lines: subcorpLinesStore.getLines(),
                sortKey: subcorpLinesStore.getSortKey(),
                unfinished: subcorpLinesStore.getUnfinished()
            });
        },

        componentDidMount : function () {
            subcorpLinesStore.addChangeListener(this._handleStoreChange);
        },

        componentWillUnmount : function () {
            subcorpLinesStore.removeChangeListener(this._handleStoreChange);
        },

        _exportSortKey : function (name) {
            if (name === this.state.sortKey.name) {
                return this.state.sortKey;
            }
            return null;
        },

        render : function () {
            return (
                <table className="data">
                    <tbody>
                        <tr>
                            <th />
                            <ThSortable ident="name" sortKey={this._exportSortKey('name')} label={this.translate('subclist__col_name')} />
                            <ThSortable ident="size" sortKey={this._exportSortKey('size')} label={this.translate('subclist__col_size')} />
                            <ThSortable ident="created" sortKey={this._exportSortKey('created')} label={this.translate('subclist__col_created')} />
                            <th>{this.translate('subclist__col_backed_up')}</th>
                            <th />
                        </tr>
                        {this.state.unfinished.map(item => <TrUnfinishedLine key={item.name} item={item} /> )}
                        {this.state.lines.map((item, i) => (
                            <TrDataLine key={item.name} idx={i} item={item} actionButtonHandle={this.props.actionButtonHandle} />
                        ))}
                    </tbody>
                </table>
            );
        }
    });

    // ------------------------ <FilterForm /> --------------------------

    const FilterForm = React.createClass({

        mixins : mixins,

        _handleShowDeleted : function () {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_UPDATE_FILTER',
                props: {
                    corpname: this.props.filter['corpname'],
                    show_deleted: !this.props.filter['show_deleted']
                }
            });
        },

        _handleCorpusSelection : function (evt) {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_UPDATE_FILTER',
                props: {
                    corpname: evt.target.value,
                    show_deleted: this.props.filter['show_deleted']
                }
            });
        },

        render : function () {
            return (
                <form className="filter">
                    <fieldset>
                        <legend>{this.translate('subclist__filter_heading')}</legend>
                        <div>
                            <label>{this.translate('global__corpus')}:{'\u00A0'}
                                <select value={this.props.filter.corpname}
                                        onChange={this._handleCorpusSelection}>
                                    <option value="">--</option>
                                    {this.props.relatedCorpora.map(item => <option key={item} value={item}>{item}</option>)}
                                </select>
                            </label>
                        </div>
                        <div>
                            <label>
                                {this.translate('subclist__show_deleted')}:{'\u00A0'}
                                <input type="checkbox" onChange={this._handleShowDeleted} checked={this.props.filter['show_deleted']} />
                            </label>
                        </div>
                    </fieldset>
                </form>
            );
        }
    });

    // ------------------------ <FormActionTemplate /> --------------------------

    const FormActionTemplate = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <form className="subc-action">
                    <fieldset>
                        <legend>
                            <img src={this.createStaticUrl('img/collapse.svg')} alt="action form" />
                        </legend>
                        {this.props.children}
                    </fieldset>
                </form>
            );
        }
    });

    // ------------------------ <FormActionReuse /> --------------------------

    const FormActionReuse = React.createClass({

        mixins : mixins,

        _handleSubmit : function () {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_REUSE_QUERY',
                props: {
                    idx: this.props.idx,
                    newName: this.state.newName,
                    newCql: this.state.newCql
                }
            });
        },

        getInitialState : function () {
            return {
                newName: this.props.data.usesubcorp + ' (' + this.translate('global__copy') + ')',
                newCql: this.props.data.cql
            };
        },

        _handleNameChange : function (evt) {
            this.setState(React.addons.update(
                this.state,
                {newName: {$set: evt.target.value}}
            ));
        },

        _handleCqlChange : function (evt) {
            this.setState(React.addons.update(
                this.state,
                {newCql: {$set: evt.target.value}}
            ));
        },

        render : function () {
            return (
                <FormActionTemplate>
                    <div>
                        <label>{this.translate('global__name')}:{'\u00A0'}
                            <input type="text" style={{width: '20em'}}
                                    defaultValue={this.state.newName}
                                    onChange={this._handleNameChange} />
                        </label>
                    </div>
                    <div>
                        <label>{this.translate('global__cql_query')}:{'\u00A0'}
                            <textarea defaultValue={this.props.data.cql}
                                onChange={this._handleCqlChange} rows="4" />
                        </label>
                    </div>
                    <div>
                        <button type="button" className="default-button"
                            onClick={this._handleSubmit}>{this.translate('subcform__create_subcorpus')}</button>
                    </div>
                </FormActionTemplate>
            );
        }
    });

    // ------------------------ <FormActionWipe /> --------------------------

    const FormActionWipe = React.createClass({

        mixins : mixins,

        _handleSubmit : function () {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_WIPE_SUBCORPUS',
                props: {
                    idx: this.props.idx
                }
            });
        },

        render : function () {
            return (
                <FormActionTemplate>
                    <p>{this.translate('subclist__info_subc_will_be_wiped')}</p>
                    <button type="button" className="default-button"
                            onClick={this._handleSubmit}>
                        {this.translate('global__confirm')}
                    </button>
                </FormActionTemplate>
            );
        }
    });


    // ------------------------ <FormActionRestore /> --------------------------

    const FormActionRestore = React.createClass({

        mixins : mixins,

        _handleSubmit : function () {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_RESTORE_SUBCORPUS',
                props: {
                    idx: this.props.idx
                }
            });
        },

        render : function () {
            return (
                <FormActionTemplate>
                    <p>{this.translate('subclist__info_subc_will_be_restored')}</p>
                    <button type="button" className="default-button"
                            onClick={this._handleSubmit}>
                        {this.translate('global__confirm')}
                    </button>
                </FormActionTemplate>
            );
        }
    });


    // ------------------------ <ActionBox /> --------------------------

    const ActionBox = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                data: subcorpLinesStore.getRow(this.props.idx),
                action: null
            };
        },

        _handleActionSelect : function (evt) {
            this.setState(React.addons.update(this.state, {action: {$set: evt.target.value}}));
        },

        _renderActionForm : function () {
            switch (this.state.action) {
                case 'restore':
                    return <FormActionRestore idx={this.props.idx} data={this.state.data} />;
                case 'reuse':
                    return <FormActionReuse idx={this.props.idx} data={this.state.data} />;
                case 'wipe':
                    return <FormActionWipe idx={this.props.idx} data={this.state.data} />;
            }
        },

        _renderActionMenu : function () {
            if (this.state.data.cql) {
                if (this.state.data.deleted) {
                    return [
                        <option key="empty" value="">--</option>,
                        <option key="restore" value="restore">{this.translate('subclist__action_restore')}</option>,
                        <option key="reuse" value="reuse">{this.translate('subclist__action_reuse')}</option>,
                        <option key="wipe" value="wipe">{this.translate('subclist__action_wipe')}</option>
                    ];

                } else {
                    return [
                        <option key="empty" value="">--</option>,
                        <option key="reuse" value="reuse">{this.translate('subclist__action_reuse')}</option>
                    ]
                }

            } else {
                return [];
            }
        },

        render : function () {
            return (
                <layoutViews.ModalOverlay>
                    <layoutViews.PopupBox onCloseClick={this.props.onCloseClick} customClass="subcorp-actions">
                        <div>
                            <h3>{this.state.data.name}</h3>
                            <span className="actions">
                                {this.translate('global__actions') + ':\u00A0'}
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
    });


    // ------------------------ <SubcorpList /> --------------------------

    const SubcorpList = React.createClass({

        mixins : mixins,

        _storeChangeListener : function () {
            this.setState({
                hasSelectedLines: subcorpLinesStore.hasSelectedLines(),
                filter: subcorpLinesStore.getFilter(),
                relatedCorpora: subcorpLinesStore.getRelatedCorpora(),
                actionBoxVisible: null
            });
        },

        getInitialState : function () {
            return {
                hasSelectedLines: subcorpLinesStore.hasSelectedLines(),
                filter: subcorpLinesStore.getFilter(),
                relatedCorpora: subcorpLinesStore.getRelatedCorpora(),
                actionBoxVisible: null
            };
        },

        componentDidMount : function () {
            subcorpLinesStore.addChangeListener(this._storeChangeListener);
        },

        componentWillUnmount : function () {
            subcorpLinesStore.removeChangeListener(this._storeChangeListener);
        },

        _handleDeleteButton : function () {
            dispatcher.dispatch({
                actionType: 'SUBCORP_LIST_DELETE_SELECTED_SUBCORPORA',
                props: {}
            });
        },

        _handleActionButton : function (idx, evt) {
            this.setState(React.addons.update(this.state, {
                actionBoxVisible: {$set: idx}
            }));
        },

        _handleActionsClose : function () {
            this.setState(React.addons.update(this.state, {
                actionBoxVisible: {$set: null}
            }));
        },

        render : function () {
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
                                onClick={this._handleDeleteButton}>{this.translate('subclist__delete_selected_btn')}</button>
                            : null}
                    </div>
                </div>
            );
        }
    });

    return {
        SubcorpList: SubcorpList
    };
}