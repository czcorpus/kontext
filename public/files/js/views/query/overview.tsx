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

import * as React from 'react';
import * as Immutable from 'immutable';
import {init as saveViewInit} from './save';
import {init as basicOverviewInit} from './basicOverview';
import {ActionDispatcher} from '../../app/dispatcher';
import {Kontext} from '../../types/common';
import {IQueryReplayModel, QueryReplayModel, ExtendedQueryOperation} from '../../models/query/replay';
import {QuerySaveAsFormModel, QuerySaveAsFormModelState} from '../../models/query/save';
import {ShuffleFormProps, SampleFormProps, SwitchMainCorpFormProps} from './miscActions';
import {QueryFormLiteProps, QueryFormProps} from './main';
import {FilterFormProps, SubHitsFormProps, FirstHitsFormProps} from './filter';
import { PluginInterfaces } from '../../types/plugins';
import {SortFormProps} from './sort';

/*
Important note regarding variable naming conventions:

[opKey] (operationKey): a hash representing stored query args or string
                        '__new__' when appending a new operation
[opId] (operationId): a general manatee operation type identifier
                      (e.g. 's' - sample, 'q' - query)
[opIdx] (operationIdx): an index of an operation within query pipeline
                        (starting from zero).

In general, client knows by default opId and opIdx when a page is loaded.
Operation key 'opKey' may or may not be available without additional AJAX request.
*/


export interface OverviewModuleArgs {
    dispatcher:ActionDispatcher;
    he:Kontext.ComponentHelpers;
    viewDeps:{
        QueryFormView:React.ComponentClass<QueryFormLiteProps>;
        FilterFormView:React.ComponentClass<FilterFormProps>;
        SubHitsForm:React.ComponentClass<SubHitsFormProps>;
        FirstHitsForm:React.ComponentClass<FirstHitsFormProps>;
        SortFormView:React.ComponentClass<SortFormProps>;
        SampleForm:React.ComponentClass<SampleFormProps>;
        ShuffleForm:React.ComponentClass<ShuffleFormProps>;
        SwitchMainCorpForm:React.ComponentClass<SwitchMainCorpFormProps>;
    };
    queryReplayModel:IQueryReplayModel;
    mainMenuModel:Kontext.IMainMenuModel;
    querySaveAsModel:QuerySaveAsFormModel;
    corparchModel:PluginInterfaces.Corparch.ICorpSelection;
}


export interface QueryToolbarProps {
    corpname:string;
    humanCorpname:string;
    usesubcorp:string;
    origSubcorpName:string;
    foreignSubcorp:boolean;
    queryFormProps:QueryFormLiteProps;
    filterFormProps:FilterFormProps;
    shuffleFormProps:ShuffleFormProps;
    switchMcFormProps:SwitchMainCorpFormProps;
    filterSubHitsFormProps:SubHitsFormProps;
    filterFirstDocHitsFormProps:FirstHitsFormProps;
    sortFormProps:SortFormProps;
}


interface QueryToolbarState {
    activeItem:{actionName:string};
    lastOpSize:number;
}


export interface NonViewPageQueryToolbarProps {
    corpname:string;
    humanCorpname:string;
    usesubcorp:string;
    origSubcorpName:string;
    foreignSubcorp:boolean;
    queryFormProps?:QueryFormProps;
    filterFormProps?:FilterFormProps;
    shuffleFormProps?:ShuffleFormProps;
    switchMcFormProps?:SwitchMainCorpFormProps;
    filterSubHitsFormProps?:SubHitsFormProps;
    filterFirstDocHitsFormProps?:FirstHitsFormProps;
    sortFormProps?:SortFormProps;
}


interface NonViewPageQueryToolbarState {
    ops:Immutable.List<ExtendedQueryOperation>;
    queryOverview:Immutable.List<Kontext.QueryOperation>;
}


export interface OverviewViews {
    QueryToolbar:React.ComponentClass<QueryToolbarProps>;
    NonViewPageQueryToolbar:React.ComponentClass<NonViewPageQueryToolbarProps>;
}


type AnyEditorProps = QueryFormLiteProps | FilterFormProps | SubHitsFormProps | ShuffleFormProps |
        SortFormProps | SampleFormProps | ShuffleFormProps | SwitchMainCorpFormProps | FirstHitsFormProps;


export function init({dispatcher, he, viewDeps, queryReplayModel,
                      mainMenuModel, querySaveAsModel, corparchModel}:OverviewModuleArgs):OverviewViews {

    const layoutViews = he.getLayoutViews();
    const saveViews = saveViewInit(dispatcher, he, querySaveAsModel);
    const basicOverviewViews = basicOverviewInit(dispatcher, he, corparchModel);


    const formTypeToTitle = (opFormType:string) => {
        switch (opFormType) {
            case Kontext.ConcFormTypes.QUERY:
                return he.translate('query__operation_name_query');
            case Kontext.ConcFormTypes.FILTER:
                return he.translate('query__operation_name_filter');
            case Kontext.ConcFormTypes.SORT:
                return he.translate('query__operation_name_sort');
            case Kontext.ConcFormTypes.SAMPLE:
                return he.translate('query__operation_name_sample');
            case Kontext.ConcFormTypes.SHUFFLE:
                return he.translate('query__operation_name_shuffle');
            case Kontext.ConcFormTypes.SWITCHMC:
                return he.translate('query__operation_name_switchmc');
            case Kontext.ConcFormTypes.SUBHITS:
                return he.translate('query__operation_name_subhits');
            case Kontext.ConcFormTypes.FIRSTHITS:
                return he.translate('query__operation_name_firsthits');
            default:
                return null;
        }
    };


    // ------------------------ <QueryReplayView /> --------------------------------

    const QueryReplayView:React.SFC<{}> = (props) => {

        return (
            <layoutViews.ModalOverlay onCloseKey={()=>undefined}>
                <layoutViews.PopupBox customClass="query-replay-box" onCloseClick={()=>undefined}>
                    <div>
                        <h3>{he.translate('query__replay_replaying_query')}{'\u2026'}</h3>
                        <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                                alt={he.translate('global__loading_icon')} />
                        <div />
                    </div>
                </layoutViews.PopupBox>
            </layoutViews.ModalOverlay>
        );
    };

    // ------------------------ <ExecutionOptions /> --------------------------------

    const ExecutionOptions:React.SFC<{
        operationIdx:number;
        modeRunFullQuery:boolean;

    }> = (props) => {

        const handleRadioInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'QUERY_SET_STOP_AFTER_IDX',
                props: {
                    operationIdx: props.operationIdx,
                    value: evt.target.value === 'continue' ? null : props.operationIdx
                }
            });
        };

        return (
            <fieldset className="query-exec-opts">
                <legend>
                    {he.translate('query__execution_opts_fieldset')}
                </legend>
                <ul>
                    <li>
                        <label className={props.modeRunFullQuery ? 'active' : null}>
                            <input type="radio" name="exec-opts" style={{verticalAlign: 'middle'}} value="continue"
                                    checked={props.modeRunFullQuery}
                                    onChange={handleRadioInputChange} />
                            {he.translate('query__behaviour_apply_and_continue')}
                        </label>
                    </li>
                    <li>
                        <label className={!props.modeRunFullQuery ? 'active' : null}>
                            <input type="radio" name="exec-opts" style={{verticalAlign: 'middle'}} value="stop"
                                    checked={!props.modeRunFullQuery}
                                    onChange={handleRadioInputChange} />
                            {he.translate('query__behaviour_apply_and_stop')}
                        </label>
                    </li>
                </ul>
            </fieldset>
        );
    };

    // ------------------------ <QueryEditor /> --------------------------------

    const QueryEditor:React.SFC<{
        isLoading:boolean;
        opKey:string;
        operationId:string;
        editIsLocked:boolean;
        operationIdx:number;
        opEncodedArgs:string;
        editorProps:AnyEditorProps;
        operationFormType:string;
        shuffleMinResultWarning:number;
        resultSize:number;
        modeRunFullQuery:boolean;
        numOps:number;
        closeClickHandler:()=>void;

    }> = (props) => {
        const renderEditorComponent = () => {
            if (props.isLoading) {
                return <img src={he.createStaticUrl('img/ajax-loader-bar.gif')} alt={he.translate('global__loading')} />;

            } else if (!props.opKey || props.editIsLocked) {
                return (
                    <div>
                        <p>
                            <img src={he.createStaticUrl('img/warning-icon.svg')}
                                alt={he.translate('global__warning_icon')}
                                 style={{verticalAlign: 'middle', marginRight: '0.5em'}} />
                            {he.translate('query__replay_op_cannot_be_edited_msg')}.
                        </p>
                        <div style={{textAlign: 'center', marginTop: '2em'}}>
                            <a className="default-button" href={he.createActionLink(`view?${props.opEncodedArgs}`)}>
                                {he.translate('query__replay_view_the_result')}
                            </a>
                        </div>
                    </div>
                );
            }
            switch (props.editorProps.formType) {
                case Kontext.ConcFormTypes.QUERY:
                    return <viewDeps.QueryFormView {...props.editorProps} operationIdx={props.operationIdx} />;

                case Kontext.ConcFormTypes.FILTER:
                    return <viewDeps.FilterFormView {...props.editorProps}
                                operationIdx={props.operationIdx} filterId={props.opKey} />;

                case Kontext.ConcFormTypes.SORT:
                    return <viewDeps.SortFormView sortId={props.opKey} operationIdx={props.operationIdx}
                                                    formType={Kontext.ConcFormTypes.SORT} />;

                case Kontext.ConcFormTypes.SAMPLE:
                    return <viewDeps.SampleForm sampleId={props.opKey} operationIdx={props.operationIdx}
                                                    formType={Kontext.ConcFormTypes.SAMPLE} />;

                case Kontext.ConcFormTypes.SHUFFLE:
                    return <viewDeps.ShuffleForm {...props.editorProps}
                            shuffleMinResultWarning={props.shuffleMinResultWarning}
                            lastOpSize={props.resultSize}
                            operationIdx={props.operationIdx}
                            shuffleSubmitFn={()=>undefined} />;

                case Kontext.ConcFormTypes.SWITCHMC:
                    return <viewDeps.SwitchMainCorpForm {...props.editorProps}
                                operationIdx={props.operationIdx}
                                opKey={props.opKey} />;

                case Kontext.ConcFormTypes.SUBHITS:
                    return <viewDeps.SubHitsForm {...props.editorProps}
                                operationIdx={props.operationIdx}
                                opKey={props.opKey}
                                submitFn={()=>undefined} />;

                case Kontext.ConcFormTypes.FIRSTHITS:
                    return <viewDeps.FirstHitsForm {...props.editorProps}
                                operationIdx={props.operationIdx}
                                opKey={props.opKey} />;

                default:
                    return <div><strong>[??] Unknown component</strong></div>;
            }
        };

        return (
            <layoutViews.ModalOverlay onCloseKey={props.closeClickHandler}>
                <layoutViews.CloseableFrame
                        customClass="query-form-spa"
                        label={he.translate('query__edit_current_hd_{operation}',
                                {operation: formTypeToTitle(props.operationFormType)})}
                        onCloseClick={props.closeClickHandler}>
                    {props.operationIdx < props.numOps - 1 ?
                        <ExecutionOptions modeRunFullQuery={props.modeRunFullQuery}
                                operationIdx={props.operationIdx} />
                        : null
                    }
                    {renderEditorComponent()}
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    };

    // ------------------------ <QueryOpInfo /> --------------------------------

    const QueryOpInfo:React.SFC<{
        idx:number;
        item:ExtendedQueryOperation;
        editorProps:AnyEditorProps;
        hasOpenEditor:boolean;
        editOpKey:string;
        editIsLocked:boolean;
        isLoading:boolean;
        modeRunFullQuery:boolean;
        numOps:number;
        shuffleMinResultWarning:number;
        clickHandler:()=>void;
        closeEditorHandler:()=>void;

    }> = (props) => {

        const renderLabel = () => {
            if (props.idx === 0) {
                return <>
                    {'\u00a0|\u00a0'}
                    <strong key="op">{props.item.op}</strong>
                </>;

            } else {
                return <>
                    <span key="transit" className="transition">{'\u00A0\u25B6\u00A0'}</span>
                    <strong key="op">{props.item.op}</strong>
                    </>;
            }
        };

        return (
            <li className="QueryOpInfo">
                {renderLabel()}{':\u00a0'}
                {props.item.nicearg ?
                    (<a className="args" onClick={props.clickHandler} title={he.translate('query__click_to_edit_the_op')}>
                        <layoutViews.Shortener text={props.item.nicearg} limit={40} />
                    </a>)
                    : (<a className="args" onClick={props.clickHandler} title={he.translate('query__click_to_edit_the_op')}>
                        {'\u2713'}</a>)
                    }
                {props.item.size ?
                        '\u00a0(' + he.translate('query__overview_hits_{num_hits}',
                        {num_hits: props.item.size}) + ')'
                    : null}
                {props.hasOpenEditor ?
                    <QueryEditor
                        editorProps={props.editorProps}
                        closeClickHandler={props.closeEditorHandler}
                        operationIdx={props.idx}
                        operationId={props.item.opid}
                        operationFormType={props.item.formType}
                        opKey={props.editOpKey}
                        opEncodedArgs={props.item.tourl}
                        isLoading={props.isLoading}
                        modeRunFullQuery={props.modeRunFullQuery}
                        numOps={props.numOps}
                        shuffleMinResultWarning={props.shuffleMinResultWarning}
                        resultSize={props.item.size}
                        editIsLocked={props.editIsLocked} />
                    : null}
            </li>
        );
    };


    // ------------------------ <QueryOverview /> --------------------------------

    class QueryOverview extends React.Component<{
        corpname:string;
        humanCorpname:string;
        usesubcorp:string;
        origSubcorpName:string;
        foreignSubcorp:boolean;
        queryFormProps:QueryFormLiteProps;
        filterFormProps:FilterFormProps;
        filterFirstDocHitsFormProps:FirstHitsFormProps;
        switchMcFormProps:SwitchMainCorpFormProps;
        shuffleFormProps:ShuffleFormProps;
    },
    {
        replayIsRunning:boolean;
        ops:Immutable.List<ExtendedQueryOperation>;
        editOpIdx:number;
        editOpKey:string;
        isLoading:boolean;
        queryOverview:Immutable.List<Kontext.QueryOperation>;
        modeRunFullQuery:boolean;
        editIsLocked:boolean;
    }> {

        constructor(props) {
            super(props);
            this._handleEditClick = this._handleEditClick.bind(this);
            this._handleEditorClose = this._handleEditorClose.bind(this);
            this._modelChangeListener = this._modelChangeListener.bind(this);
            this.state = {
                replayIsRunning: (queryReplayModel as QueryReplayModel).getBranchReplayIsRunning(),
                ops: queryReplayModel.getCurrEncodedOperations(),
                editOpIdx: null,
                editOpKey: null,
                isLoading: false,
                queryOverview: (queryReplayModel as QueryReplayModel).getCurrentQueryOverview(),
                modeRunFullQuery: (queryReplayModel as QueryReplayModel).getRunFullQuery(),
                editIsLocked: (queryReplayModel as QueryReplayModel).editIsLocked()
            };
        }

        _handleEditClick(idx) {
            dispatcher.dispatch({
                actionType: 'EDIT_QUERY_OPERATION',
                props: {operationIdx: idx}
            });
        }

        _handleEditorClose() {
            this.setState({
                replayIsRunning: (queryReplayModel as QueryReplayModel).getBranchReplayIsRunning(),
                ops: queryReplayModel.getCurrEncodedOperations(),
                editOpIdx: null,
                editOpKey: null,
                isLoading: false,
                queryOverview: null,
                modeRunFullQuery: (queryReplayModel as QueryReplayModel).getRunFullQuery(),
                editIsLocked: (queryReplayModel as QueryReplayModel).editIsLocked()
            });
        }

        _modelChangeListener() {
            this.setState({
                replayIsRunning: (queryReplayModel as QueryReplayModel).getBranchReplayIsRunning(),
                ops: queryReplayModel.getCurrEncodedOperations(),
                editOpIdx: (queryReplayModel as QueryReplayModel).getEditedOperationIdx(),
                editOpKey: (queryReplayModel as QueryReplayModel).opIdxToCachedQueryKey(this.state.editOpIdx),
                isLoading: false,
                queryOverview: (queryReplayModel as QueryReplayModel).getCurrentQueryOverview(),
                modeRunFullQuery: (queryReplayModel as QueryReplayModel).getRunFullQuery(),
                editIsLocked: (queryReplayModel as QueryReplayModel).editIsLocked()
            });
        }

        componentDidMount() {
            queryReplayModel.addChangeListener(this._modelChangeListener);
        }

        componentWillUnmount() {
            queryReplayModel.removeChangeListener(this._modelChangeListener);
        }

        _getEditorProps(opIdx, opId):AnyEditorProps {
            if (['a', 'q'].indexOf(opId) > -1) {
                return this.props.queryFormProps;

            } else if (['p', 'P', 'n', 'N'].indexOf(opId) > -1) {
                return this.props.filterFormProps;

            } else if (opId === 'f') {
                return {
                    formType: Kontext.ConcFormTypes.SHUFFLE,
                    shuffleMinResultWarning: null,
                    lastOpSize: null,
                    operationIdx: opIdx,
                    shuffleSubmitFn: () => {
                        dispatcher.dispatch({
                            actionType: 'BRANCH_QUERY',
                            props: {
                                operationIdx: opIdx
                            }
                        });
                    }
                }

            } else if (opId === 'D') {
                return {
                    formType: Kontext.ConcFormTypes.SUBHITS,
                    operationIdx: opIdx,
                    opKey: null,
                    submitFn: () => {
                        dispatcher.dispatch({
                            actionType: 'BRANCH_QUERY',
                            props: {
                                operationIdx: opIdx
                            }
                        });
                    }
                }

            } else if (opId === 'F') {
                return this.props.filterFirstDocHitsFormProps;

            } else if (opId === 'x') {
                return this.props.switchMcFormProps;

            } else {
                return null;
            }
        }

        render() {
            return (
                <div>
                    {this.state.queryOverview ?
                            <basicOverviewViews.QueryOverviewTable data={this.state.queryOverview}
                                onEditClick={this._handleEditClick} /> :
                            null}
                    {this.state.replayIsRunning ? <QueryReplayView /> : null}

                    <ul id="query-overview-bar">
                        {this.props.humanCorpname ?
                                <layoutViews.CorpnameInfoTrigger
                                        corpname={this.props.corpname}
                                        humanCorpname={this.props.humanCorpname}
                                        usesubcorp={this.props.usesubcorp}
                                        origSubcorpName={this.props.origSubcorpName}
                                        foreignSubcorp={this.props.foreignSubcorp} />
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
    }


    // ------------------------ <RedirectingQueryOverview /> -------------------------------

    const RedirectingQueryOverview:React.SFC<{
        corpname:string;
        humanCorpname:string;
        usesubcorp:string;
        origSubcorpName:string;
        foreignSubcorp:boolean;
        ops:Immutable.List<ExtendedQueryOperation>;

    }> = (props) => {

        const handleEditClickFn = (opIdx) => {
            return () => {
                dispatcher.dispatch({
                    actionType: 'REDIRECT_TO_EDIT_QUERY_OPERATION',
                    props: {
                        operationIdx: opIdx
                    }
                });
            };
        };

        return (
            <ul id="query-overview-bar">
                    {props.humanCorpname ?
                            <layoutViews.CorpnameInfoTrigger
                                    corpname={props.corpname}
                                    humanCorpname={props.humanCorpname}
                                    usesubcorp={props.usesubcorp}
                                    origSubcorpName={props.origSubcorpName}
                                    foreignSubcorp={props.foreignSubcorp} />
                            : null}
                    {props.ops.map((item, i) => {
                        return <QueryOpInfo
                                    key={`op_${i}`}
                                    idx={i}
                                    item={item}
                                    clickHandler={handleEditClickFn(i)}
                                    hasOpenEditor={false}
                                    editOpKey={null}
                                    editorProps={null}
                                    closeEditorHandler={()=>undefined}
                                    isLoading={false}
                                    modeRunFullQuery={false}
                                    numOps={props.ops.size}
                                    shuffleMinResultWarning={null}
                                    editIsLocked={true} />;
                    })}
            </ul>
        );
    }


    // ------------------------ <AppendOperationOverlay /> --------------------------------

    /**
     * A component wrapping a new operation form to be
     * added to the query chain.
     */
    const AppendOperationOverlay:React.SFC<{
        menuActiveItem:{actionName:string};
        filterFormProps:FilterFormProps;
        shuffleFormProps:ShuffleFormProps;
        switchMcFormProps:SwitchMainCorpFormProps;
        filterSubHitsFormProps:SubHitsFormProps;
        filterFirstDocHitsFormProps:FirstHitsFormProps;
        lastOpSize:number;

    }> = (props) => {
        const handleCloseClick = () => {
            dispatcher.dispatch({
                actionType: 'MAIN_MENU_CLEAR_ACTIVE_ITEM',
                props: {}
            });
        };

        const createActionBasedForm = () => {
            switch (props.menuActiveItem.actionName) {
                case 'MAIN_MENU_SHOW_FILTER':
                    return <viewDeps.FilterFormView {...props.filterFormProps} filterId="__new__" />;
                case 'MAIN_MENU_SHOW_SORT':
                    return <viewDeps.SortFormView sortId="__new__" formType={Kontext.ConcFormTypes.SORT} />;
                case 'MAIN_MENU_SHOW_SAMPLE':
                    return <viewDeps.SampleForm sampleId="__new__" formType={Kontext.ConcFormTypes.SAMPLE} />;
                case 'MAIN_MENU_APPLY_SHUFFLE':
                    return <viewDeps.ShuffleForm {...props.shuffleFormProps}
                                lastOpSize={props.lastOpSize}
                                formType={Kontext.ConcFormTypes.SHUFFLE} />;
                case 'MAIN_MENU_FILTER_APPLY_SUBHITS_REMOVE':
                    return <viewDeps.SubHitsForm {...props.filterSubHitsFormProps}
                                    opKey="__new__" />;
                case 'MAIN_MENU_FILTER_APPLY_FIRST_OCCURRENCES':
                    return <viewDeps.FirstHitsForm {...props.filterFirstDocHitsFormProps}
                                    opKey="__new__" />;
                case 'MAIN_MENU_SHOW_SWITCHMC':
                    return <viewDeps.SwitchMainCorpForm {...props.switchMcFormProps}
                                            formType={Kontext.ConcFormTypes.SWITCHMC} />;
                default:
                    return <div>??</div>;
            }
        };

        const createTitle = () => {
            const m = {
                MAIN_MENU_SHOW_FILTER: Kontext.ConcFormTypes.FILTER,
                MAIN_MENU_SHOW_SORT: Kontext.ConcFormTypes.SORT,
                MAIN_MENU_SHOW_SAMPLE: Kontext.ConcFormTypes.SAMPLE,
                MAIN_MENU_APPLY_SHUFFLE: Kontext.ConcFormTypes.SHUFFLE,
                MAIN_MENU_SHOW_SWITCHMC: Kontext.ConcFormTypes.SWITCHMC,
                MAIN_MENU_FILTER_APPLY_SUBHITS_REMOVE: Kontext.ConcFormTypes.SUBHITS,
                MAIN_MENU_FILTER_APPLY_FIRST_OCCURRENCES: Kontext.ConcFormTypes.FIRSTHITS
            };
            const ident = formTypeToTitle(m[props.menuActiveItem.actionName]);
            return he.translate('query__add_an_operation_title_{opname}', {opname: ident});
        };

        return (
            <layoutViews.ModalOverlay onCloseKey={handleCloseClick}>
                <layoutViews.CloseableFrame
                        customClass="query-form-spa"
                        onCloseClick={handleCloseClick}
                        label={createTitle()}>
                    {createActionBasedForm()}
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    };

    // ------------------------ <PersistentConcordanceForm /> --------------------------------

    class PersistentConcordanceForm extends React.Component<{}, QuerySaveAsFormModelState> {

        constructor(props) {
            super(props);
            this.state = querySaveAsModel.getState();
            this.handleCloseEvent = this.handleCloseEvent.bind(this);
            this.handleModelChange = this.handleModelChange.bind(this);
            this.handleSubmit = this.handleSubmit.bind(this);
        }

        private handleCloseEvent() {
            dispatcher.dispatch({
                actionType: 'MAIN_MENU_CLEAR_ACTIVE_ITEM',
                props: {}
            });
        }

        private handleSubmit() {
            dispatcher.dispatch({
                actionType: 'QUERY_MAKE_CONCORDANCE_PERMANENT',
                props: {revoke: false}
            });
        }

        private handleRevokeSubmit() {
            dispatcher.dispatch({
                actionType: 'QUERY_MAKE_CONCORDANCE_PERMANENT',
                props: {revoke: true}
            });
        }

        private handleModelChange(state) {
            this.setState(state);
        }

        private createPermanentUrl() {
            return he.createActionLink('view', [['q', '~' + this.state.queryId]]);
        }

        componentDidMount() {
            querySaveAsModel.addChangeListener(this.handleModelChange);
            dispatcher.dispatch({
                actionType: 'QUERY_GET_CONC_ARCHIVED_STATUS',
                props: {}
            });
        }

        componentWillUnmount() {
            querySaveAsModel.removeChangeListener(this.handleModelChange);
        }

        render() {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.handleCloseEvent}>
                    <layoutViews.CloseableFrame onCloseClick={this.handleCloseEvent}
                                customClass="PersistentConcordanceForm"
                                label={he.translate('concview__make_conc_link_permanent_hd')}>
                        {this.state.isBusy ?
                            <layoutViews.AjaxLoaderImage /> :
                            <form>
                                <p className="hint">
                                    <layoutViews.StatusIcon status="info" inline={true} htmlClass="icon" />
                                    {this.state.concIsArchived ?
                                        he.translate('concview__permanent_link_is_archived') + ':' :
                                        he.translate('concview__permanent_link_hint_{ttl}', {ttl: this.state.concTTLDays})
                                    }
                                </p>
                                <div>
                                    <input type="text" readOnly={true}
                                            disabled={!this.state.concIsArchived}
                                            value={this.createPermanentUrl()}
                                            className={this.state.concIsArchived ? 'archived' : ''}
                                            onClick={e => this.state.concIsArchived ?
                                                            (e.target as HTMLInputElement).select() : null} />
                                </div>
                                <p>
                                    {this.state.concIsArchived ?
                                        <button type="button" className="danger-button"
                                                onClick={this.handleRevokeSubmit}>
                                            {he.translate('concview__make_conc_link_permanent_revoke_archived')}
                                        </button> :
                                        <button type="button" className="default-button"
                                                onClick={this.handleSubmit}>
                                            {he.translate('global__proceed')}
                                        </button>
                                    }
                                </p>
                            </form>
                        }
                    </layoutViews.CloseableFrame>
                </layoutViews.ModalOverlay>
            );
        }
    }


    // ------------------------ <QueryToolbar /> --------------------------------

    class QueryToolbar extends React.Component<QueryToolbarProps, QueryToolbarState>  {

        constructor(props) {
            super(props);
            this._mainMenuModelChangeListener = this._mainMenuModelChangeListener.bind(this);
            this.state = this._fetchModelState();
        }

        _fetchModelState() {
            return {
                activeItem: mainMenuModel.getActiveItem(),
                lastOpSize: queryReplayModel.getCurrEncodedOperations().size > 0 ?
                        queryReplayModel.getCurrEncodedOperations().get(-1).size : 0
            };
        }

        _mainMenuModelChangeListener() {
            this.setState(this._fetchModelState());
        }

        componentDidMount() {
            mainMenuModel.addChangeListener(this._mainMenuModelChangeListener);
        }

        componentWillUnmount() {
            mainMenuModel.removeChangeListener(this._mainMenuModelChangeListener);
        }

        _renderOperationForm() {
            const actions = [
                'MAIN_MENU_SHOW_SORT',
                'MAIN_MENU_APPLY_SHUFFLE',
                'MAIN_MENU_SHOW_SAMPLE',
                'MAIN_MENU_SHOW_FILTER',
                'MAIN_MENU_FILTER_APPLY_SUBHITS_REMOVE',
                'MAIN_MENU_FILTER_APPLY_FIRST_OCCURRENCES'
            ];
            if (this.state.activeItem !== null && actions.indexOf(this.state.activeItem.actionName) > -1) {
                return <AppendOperationOverlay {...this.props} menuActiveItem={this.state.activeItem}
                            lastOpSize={this.state.lastOpSize} />

            } else {
                return null;
            }
        }

        _renderSaveForm() {
            if (this.state.activeItem) {
                switch (this.state.activeItem.actionName) {
                    case 'MAIN_MENU_SHOW_SAVE_QUERY_AS_FORM':
                        return <saveViews.QuerySaveAsForm />;
                    case 'MAIN_MENU_MAKE_CONC_LINK_PERSISTENT':
                        return <PersistentConcordanceForm />;
                }
            }
            return null;
        }

        render() {
            return (
                <div>
                    <QueryOverview {...this.props} />
                    {this._renderOperationForm()}
                    {this._renderSaveForm()}
                </div>
            );
        }
    }


    // ------------------------ <NonViewPageQueryToolbar /> --------------------------------

    class NonViewPageQueryToolbar extends React.Component<NonViewPageQueryToolbarProps, NonViewPageQueryToolbarState> {

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._handleModelChange = this._handleModelChange.bind(this);
        }

        _fetchModelState() {
            return {
                ops: queryReplayModel.getCurrEncodedOperations(),
                queryOverview: queryReplayModel.getCurrentQueryOverview()
            };
        }

        _handleModelChange() {
            this.setState(this._fetchModelState());
        }

        componentDidMount() {
            queryReplayModel.addChangeListener(this._handleModelChange);
        }

        componentWillUnmount() {
            queryReplayModel.removeChangeListener(this._handleModelChange);
        }

        render() {
            return (
                <div>
                    <RedirectingQueryOverview {...this.props} ops={this.state.ops} />
                    {this.state.queryOverview !== null ?
                        <basicOverviewViews.QueryOverviewTable data={this.state.queryOverview}
                                onEditClick={()=>undefined} /> :
                    null}
                </div>
            );
        }
    };


    return {
        QueryToolbar: QueryToolbar,
        NonViewPageQueryToolbar: NonViewPageQueryToolbar
    };
}