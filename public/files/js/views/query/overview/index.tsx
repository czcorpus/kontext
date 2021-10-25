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
import { IActionDispatcher, BoundWithProps, IModel, Bound } from 'kombo';
import { List, tuple } from 'cnc-tskit';

import { init as saveViewInit } from '../save';
import { init as basicOverviewInit } from '../basicOverview';
import * as Kontext from '../../../types/kontext';
import { ExtendedQueryOperation } from '../../../models/query/replay/common';
import { QueryReplayModelState, QueryReplayModel } from '../../../models/query/replay';
import { IndirectQueryReplayModel, IndirectQueryReplayModelState } from '../../../models/query/replay/indirect';
import { QuerySaveAsFormModel, QuerySaveAsFormModelState } from '../../../models/query/save';
import { Actions } from '../../../models/query/actions';
import { Actions as MainMenuActions } from '../../../models/mainMenu/actions';
import { Actions as ConcActions } from '../../../models/concordance/actions';
import { ShuffleFormProps, SampleFormProps, SwitchMainCorpFormProps } from '../miscActions';
import { QueryFormLiteProps, QueryFormProps } from '../first';
import { FilterFormProps, SubHitsFormProps, FirstHitsFormProps} from '../filter';
import { SortFormProps } from '../sort';
import { MainMenuModelState } from '../../../models/mainMenu';
import * as S from './style';
import { PersistentConcordanceForm as Style_PersistentConcordanceForm,
        SaveHintParagraph as Style_SaveHintParagraph } from '../style';
import { QueryOverviewBarUL as Style_QueryOverviewBarUL } from '../basicOverview/style';

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
    dispatcher:IActionDispatcher;
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
    queryReplayModel:QueryReplayModel|IndirectQueryReplayModel;
    mainMenuModel:IModel<MainMenuModelState>;
    querySaveAsModel:QuerySaveAsFormModel;
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
    sampleFormProps:SampleFormProps;
    switchMcFormProps:SwitchMainCorpFormProps;
    filterSubHitsFormProps:SubHitsFormProps;
    filterFirstDocHitsFormProps:FirstHitsFormProps;
    sortFormProps:SortFormProps;
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

export interface OverviewViews {
    QueryToolbar:React.ComponentClass<QueryToolbarProps>;
    NonViewPageQueryToolbar:React.ComponentClass<NonViewPageQueryToolbarProps>;
}


type AnyEditorProps = QueryFormLiteProps | FilterFormProps | SubHitsFormProps | ShuffleFormProps |
        SortFormProps | SampleFormProps | ShuffleFormProps | SwitchMainCorpFormProps | FirstHitsFormProps;


export function init({dispatcher, he, viewDeps, queryReplayModel,
                      mainMenuModel, querySaveAsModel}:OverviewModuleArgs):OverviewViews {

    const layoutViews = he.getLayoutViews();
    const saveViews = saveViewInit(dispatcher, he, querySaveAsModel);
    const basicOverviewViews = basicOverviewInit(dispatcher, he, mainMenuModel);


    const formTypeToTitle = (opFormType:string, subvariant?:string) => {
        switch (opFormType) {
            case Kontext.ConcFormTypes.QUERY:
                return he.translate('query__operation_name_query');
            case Kontext.ConcFormTypes.FILTER:
                if (subvariant === 'p') {
                    return he.translate('query__operation_name_filter_p');

                } else if (subvariant === 'n') {
                    return he.translate('query__operation_name_filter_n');
                }
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

    const QueryReplayView:React.FC<{}> = (props) => {

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

    const ExecutionOptions:React.FC<{
        operationIdx:number;
        modeRunFullQuery:boolean;

    }> = (props) => {

        const handleRadioInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.QuerySetStopAfterIdx>({
                name: Actions.QuerySetStopAfterIdx.name,
                payload: {
                    value: evt.target.value === 'continue' ? null : props.operationIdx
                }
            });
        };

        return (
            <S.ExecutionOptionsFieldset>
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
            </S.ExecutionOptionsFieldset>
        );
    };

    // ------------------------ <QueryEditor /> --------------------------------

    const QueryEditor:React.FC<{
        corpname:string;
        opKey:string;
        operationId:string;
        groupsSelected:boolean;
        operationIdx:number;
        editorProps:AnyEditorProps;
        operationFormType:string;
        shuffleMinResultWarning:number;
        resultSize:number;
        modeRunFullQuery:boolean;
        numOps:number;
        isLoading:boolean;
        closeClickHandler:()=>void;

    }> = (props) => {

        const handleTrimClick = () => {
            dispatcher.dispatch<typeof Actions.TrimQuery>({
                name: Actions.TrimQuery.name,
                payload: {
                    operationIdx: props.operationIdx
                }
            });
        };

        const renderEditorComponent = () => {
            if (props.isLoading) {
                return <img src={he.createStaticUrl('img/ajax-loader-bar.gif')} alt={he.translate('global__loading')} />;

            } else if (!props.opKey || props.groupsSelected) {
                return (
                    <div>
                        <p>
                            <img src={he.createStaticUrl('img/warning-icon.svg')}
                                alt={he.translate('global__warning_icon')}
                                 style={{verticalAlign: 'middle', marginRight: '0.5em'}} />
                            {he.translate('query__replay_op_cannot_be_edited_msg')}.
                        </p>
                        <div style={{textAlign: 'center', marginTop: '2em'}}>
                            <a className="default-button" onClick={handleTrimClick}>
                                {he.translate('query__replay_view_the_result')}
                            </a>
                        </div>
                    </div>
                );
            }
            switch (props.editorProps.formType) {
                case Kontext.ConcFormTypes.QUERY:
                    return <viewDeps.QueryFormView {...props.editorProps} operationIdx={props.operationIdx}
                                corpname={props.corpname} />;

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
                            formType={Kontext.ConcFormTypes.SHUFFLE}
                            shuffleSubmitFn={()=>undefined} />;

                case Kontext.ConcFormTypes.SWITCHMC:
                    return <viewDeps.SwitchMainCorpForm {...props.editorProps}
                                operationIdx={props.operationIdx}
                                opKey={props.opKey}
                                formType={Kontext.ConcFormTypes.SWITCHMC} />;

                case Kontext.ConcFormTypes.SUBHITS:
                    return <viewDeps.SubHitsForm {...props.editorProps}
                                operationIdx={props.operationIdx}
                                opKey={props.opKey}
                                formType={Kontext.ConcFormTypes.SUBHITS}
                                submitFn={()=>undefined} />;

                case Kontext.ConcFormTypes.FIRSTHITS:
                    return <viewDeps.FirstHitsForm {...props.editorProps}
                                operationIdx={props.operationIdx}
                                opKey={props.opKey}
                                formType={Kontext.ConcFormTypes.FIRSTHITS} />;

                default:
                    return <div><strong>[??] Unknown component</strong></div>;
            }
        };

        return (
            <layoutViews.ModalOverlay onCloseKey={props.closeClickHandler}>
                <layoutViews.CloseableFrame
                        scrollable={true}
                        label={he.translate('query__edit_current_hd_{operation}',
                                {operation: formTypeToTitle(props.operationFormType)})}
                        onCloseClick={props.closeClickHandler}>
                    <S.QueryFormOverlay>
                        {props.operationIdx < props.numOps - 1 ?
                            <ExecutionOptions modeRunFullQuery={props.modeRunFullQuery}
                                    operationIdx={props.operationIdx} />
                            : null
                        }
                        {renderEditorComponent()}
                    </S.QueryFormOverlay>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    };

    // ------------------------ <QueryOpInfo /> --------------------------------

    const QueryOpInfo:React.FC<{
        idx:number;
        corpname:string;
        numOps:number;
        item:ExtendedQueryOperation;
        editorProps:AnyEditorProps;
        hasOpenEditor:boolean;
        groupsSelected:boolean;
        isLoading:boolean;
        modeRunFullQuery:boolean;
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
                        corpname={props.corpname}
                        editorProps={props.editorProps}
                        closeClickHandler={props.closeEditorHandler}
                        operationIdx={props.idx}
                        operationId={props.item.opid}
                        operationFormType={props.item.formType}
                        opKey={props.item.concPersistenceId}
                        isLoading={props.isLoading}
                        modeRunFullQuery={props.modeRunFullQuery}
                        numOps={props.numOps}
                        shuffleMinResultWarning={props.shuffleMinResultWarning}
                        resultSize={props.item.size}
                        groupsSelected={props.groupsSelected} />
                    : null}
            </li>
        );
    };


    // ------------------------ <QueryOverview /> --------------------------------

    interface QueryOverviewProps {
        corpname:string;
        humanCorpname:string;
        usesubcorp:string;
        origSubcorpName:string;
        foreignSubcorp:boolean;
        queryFormProps:QueryFormLiteProps;
        filterFormProps:FilterFormProps;
        filterFirstDocHitsFormProps:FirstHitsFormProps;
        sortFormProps:SortFormProps;
        sampleFormProps:SampleFormProps;
        switchMcFormProps:SwitchMainCorpFormProps;
        shuffleFormProps:ShuffleFormProps;
    }

    const QueryOverview:React.FC<QueryOverviewProps & QueryReplayModelState> = (props) => {


        const handleEditClick = (operationIdx:number) => () => {
            dispatcher.dispatch<typeof Actions.EditQueryOperation>({
                name: Actions.EditQueryOperation.name,
                payload: {
                    operationIdx
                }
            });
        };

        const handleGroupsClick = () => {
            dispatcher.dispatch(
                ConcActions.ToggleLineSelOptions
            );
        };

        const getEditorProps = (opIdx:number, opId:string):AnyEditorProps => {
            if (['a', 'q'].indexOf(opId) > -1) {
                return props.queryFormProps;

            } else if (['p', 'P', 'n', 'N'].indexOf(opId) > -1) {
                return props.filterFormProps;

            } else if (List.some(v => v === opId, ['s'])) {
                return props.sortFormProps;

            } else if (opId === 'f') {
                return {
                    formType: Kontext.ConcFormTypes.SHUFFLE,
                    shuffleMinResultWarning: null,
                    lastOpSize: null,
                    operationIdx: opIdx,
                    shuffleSubmitFn: () => {
                        dispatcher.dispatch<typeof Actions.BranchQuery>({
                            name: Actions.BranchQuery.name,
                            payload: {
                                operationIdx: opIdx
                            }
                        });
                    }
                }

            } else if (opId === 'r') {
                return {
                    formType: Kontext.ConcFormTypes.SAMPLE,
                    sampleId: opId
                };

            } else if (opId === 'D') {
                return {
                    formType: Kontext.ConcFormTypes.SUBHITS,
                    operationIdx: opIdx,
                    opKey: null,
                    submitFn: () => {
                        dispatcher.dispatch<typeof Actions.BranchQuery>({
                            name: Actions.BranchQuery.name,
                            payload: {
                                operationIdx: opIdx
                            }
                        });
                    }
                }

            } else if (opId === 'F') {
                return props.filterFirstDocHitsFormProps;

            } else if (opId === 'x') {
                return props.switchMcFormProps;

            } else {
                return null;
            }
        };

        const handleEditorClose = () => {
            dispatcher.dispatch<typeof Actions.QueryOverviewEditorClose>({
                name:  Actions.QueryOverviewEditorClose.name
            });
        };

        return (
            <div>
                {props.currentQueryOverview ?
                        <basicOverviewViews.QueryOverviewTable data={props.currentQueryOverview}
                            onEditClick={handleEditClick(0)} /> :
                        null}
                {props.branchReplayIsRunning ? <QueryReplayView /> : null}

                <Style_QueryOverviewBarUL>
                    {props.humanCorpname ?
                            <layoutViews.CorpnameInfoTrigger
                                    corpname={props.corpname}
                                    humanCorpname={props.humanCorpname}
                                    usesubcorp={props.usesubcorp}
                                    origSubcorpName={props.origSubcorpName}
                                    foreignSubcorp={props.foreignSubcorp} />
                            : null}
                    {List.map(
                        (item, i) => (
                            <QueryOpInfo
                                corpname={props.corpname}
                                key={`op_${i}`}
                                idx={i}
                                item={item}
                                numOps={List.size(props.currEncodedOperations)}
                                clickHandler={handleEditClick(i)}
                                hasOpenEditor={props.editedOperationIdx === i && !props.branchReplayIsRunning}
                                editorProps={props.editedOperationIdx === i ? getEditorProps(i, item.opid) : null}
                                closeEditorHandler={handleEditorClose}
                                isLoading={props.branchReplayIsRunning}
                                modeRunFullQuery={props.stopAfterOpIdx === null}
                                shuffleMinResultWarning={props.shuffleFormProps.shuffleMinResultWarning}
                                groupsSelected={props.groupsSelected} />
                        ),
                        props.currEncodedOperations
                    )}
                    {props.groupsSelected ? '\u00a0' : null}
                    {props.groupsSelected ?
                        <S.GroupIndicator onClick={handleGroupsClick} aria-label={he.translate('concview__op_result_has_groups')}
                                title={he.translate('concview__op_result_has_groups')}>
                            <S.Rect color='red' />
                            <S.Rect color='green' />
                            <S.Rect color='blue' />
                            <S.Rect color='orange' />
                        </S.GroupIndicator> :
                        null
                    }
                </Style_QueryOverviewBarUL>
            </div>
        );
    }

    const BoundQueryOverview = BoundWithProps<QueryOverviewProps, QueryReplayModelState|IndirectQueryReplayModelState>(
        QueryOverview, queryReplayModel);


    // ------------------------ <RedirectingQueryOverview /> -------------------------------

    const RedirectingQueryOverview:React.FC<{
        corpname:string;
        humanCorpname:string;
        usesubcorp:string;
        origSubcorpName:string;
        foreignSubcorp:boolean;
        ops:Array<ExtendedQueryOperation>;

    }> = (props) => {

        const handleEditClickFn = (opIdx) => {
            return () => {
                dispatcher.dispatch<typeof Actions.RedirectToEditQueryOperation>({
                    name: Actions.RedirectToEditQueryOperation.name,
                    payload: {
                        operationIdx: opIdx
                    }
                });
            };
        };

        return (
            <Style_QueryOverviewBarUL>
                    {props.humanCorpname ?
                            <layoutViews.CorpnameInfoTrigger
                                    corpname={props.corpname}
                                    humanCorpname={props.humanCorpname}
                                    usesubcorp={props.usesubcorp}
                                    origSubcorpName={props.origSubcorpName}
                                    foreignSubcorp={props.foreignSubcorp} />
                            : null}
                    {List.map(
                        (item, i) => <QueryOpInfo
                            key={`op_${i}`}
                            corpname={props.corpname}
                            idx={i}
                            item={item}
                            clickHandler={handleEditClickFn(i)}
                            hasOpenEditor={false}
                            numOps={List.size(props.ops)}
                            editorProps={null}
                            closeEditorHandler={()=>undefined}
                            isLoading={false}
                            modeRunFullQuery={false}
                            shuffleMinResultWarning={null}
                            groupsSelected={true} />,
                        props.ops
                    )}
            </Style_QueryOverviewBarUL>
        );
    }


    // ------------------------ <AppendOperationOverlay /> --------------------------------

    interface AppendOperationOverlayProps {
        menuActiveItem:{actionName:string, actionArgs:{}};
        filterFormProps:FilterFormProps;
        shuffleFormProps:ShuffleFormProps;
        switchMcFormProps:SwitchMainCorpFormProps;
        filterSubHitsFormProps:SubHitsFormProps;
        filterFirstDocHitsFormProps:FirstHitsFormProps;
    }

    /**
     * A component wrapping a new operation form to be
     * added to the query chain.
     */
    const AppendOperationOverlay:React.FC<AppendOperationOverlayProps & {currEncodedOperations:Array<ExtendedQueryOperation>}
    > = (props) => {
        const handleCloseClick = () => {
            dispatcher.dispatch<typeof MainMenuActions.ClearActiveItem>({
                name: MainMenuActions.ClearActiveItem.name
            });
        };

        const createActionBasedForm = () => {
            switch (props.menuActiveItem.actionName) {
                case MainMenuActions.ShowFilter.name:
                    return <viewDeps.FilterFormView {...props.filterFormProps} filterId="__new__" />;
                case MainMenuActions.ShowSort.name:
                    return <viewDeps.SortFormView sortId="__new__" formType={Kontext.ConcFormTypes.SORT} />;
                case MainMenuActions.ShowSample.name:
                    return <viewDeps.SampleForm sampleId="__new__" formType={Kontext.ConcFormTypes.SAMPLE} />;
                case MainMenuActions.ApplyShuffle.name:
                    return <viewDeps.ShuffleForm {...props.shuffleFormProps}
                                lastOpSize={props.currEncodedOperations.length > 0 ?
                                    props.currEncodedOperations[props.currEncodedOperations.length - 1].size : 0}
                                formType={Kontext.ConcFormTypes.SHUFFLE} />;
                case MainMenuActions.FilterApplySubhitsRemove.name:
                    return <viewDeps.SubHitsForm {...props.filterSubHitsFormProps}
                                    opKey="__new__" />;
                case MainMenuActions.FilterApplyFirstOccurrences.name:
                    return <viewDeps.FirstHitsForm {...props.filterFirstDocHitsFormProps}
                                    opKey="__new__" />;
                case MainMenuActions.ShowSwitchMc.name:
                    return <viewDeps.SwitchMainCorpForm {...props.switchMcFormProps}
                                            formType={Kontext.ConcFormTypes.SWITCHMC} />;
                default:
                    return <div>??</div>;
            }
        };

        const createTitle = () => {
            const m = {
                [MainMenuActions.ShowFilter.name]: (args:{}) => tuple(Kontext.ConcFormTypes.FILTER, args['pnfilter']),
                [MainMenuActions.ShowSort.name]: () => tuple(Kontext.ConcFormTypes.SORT, null),
                [MainMenuActions.ShowSample.name]: () => tuple(Kontext.ConcFormTypes.SAMPLE, null),
                [MainMenuActions.ApplyShuffle.name]: () => tuple(Kontext.ConcFormTypes.SHUFFLE, null),
                [MainMenuActions.ShowSwitchMc.name]: () => tuple(Kontext.ConcFormTypes.SWITCHMC, null),
                [MainMenuActions.FilterApplySubhitsRemove.name]: () => tuple(Kontext.ConcFormTypes.SUBHITS, null),
                [MainMenuActions.FilterApplyFirstOccurrences.name]: () => tuple(Kontext.ConcFormTypes.FIRSTHITS, null)
            };
            const [ident, subtype] = m[props.menuActiveItem.actionName](props.menuActiveItem.actionArgs);
            const opname = formTypeToTitle(ident, subtype);
            return he.translate('query__add_an_operation_title_{opname}', {opname});
        };

        return (
            <layoutViews.ModalOverlay onCloseKey={handleCloseClick}>
                <layoutViews.CloseableFrame
                        onCloseClick={handleCloseClick}
                        label={createTitle()}>
                    <S.QueryFormOverlay>
                        {createActionBasedForm()}
                    </S.QueryFormOverlay>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    };

    const BoundAppendOperationOverlay = BoundWithProps<
        AppendOperationOverlayProps, QueryReplayModelState|IndirectQueryReplayModelState
    >(AppendOperationOverlay, queryReplayModel);

    // ------------------------ <PersistentConcordanceForm /> --------------------------------

    class PersistentConcordanceForm extends React.PureComponent<QuerySaveAsFormModelState> {

        constructor(props) {
            super(props);
            this.handleCloseEvent = this.handleCloseEvent.bind(this);
            this.handleSubmit = this.handleSubmit.bind(this);
        }

        private handleCloseEvent() {
            dispatcher.dispatch<typeof MainMenuActions.ClearActiveItem>({
                name: MainMenuActions.ClearActiveItem.name
            });
        }

        private handleSubmit() {
            dispatcher.dispatch<typeof ConcActions.MakeConcPermanent>({
                name: ConcActions.MakeConcPermanent.name,
                payload: {
                    revoke: false
                }
            });
        }

        private handleRevokeSubmit() {
            dispatcher.dispatch<typeof ConcActions.MakeConcPermanent>({
                name: ConcActions.MakeConcPermanent.name,
                payload: {
                    revoke: true
                }
            });
        }

        private createPermanentUrl() {
            return he.createActionLink('view', {q: '~' + this.props.queryId});
        }

        componentDidMount() {
            dispatcher.dispatch<typeof ConcActions.GetConcArchiveStatus>({
                name: ConcActions.GetConcArchiveStatus.name
            });
        }

        render() {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.handleCloseEvent}>
                    <layoutViews.CloseableFrame onCloseClick={this.handleCloseEvent}
                                label={he.translate('concview__make_conc_link_permanent_hd')}>
                        {this.props.isBusy ?
                            <layoutViews.AjaxLoaderImage /> :
                            <Style_PersistentConcordanceForm>
                                <Style_SaveHintParagraph>
                                    <layoutViews.StatusIcon status="info" inline={true} htmlClass="icon" />
                                    {this.props.concIsArchived || this.props.willBeArchived ?
                                        he.translate('concview__permanent_link_is_archived') + ':' :
                                        he.translate('concview__permanent_link_hint_{ttl}', {ttl: this.props.concTTLDays})
                                    }
                                </Style_SaveHintParagraph>
                                <div>
                                    <input type="text" readOnly={true}
                                            disabled={!this.props.concIsArchived}
                                            value={this.createPermanentUrl()}
                                            className={this.props.concIsArchived || this.props.willBeArchived ? 'archived' : ''}
                                            onClick={e => this.props.concIsArchived || this.props.willBeArchived ?
                                                            (e.target as HTMLInputElement).select() : null} />
                                </div>
                                <p>
                                    {this.props.concIsArchived || this.props.willBeArchived ?
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
                            </Style_PersistentConcordanceForm>
                        }
                    </layoutViews.CloseableFrame>
                </layoutViews.ModalOverlay>
            );
        }
    }

    const BoundPersistentConcordanceForm = Bound<QuerySaveAsFormModelState>(
        PersistentConcordanceForm, querySaveAsModel);


    // ------------------------ <QueryToolbar /> --------------------------------

    class QueryToolbar extends React.PureComponent<QueryToolbarProps & MainMenuModelState>  {

        _renderOperationForm() {
            const actions = [
                MainMenuActions.ShowSort.name,
                MainMenuActions.ApplyShuffle.name,
                MainMenuActions.ShowSample.name,
                MainMenuActions.ShowFilter.name,
                MainMenuActions.FilterApplySubhitsRemove.name,
                MainMenuActions.FilterApplyFirstOccurrences.name
            ];
            if (this.props.activeItem !== null &&
                    List.findIndex(v => v === this.props.activeItem.actionName, actions) > -1) {
                return <BoundAppendOperationOverlay {...this.props}
                            menuActiveItem={this.props.activeItem} />;

            } else {
                return null;
            }
        }

        _renderSaveForm() {
            if (this.props.activeItem) {
                switch (this.props.activeItem.actionName) {
                    case MainMenuActions.ShowSaveQueryAsForm.name:
                        return <saveViews.QuerySaveAsForm />;
                    case MainMenuActions.MakeConcLinkPersistent.name:
                        return <BoundPersistentConcordanceForm />;
                }
            }
            return null;
        }

        render() {
            return (
                <div>
                    <BoundQueryOverview {...this.props} />
                    {this._renderOperationForm()}
                    {this._renderSaveForm()}
                </div>
            );
        }
    }

    const BoundQueryToolbar = BoundWithProps<
        QueryToolbarProps, MainMenuModelState
    >(QueryToolbar, mainMenuModel);

    // ------------------------ <NonViewPageQueryToolbar /> --------------------------------

    const NonViewPageQueryToolbar:React.FC<NonViewPageQueryToolbarProps & QueryReplayModelState> =
    (props) => (
        <div>
            <RedirectingQueryOverview {...props} ops={props.currEncodedOperations} />
            {props.overviewVisible ?
                <basicOverviewViews.QueryOverviewTable data={props.currentQueryOverview}
                    onEditClick={()=>undefined} /> :
                null
            }
        </div>
    );

    const BoundNonViewPageQueryToolbar = BoundWithProps<
            NonViewPageQueryToolbarProps, QueryReplayModelState|IndirectQueryReplayModelState
    >(NonViewPageQueryToolbar, queryReplayModel);


    return {
        QueryToolbar: BoundQueryToolbar,
        NonViewPageQueryToolbar: BoundNonViewPageQueryToolbar
    };
}