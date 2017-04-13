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



export function init(dispatcher, mixins, layoutViews, viewDeps, queryReplayStore, mainMenuStore) {

    function formTypeToTitle(opFormType) {
        switch (opFormType) {
            case 'query':
                return mixins[0].translate('query__operation_name_query');
            case 'filter':
                return mixins[0].translate('query__operation_name_filter');
            case 'sort':
                return mixins[0].translate('query__operation_name_sort');
            case 'sample':
                return mixins[0].translate('query__operation_name_sample');
            case 'shuffle':
                return mixins[0].translate('query__operation_name_shuffle');
            default:
                return null;
        }
    }


    // ------------------------ <QueryReplayView /> --------------------------------

    const QueryReplayView = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <layoutViews.ModalOverlay onCloseKey={this._handleCloseClick}>
                    <layoutViews.PopupBox customClass="query-replay-box" onCloseClick={()=>undefined}>
                        <div>
                            <h3>{this.translate('query__replay_replaying_query')}{'\u2026'}</h3>
                            <img src={this.createStaticUrl('img/ajax-loader-bar.gif')}
                                    alt={this.translate('global__loading_icon')} />
                            <div />
                        </div>
                    </layoutViews.PopupBox>
                </layoutViews.ModalOverlay>
            );
        }
    });

    // ------------------------ <ExecutionOptions /> --------------------------------

    const ExecutionOptions = React.createClass({

        mixins : mixins,

        _handleRadioInputChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_SET_STOP_AFTER_IDX',
                props: {
                    operationIdx: this.props.operationIdx,
                    value: evt.target.value === 'continue' ? null : this.props.operationIdx
                }
            });
        },

        render : function () {
            return (
                <fieldset className="query-exec-opts">
                    <legend>
                        {this.translate('query__execution_opts_fieldset')}
                    </legend>
                    <ul>
                        <li>
                            <label className={this.props.modeRunFullQuery ? 'active' : null}>
                                <input type="radio" name="exec-opts" style={{verticalAlign: 'middle'}} value="continue"
                                        checked={this.props.modeRunFullQuery}
                                        onChange={this._handleRadioInputChange} />
                                {this.translate('query__behaviour_apply_and_continue')}
                            </label>
                        </li>
                        <li>
                            <label className={!this.props.modeRunFullQuery ? 'active' : null}>
                                <input type="radio" name="exec-opts" style={{verticalAlign: 'middle'}} value="stop"
                                        checked={!this.props.modeRunFullQuery}
                                        onChange={this._handleRadioInputChange} />
                                {this.translate('query__behaviour_apply_and_stop')}
                            </label>
                        </li>
                    </ul>
                </fieldset>
            );
        }
    });

    // ------------------------ <QueryEditor /> --------------------------------

    const QueryEditor = React.createClass({

        mixins : mixins,

        _renderEditorComponent : function () {
            if (this.props.isLoading) {
                return <img src={this.createStaticUrl('img/ajax-loader-bar.gif')} alt={this.translate('global__loading')} />;

            } else if (!this.props.opKey || this.props.editIsLocked) {
                return (
                    <div>
                        <p>
                            <img src={this.createStaticUrl('img/warning-icon.svg')}
                                alt={this.translate('global__warning_icon')}
                                 style={{verticalAlign: 'middle', marginRight: '0.5em'}} />
                            {this.translate('query__replay_op_cannot_be_edited_msg')}.
                        </p>
                        <div style={{textAlign: 'center', marginTop: '2em'}}>
                            <a className="default-button" href={this.createActionLink(`view?${this.props.opEncodedArgs}`)}>
                                {this.translate('query__replay_view_the_result')}
                            </a>
                        </div>
                    </div>
                );

            } else if (this.props.operationIdx === 0) {
                return <viewDeps.QueryFormView {...this.props.editorProps} operationIdx={this.props.operationIdx} />;

            } else if (this.props.operationFormType === 'filter') {
                return <viewDeps.FilterFormView {...this.props.editorProps}
                            operationIdx={this.props.operationIdx}
                            filterId={this.props.opKey} />;

            } else if (this.props.operationFormType === 'sort') {
                return <viewDeps.SortFormView sortId={this.props.opKey} operationIdx={this.props.operationIdx} />;

            } else if (this.props.operationFormType === 'sample') {
                return <viewDeps.SampleFormView sampleId={this.props.opKey} operationIdx={this.props.operationIdx} />;

            } else if (this.props.operationFormType === 'shuffle') {
                return <viewDeps.ShuffleFormView {...this.props.editorProps} shuffleId={this.props.opKey}
                            shuffleMinResultWarning={this.props.shuffleMinResultWarning}
                            lastOpSize={this.props.resultSize}
                            operationIdx={this.props.operationIdx} />;

            } else {
                return <div>???</div>;
            }
        },

        render : function () {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.closeClickHandler}>
                    <layoutViews.CloseableFrame
                            customClass="query-form-spa"
                            label={this.translate('query__edit_current_hd_{operation}',
                                    {operation: formTypeToTitle(this.props.operationFormType)})}
                            onCloseClick={this.props.closeClickHandler}>
                        {this.props.operationIdx < this.props.numOps - 1 ?
                            <ExecutionOptions modeRunFullQuery={this.props.modeRunFullQuery}
                                    operationIdx={this.props.operationIdx} />
                            : null
                        }
                        {this._renderEditorComponent()}
                    </layoutViews.CloseableFrame>
                </layoutViews.ModalOverlay>
            );
        }
    });

    // ------------------------ <QueryOpInfo /> --------------------------------

    const QueryOpInfo = React.createClass({

        mixins : mixins,

        _renderLabel : function () {
            if (this.props.idx === 0) {
                return [
                    '\u00a0|\u00a0',
                    <strong key="op">{this.props.item.op}</strong>
                ];

            } else {
                return [
                    <span key="transit" className="transition">{'\u00A0\u25B6\u00A0'}</span>,
                    <strong key="op">{this.props.item.op}</strong>
                ];
            }
        },

        render : function () {
            return (
                <li>
                    {this._renderLabel()}{':\u00a0'}
                    {this.props.item.nicearg ?
                        (<a className="args" onClick={this.props.clickHandler} title={this.translate('query__click_to_edit_the_op')}>
                            {this.props.item.nicearg}
                        </a>)
                        : (<a className="args" onClick={this.props.clickHandler} title={this.translate('query__click_to_edit_the_op')}>
                            {'\u2713'}</a>)
                        }
                    {this.props.item.size ?
                         '\u00a0(' + this.translate('query__overview_hits_{num_hits}',
                            {num_hits: this.props.item.size}) + ')'
                        : null}
                    {this.props.hasOpenEditor ?
                        <QueryEditor
                            editorProps={this.props.editorProps}
                            closeClickHandler={this.props.closeEditorHandler}
                            operationIdx={this.props.idx}
                            operationId={this.props.item.opid}
                            operationFormType={this.props.item.formType}
                            opKey={this.props.editOpKey}
                            opEncodedArgs={this.props.item.tourl}
                            isLoading={this.props.isLoading}
                            modeRunFullQuery={this.props.modeRunFullQuery}
                            numOps={this.props.numOps}
                            shuffleMinResultWarning={this.props.shuffleMinResultWarning}
                            resultSize={this.props.item.size}
                            editIsLocked={this.props.editIsLocked} />
                        : null}
                </li>
            );
        }
    });

    // ----------------------------- <QueryOverivewTable /> --------------------------

    const QueryOverivewTable = React.createClass({

        mixins : mixins,

        _handleCloseClick : function () {
            dispatcher.dispatch({
                actionType: 'CLEAR_QUERY_OVERVIEW_DATA',
                props: {}
            });
        },

        _handleEditClick : function (idx) {
            dispatcher.dispatch({
                actionType: 'CLEAR_QUERY_OVERVIEW_DATA',
                props: {}
            }); // this is synchronous
            this.props.onEditClick(idx);
        },

        render : function () {
            return (
                <layoutViews.PopupBox customClass="query-overview centered" onCloseClick={this._handleCloseClick}>
                    <div>
                        <h3>{this.translate('global__query_overview')}</h3>
                        <table>
                            <tbody>
                                <tr>
                                    <th>{this.translate('global__operation')}</th>
                                    <th>{this.translate('global__parameters')}</th>
                                    <th>{this.translate('global__num_of_hits')}</th>
                                    <th></th>
                                    <th></th>
                                </tr>
                                {this.props.data.map((item, i) => (
                                    <tr key={i}>
                                        <td>{item.op}</td>
                                        <td>{item.arg}</td>
                                        <td>{item.size}</td>
                                        <td>
                                            <a href={this.createActionLink('view?' + item.tourl)}>
                                                {this.translate('global__view_result')}
                                            </a>
                                        </td>
                                        <td>
                                            <a onClick={this._handleEditClick.bind(this, i)}>
                                                {this.translate('query__overview_edit_query')}
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </layoutViews.PopupBox>
            );
        }
    });


    // ------------------------ <QueryOverview /> --------------------------------

    const QueryOverview = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                replayIsRunning: queryReplayStore.getBranchReplayIsRunning(),
                ops: queryReplayStore.getCurrEncodedOperations(),
                editOpIdx: null,
                editOpKey: null,
                isLoading: false,
                queryOverview: queryReplayStore.getCurrentQueryOverview(),
                modeRunFullQuery: queryReplayStore.getRunFullQuery(),
                editIsLocked: queryReplayStore.editIsLocked()
            };
        },

        _handleEditClick : function (idx) {
            dispatcher.dispatch({
                actionType: 'EDIT_QUERY_OPERATION',
                props: {operationIdx: idx}
            });
        },

        _handleEditorClose : function () {
            this.setState({
                replayIsRunning: queryReplayStore.getBranchReplayIsRunning(),
                ops: queryReplayStore.getCurrEncodedOperations(),
                editOpIdx: null,
                editOpKey: null,
                isLoading: false,
                queryOverview: null,
                modeRunFullQuery: queryReplayStore.getRunFullQuery(),
                editIsLocked: queryReplayStore.editIsLocked()
            });
        },

        _storeChangeListener : function (store, action) {
            this.setState({
                replayIsRunning: queryReplayStore.getBranchReplayIsRunning(),
                ops: queryReplayStore.getCurrEncodedOperations(),
                editOpIdx: queryReplayStore.getEditedOperationIdx(),
                editOpKey: queryReplayStore.opIdxToCachedQueryKey(this.state.editOpIdx),
                isLoading: false,
                queryOverview: queryReplayStore.getCurrentQueryOverview(),
                modeRunFullQuery: queryReplayStore.getRunFullQuery(),
                editIsLocked: queryReplayStore.editIsLocked()
            });
        },

        componentDidMount : function () {
            queryReplayStore.addChangeListener(this._storeChangeListener);
        },

        componentWillUnmount : function () {
            queryReplayStore.removeChangeListener(this._storeChangeListener);
        },

        _getEditorProps : function (opIdx, opId) {
            if (['a', 'q'].indexOf(opId) > -1) {
                return this.props.queryFormProps;

            } else if (['p', 'P', 'n', 'N'].indexOf(opId) > -1) {
                return this.props.filterFormProps;

            } else if (opId === 'f') {
                return {
                    shuffleSubmitFn: () => {
                        dispatcher.dispatch({
                            actionType: 'BRANCH_QUERY',
                            props: {
                                operationIdx: opIdx
                            }
                        });
                    }
                }

            } else {
                return {};
            }
        },

        render : function () {
            return (
                <div>
                    {this.state.queryOverview ?
                            <QueryOverivewTable data={this.state.queryOverview} onEditClick={this._handleEditClick} />
                            : null}
                    {this.state.replayIsRunning ? <QueryReplayView /> : null}

                    <ul id="query-overview-bar">
                        {this.props.humanCorpname ?
                                <layoutViews.CorpnameInfoTrigger
                                        corpname={this.props.corpname}
                                        humanCorpname={this.props.humanCorpname}
                                        usesubcorp={this.props.usesubcorp} />
                                : null}
                        {this.state.ops.map((item, i) => {
                            return <QueryOpInfo
                                        key={`op_${i}`}
                                        idx={i}
                                        editOpKey={this.state.editOpKey}
                                        item={item}
                                        clickHandler={this._handleEditClick.bind(this, i)}
                                        hasOpenEditor={this.state.editOpIdx === i && !this.state.replayIsRunning}
                                        editorProps={this.state.editOpIdx === i ? this._getEditorProps(i, item.opid) : null}
                                        closeEditorHandler={this._handleEditorClose}
                                        isLoading={this.state.isLoading}
                                        modeRunFullQuery={this.state.modeRunFullQuery}
                                        numOps={this.state.ops.size}
                                        shuffleMinResultWarning={this.props.shuffleFormProps.shuffleMinResultWarning}
                                        editIsLocked={this.state.editIsLocked} />;
                        })}
                    </ul>
                </div>
            );
        }
    });


    // ------------------------ <RedirectingQueryOverview /> -------------------------------

    const RedirectingQueryOverview = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                ops: queryReplayStore.getCurrEncodedOperations()
            };
        },

        _handleEditClick : function (opIdx) {
            dispatcher.dispatch({
                actionType: 'REDIRECT_TO_EDIT_QUERY_OPERATION',
                props: {
                    operationIdx: opIdx
                }

            });
        },

        render : function () {
            return (
                <ul id="query-overview-bar">
                        {this.props.humanCorpname ?
                                <layoutViews.CorpnameInfoTrigger
                                        corpname={this.props.corpname}
                                        humanCorpname={this.props.humanCorpname}
                                        usesubcorp={this.props.usesubcorp} />
                                : null}
                        {this.state.ops.map((item, i) => {
                            return <QueryOpInfo
                                        key={`op_${i}`}
                                        idx={i}
                                        item={item}
                                        clickHandler={this._handleEditClick.bind(this, i)}
                                        hasOpenEditor={this.state.editOpIdx === i && !this.state.replayIsRunning}
                                        editorProps={this.state.editOpIdx === i ? this._getEditorProps(i, item.opid) : null}
                                        closeEditorHandler={this._handleEditorClose}
                                        isLoading={this.state.isLoading}
                                        modeRunFullQuery={this.state.modeRunFullQuery}
                                        numOps={this.state.ops.size}
                                        shuffleMinResultWarning={this.props.shuffleFormProps.shuffleMinResultWarning}
                                        editIsLocked={this.state.editIsLocked} />;
                        })}
                </ul>
            );
        }

    });


    // ------------------------ <AppendOperationOverlay /> --------------------------------

    const AppendOperationOverlay = React.createClass({

        mixins : mixins,

        _handleCloseClick : function () {
            dispatcher.dispatch({
                actionType: 'MAIN_MENU_CLEAR_ACTIVE_ITEM',
                props: {}
            });
        },

        _createActionBasedForm : function () {
            switch (this.props.menuActiveItem.actionName) {
                case 'MAIN_MENU_SHOW_FILTER':
                    return <viewDeps.FilterFormView {...this.props.filterFormProps} filterId="__new__" />;
                case 'MAIN_MENU_SHOW_SORT':
                    return <viewDeps.SortFormView sortId="__new__" />;
                case 'MAIN_MENU_SHOW_SAMPLE':
                    return <viewDeps.SampleFormView sampleId="__new__" />;
                case 'MAIN_MENU_APPLY_SHUFFLE':
                    return <viewDeps.ShuffleFormView {...this.props.shuffleFormProps}
                                lastOpSize={this.props.lastOpSize} sampleId="__new__" />;
                default:
                    return <div>unknown...</div>;
            }
        },

        _createTitle : function () {
            const m = {
                MAIN_MENU_SHOW_FILTER: 'filter',
                MAIN_MENU_SHOW_SORT: 'sort',
                MAIN_MENU_SHOW_SAMPLE: 'sample',
                MAIN_MENU_APPLY_SHUFFLE: 'shuffle'
            };
            const ident = formTypeToTitle(m[this.props.menuActiveItem.actionName]);
            return this.translate('query__add_an_operation_title_{opname}', {opname: ident});
        },

        render : function () {
            return (
                <layoutViews.ModalOverlay onCloseKey={this._handleCloseClick}>
                    <layoutViews.CloseableFrame
                            customClass="query-form-spa"
                            onCloseClick={this._handleCloseClick}
                            label={this._createTitle()}>
                        {this._createActionBasedForm()}
                    </layoutViews.CloseableFrame>
                </layoutViews.ModalOverlay>
            );
        }
    });


    // ------------------------ <QueryToolbar /> --------------------------------

    const QueryToolbar = React.createClass({

        _mainMenuStoreChangeListener : function () {
            this.setState({
                activeItem: mainMenuStore.getActiveItem(),
                lastOpSize: queryReplayStore.getCurrEncodedOperations().get(-1).size
            });
        },

        componentDidMount : function () {
            mainMenuStore.addChangeListener(this._mainMenuStoreChangeListener);
        },

        componentWillUnmount : function () {
            mainMenuStore.removeChangeListener(this._mainMenuStoreChangeListener);
        },

        getInitialState : function () {
            return {
                activeItem: mainMenuStore.getActiveItem(),
                lastOpSize: queryReplayStore.getCurrEncodedOperations().get(-1).size
            }
        },

        _activeItemIsOurs : function () {
            const actions = [
                'MAIN_MENU_SHOW_SORT',
                'MAIN_MENU_APPLY_SHUFFLE',
                'MAIN_MENU_SHOW_SAMPLE',
                'MAIN_MENU_SHOW_FILTER'
            ];
            return this.state.activeItem !== null && actions.indexOf(this.state.activeItem.actionName) > -1;
        },

        render : function () {
            return (
                <div>
                    <QueryOverview {...this.props} />
                    {this._activeItemIsOurs() ?
                        <AppendOperationOverlay {...this.props} menuActiveItem={this.state.activeItem}
                            lastOpSize={this.state.lastOpSize} /> : null}
                </div>
            );
        }
    });


    // ------------------------ <NonViewPageQueryToolbar /> --------------------------------

    const NonViewPageQueryToolbar = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <div>
                    <RedirectingQueryOverview {...this.props} />
                </div>
            );
        }
    });


    return {
        QueryToolbar: QueryToolbar,
        NonViewPageQueryToolbar: NonViewPageQueryToolbar
    };
}