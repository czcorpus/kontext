/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import { Dict, HTTP, List, pipe, tuple } from 'cnc-tskit';
import { IFullActionControl, StatefulModel } from 'kombo';
import { Observable, forkJoin, of } from 'rxjs';
import { PageModel } from '../../app/page';
import { Actions, ActionName } from './actions';
import { IUnregistrable } from '../common/common';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';
import { Actions as QueryActions, ActionName as QueryActionName } from '../query/actions';
import { Actions as ACActions, ActionName as ACActionName } from '../../models/asyncTask/actions';
import { AdvancedQuery, AdvancedQuerySubmit } from '../query/query';
import { Kontext, TextTypes } from '../../types/common';
import { ConcQueryResponse } from '../concordance/common';
import { concatMap, map, tap } from 'rxjs/operators';
import { ConcQueryArgs, FilterServerArgs, QueryContextArgs } from '../query/common';
import { AsyncTaskArgs, FreqIntersectionArgs, FreqIntersectionResponse, createSourceId,
    PqueryFormModelState, 
    PqueryAlignTypes,
    PqueryExpressionRoles,
    ParadigmaticQuery} from './common';
import { highlightSyntax, ParsedAttr } from '../query/cqleditor/parser';
import { AttrHelper } from '../query/cqleditor/attrs';
import { AlignTypes } from '../freqs/twoDimension/common';
import { MultiDict } from '../../multidict';


interface PqueryFormModelSwitchPreserve {
    queries:string;
    minFreq:number;
    attr:string;
    posLeft:number;
    posRight:number;
    posAlign:AlignTypes|PqueryAlignTypes;
}

interface HistoryState {
    onPopStateAction:Actions.PopHistory;
}


export class PqueryFormModel extends StatefulModel<PqueryFormModelState> implements IUnregistrable {

    private readonly layoutModel:PageModel;

    private readonly attrHelper:AttrHelper;

    constructor(
        dispatcher:IFullActionControl,
        initState:PqueryFormModelState,
        layoutModel:PageModel,
        attrHelper:AttrHelper
    ) {
        super(dispatcher, initState);
        this.layoutModel = layoutModel;
        this.attrHelper = attrHelper;
        this.hintListener = this.hintListener.bind(this);

        this.addActionHandler<Actions.SubmitQuery>(
            ActionName.SubmitQuery,
            action => {
                const validationErr = this.validateQueries();
                if (validationErr) {
                    this.layoutModel.showMessage('error', validationErr);
                    return;
                }
                this.changeState(state => {
                    state.isBusy = true;
                    state.concWait = Dict.map(v => 'running', state.concWait);
                });

                this.submitForm(this.state).subscribe(
                    (task) => {
                        this.dispatchSideEffect<Actions.SubmitQueryDone>({
                            name: ActionName.SubmitQueryDone,
                            payload: {
                                corpname: this.state.corpname,
                                usesubcorp: this.state.usesubcorp,
                                task
                            },
                        });
                    },
                    (error) => {
                        this.layoutModel.showMessage('error', error);
                        this.dispatchSideEffect<Actions.SubmitQueryDone>({
                            name: ActionName.SubmitQueryDone,
                            error
                        });
                    }
                )
            }
        );

        this.addActionHandler<Actions.SubmitQueryDone>(
            ActionName.SubmitQueryDone,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.task = action.payload.task;
                    });
                }
            }
        );

        this.addActionHandler<GlobalActions.CorpusSwitchModelRestore>(
            GlobalActionName.CorpusSwitchModelRestore,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        this.deserialize(
                            state,
                            action.payload.data[this.getRegistrationId()] as
                                PqueryFormModelSwitchPreserve,
                            action.payload.corpora
                        );
                    });
                }
            }
        );

        this.addActionHandler<GlobalActions.SwitchCorpus>(
            GlobalActionName.SwitchCorpus,
            action => {
                dispatcher.dispatch<GlobalActions.SwitchCorpusReady<
                        PqueryFormModelSwitchPreserve>>({
                    name: GlobalActionName.SwitchCorpusReady,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: this.serialize(
                            this.state,
                            action.payload.corpora,
                            action.payload.newPrimaryCorpus
                        )
                    }
                });
            }
        );

        this.addActionHandler<QueryActions.QueryInputSelectSubcorp>(
            QueryActionName.QueryInputSelectSubcorp,
            action => {
                this.changeState(state => {
                    state.usesubcorp = action.payload.subcorp;
                });
            }
        );

        this.addActionHandler<QueryActions.QueryInputSetQuery>(
            QueryActionName.QueryInputSetQuery,
            action => {
                this.changeState(state => {
                    const queryObj = state.queries[action.payload.sourceId];

                    if (action.payload.rawAnchorIdx !== undefined &&
                            action.payload.rawFocusIdx !== undefined) {
                        queryObj.rawAnchorIdx = action.payload.rawAnchorIdx ||
                            action.payload.query.length;
                            queryObj.rawFocusIdx = action.payload.rawFocusIdx ||
                            action.payload.query.length;
                    }
                    this.setRawQuery(
                        state,
                        queryObj,
                        action.payload.sourceId,
                        action.payload.query,
                        action.payload.insertRange
                    );
                });
            }
        );

        this.addActionHandler<QueryActions.QueryInputMoveCursor>(
            QueryActionName.QueryInputMoveCursor,
            action => {
                this.changeState(state => {
                    const queryObj = state.queries[action.payload.sourceId];
                    queryObj.rawAnchorIdx = action.payload.rawAnchorIdx;
                    queryObj.rawFocusIdx = action.payload.rawFocusIdx;
                });
            }
        );

        this.addActionHandler<Actions.AddQueryItem>(
            ActionName.AddQueryItem,
            action => {
                this.changeState(state => {
                    const size = Dict.size(state.queries);
                    state.concWait[createSourceId(size)] = 'none';
                    state.queries[createSourceId(size)] = {
                        corpname: state.corpname,
                        qtype: 'advanced',
                        query: '',
                        queryHtml: '',
                        rawAnchorIdx: 0,
                        rawFocusIdx: 0,
                        parsedAttrs: [],
                        focusedAttr: undefined,
                        pcq_pos_neg: 'pos',
                        include_empty: false,
                        default_attr: null,
                        expressionRole: {type: PqueryExpressionRoles.SPECIFICATION, maxNonMatchingRatio: 100}
                    }
                });
            }
        );

        this.addActionHandler<Actions.RemoveQueryItem>(
            ActionName.RemoveQueryItem,
            action => {
                this.changeState(state => {
                    state.queries = this.removeItem(state.queries, action.payload.sourceId);
                    state.concWait = this.removeItem(state.concWait, action.payload.sourceId);
                });
            }
        );

        this.addActionHandler<Actions.FreqChange>(
            ActionName.FreqChange,
            action => {
                this.changeState(state => {
                    state.minFreq = parseInt(action.payload.value) || state.minFreq;
                });
            }
        );

        this.addActionHandler<Actions.SetPositionIndex>(
            ActionName.SetPositionIndex,
            action => {
                this.changeState(state => {
                    state.posLeft = action.payload.valueLeft;
                    state.posRight = action.payload.valueRight;
                });
            }
        );

        this.addActionHandler<Actions.SetAlignType>(
            ActionName.SetAlignType,
            action => {
                this.changeState(state => {
                    state.posAlign = action.payload.value;
                });
            }
        );

        this.addActionHandler<Actions.AttrChange>(
            ActionName.AttrChange,
            action => {
                this.changeState(state => {
                    state.attr = action.payload.value;
                });
            }
        );

        this.addActionHandler<Actions.StatePushToHistory>(
            ActionName.StatePushToHistory,
            action => {
                this.pushStateToHistory(this.state, action.payload.queryId);
            }
        );

        this.addActionHandler<Actions.PopHistory>(
            ActionName.PopHistory,
            action => {
                console.log('pop history: ', action);
            }
        );

        this.addActionHandler<Actions.ToggleModalForm>(
            ActionName.ToggleModalForm,
            action => {
                this.changeState(state => {
                    state.modalVisible = action.payload.visible;
                });
            }
        );

        this.addActionHandler<Actions.ParamsToggleForm>(
            ActionName.ParamsToggleForm,
            action => {
                this.changeState(state => {
                    state.paramsVisible = !state.paramsVisible;
                });
            }
        );

        this.addActionHandler<ACActions.AsyncTasksChecked>(
            ACActionName.AsyncTasksChecked,
            action => {
                if (this.state.task) {
                    const task = List.find(
                        t => t.ident === this.state.task.ident,
                        action.payload.tasks
                    );
                    if (!task) {
                        // TODO cleanup
                        this.changeState(state => {
                            state.isBusy = false;
                        });
                        layoutModel.showMessage('error', 'Paradigmatic query task not found!');

                    } else {
                        const pqTask = task as Kontext.AsyncTaskInfo<AsyncTaskArgs>; // TODO type
                        if (pqTask.status === 'SUCCESS') {
                            window.location.href = this.layoutModel.createActionUrl(
                                'pquery/result',
                                [tuple('q', `~${this.state.task.args.query_id}`)]
                            );

                        } else if (pqTask.status === 'FAILURE') {
                            this.changeState(state => {
                                state.task = pqTask;
                                state.isBusy = false;
                            });
                            this.layoutModel.showMessage(
                                'error',
                                `Paradigmatic query task failed: ${this.state.task.error}`
                            );
                        }
                    }
                }
            }
        );

        this.addActionHandler<Actions.ConcordanceReady>(
            ActionName.ConcordanceReady,
            action => {
                this.changeState(state => {
                    state.concWait[action.payload.sourceId] = 'finished';
                });
            }
        );

        this.addActionHandler<Actions.SetExpressionRoleType>(
            ActionName.SetExpressionRoleType,
            action => {
                if (action.payload.value !== PqueryExpressionRoles.SPECIFICATION && Dict.some((v, _) => v.expressionRole.type === action.payload.value, this.state.queries)) {
                    this.layoutModel.showMessage('warning', `TODO Only one field ca be of type '${action.payload.value}'`)

                } else {
                    this.changeState(state => {
                        state.queries[action.payload.sourceId].expressionRole.type = action.payload.value
                    });
                }
            }
        );

        this.addActionHandler<Actions.SetExpressionRoleRatio>(
            ActionName.SetExpressionRoleRatio,
            action => {
                this.changeState(state => {
                    state.queries[action.payload.sourceId].expressionRole.maxNonMatchingRatio = action.payload.value
                });                
            }
        );
    }

    private getPositionRange(state:PqueryFormModelState):string {
        switch (state.posAlign) {
            case AlignTypes.LEFT:
                return `${state.posLeft}<0~${state.posRight}<0`
            case AlignTypes.RIGHT:
                return `${state.posLeft}>0~${state.posRight}>0`
            case PqueryAlignTypes.WHOLE_KWIC:
                return `${state.posLeft}<0~${state.posRight}>0`
        }
    }

    private removeItem(data:{[sourceId:string]:any}, removeId:string):{[sourceId:string]:any} {
        return pipe(
            data,
            Dict.toEntries(),
            List.reduce((acc, [k, v]) => {
                if (k !== removeId) {
                    acc.push([createSourceId(List.size(acc)), v])
                }
                return acc;
            }, []),
            Dict.fromEntries()
        );
    }

    private validateQueries():Error|undefined {
        const empty = Dict.find(q => q.query.trim() === '', this.state.queries);
        return empty ? new Error(this.layoutModel.translate('pquery__all_the_queries_must_be_filled')) : undefined;
    }

    private deserialize(
        state:PqueryFormModelState,
        data:PqueryFormModelSwitchPreserve,
        corpora:Array<[string, string]>
    ):void {
        state.attrs = this.layoutModel.getConf('AttrList')
        state.structAttrs = this.layoutModel.getConf('StructAttrList')
        state.corpname = corpora[0][1]
        if (data) {
            state.queries = Dict.map(v => {
                v.corpname = state.corpname;
                return v;
            }, JSON.parse(data.queries) as {[sourceId:string]:ParadigmaticQuery});
            state.minFreq = data.minFreq;
            state.posLeft = data.posLeft;
            state.posRight = data.posRight;
            state.posAlign = data.posAlign;
            state.attr = data.attr;
            state.attr = List.some(v => v.n === data.attr, state.attrs) || List.some(v => v.n === data.attr, state.structAttrs) ?
                         data.attr :
                         state.attrs[0].n
        } else {
            state.attr = state.attrs[0].n
        }
    }

    private serialize(
        state:PqueryFormModelState,
        newCorpora:Array<string>,
        newPrimaryCorpus:string|undefined
    ):PqueryFormModelSwitchPreserve {
        return {
            queries: JSON.stringify(state.queries),
            attr: state.attr,
            minFreq: state.minFreq,
            posLeft: state.posLeft,
            posRight: state.posRight,
            posAlign: state.posAlign
        };
    }

    private submitForm(state:PqueryFormModelState):Observable<Kontext.AsyncTaskInfo<AsyncTaskArgs>> {
        return forkJoin(pipe(
            state.queries,
            Dict.toEntries(),
            List.filter(([_, query]) => query.expressionRole.type === PqueryExpressionRoles.SPECIFICATION),
            List.map(
                ([sourceId, query]) => this.layoutModel.ajax$<ConcQueryResponse>(
                    HTTP.Method.POST,
                    this.layoutModel.createActionUrl(
                        'query_submit',
                        [tuple('format', 'json')]
                    ),
                    this.createConcSubmitArgs(state, query, false),
                    {contentType: 'application/json'}

                ).pipe(
                    tap(
                        _ => {
                            this.dispatchSideEffect<Actions.ConcordanceReady>({
                                name: ActionName.ConcordanceReady,
                                payload: {sourceId}
                            })
                        }
                    )
                )
            )
        )).pipe(
            concatMap(
                (concResponses) => {
                    if (Dict.some(v => v.expressionRole.type === PqueryExpressionRoles.SUBSET, state.queries)) {
                        const [subsetSourceId, subsetQuery] = Dict.find(v => v.expressionRole.type === PqueryExpressionRoles.SUBSET, state.queries);
                        return forkJoin([
                            of(concResponses),
                            forkJoin(
                                pipe(
                                    concResponses,
                                    List.map(
                                        concResp => this.layoutModel.ajax$<ConcQueryResponse>(
                                            HTTP.Method.POST,
                                            this.layoutModel.createActionUrl(
                                                'filter',
                                                [tuple('format', 'json')]
                                            ),
                                            this.createFilterSubmitArgs(state, subsetQuery, concResp.conc_persistence_op_id),
                                            {contentType: 'application/json'}
                                        )    
                                    )
                                )
                            ).pipe(
                                tap(v => console.log(v))
                            )
                        ]).pipe(
                            tap( _ => {
                                this.dispatchSideEffect<Actions.ConcordanceReady>({
                                    name: ActionName.ConcordanceReady,
                                    payload: {sourceId: subsetSourceId}
                                })
                            })
                        )

                    } else {
                        return of([concResponses, []])
                    }
                }
            ),
            concatMap(
                ([concResponses, subset]) => this.submitFreqIntersection(
                    state,
                    List.map(
                        resp => resp.conc_persistence_op_id,
                        concResponses
                    ),
                    List.map(
                        resp => resp.conc_persistence_op_id,
                        subset
                    )
                )
            ),
            tap(
                (fiResponse) => {
                    this.dispatchSideEffect<ACActions.InboxAddAsyncTask>({
                        name: ACActionName.InboxAddAsyncTask,
                        payload: fiResponse.task
                    })
                }
            ),
            map(
                (fiResponse) => fiResponse.task as Kontext.AsyncTaskInfo<AsyncTaskArgs>
            )
        );
    }

    private submitFreqIntersection(
        state:PqueryFormModelState,
        concIds:Array<string>,
        concSubsetComplementIds:Array<string>
    ):Observable<FreqIntersectionResponse> {

        const args:FreqIntersectionArgs = {
            corpname: state.corpname,
            usesubcorp: state.usesubcorp,
            conc_ids: concIds,
            conc_subset_complement_ids: concSubsetComplementIds,
            min_freq: state.minFreq,
            attr: state.attr,
            pos_left: state.posLeft,
            pos_right: state.posRight,
            pos_align: state.posAlign,
            position: this.getPositionRange(state)
        };
        return this.layoutModel.ajax$<FreqIntersectionResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'pquery/freq_intersection',
                []
            ),
            args,
            {contentType: 'application/json'}
        );
    }

    getRegistrationId():string {
        return 'paradigmatic-query-form-model';
    }

    exportQuery(query:AdvancedQuery):AdvancedQuerySubmit {
        return {
            qtype: 'advanced',
            corpname: query.corpname,
            query: query.query.trim().normalize(),
            pcq_pos_neg: query.pcq_pos_neg,
            include_empty: query.include_empty,
            default_attr: !Array.isArray(query.default_attr) ?
                                query.default_attr : ''
        };
    }

    createConcSubmitArgs(state:PqueryFormModelState, query:AdvancedQuery, async:boolean):ConcQueryArgs {

        const currArgs = this.layoutModel.getConcArgs();
        return {
            type: 'concQueryArgs',
            maincorp: state.corpname,
            usesubcorp: state.usesubcorp || null,
            viewmode: 'kwic',
            pagesize: currArgs.pagesize,
            attrs: [],
            attr_vmode: currArgs.attr_vmode,
            base_viewattr: currArgs.base_viewattr,
            ctxattrs: null,
            structs: null,
            refs: null,
            fromp: 0,
            shuffle: 0,
            queries: [this.exportQuery(query)],
            text_types: {} as TextTypes.ExportedSelection,
            context: {} as QueryContextArgs,
            async,
            no_query_history: true
        };
    }

    private createFilterSubmitArgs(state:PqueryFormModelState, query:ParadigmaticQuery, concId:string):FilterServerArgs {
        const currArgs = this.layoutModel.getConcArgs();

        return {
            type: 'filterQueryArgs',
            maincorp: state.corpname,
            viewmode: 'kwic',
            pagesize: 1,
            attrs: '', // TODO
            attr_vmode: currArgs.attr_vmode,
            base_viewattr: currArgs.base_viewattr,
            ctxattrs: null,
            structs: null,
            refs: null,
            fromp: 1,
            qtype: 'advanced',
            query: query.query,
            queryParsed: undefined,
            default_attr: query.default_attr,
            qmcase: false,
            use_regexp: false,
            pnfilter: 'n',
            filfl: state.posAlign === AlignTypes.LEFT ? 'f' : state.posAlign === AlignTypes.RIGHT ? 'l' : '', // TODO
            filfpos: `${state.posLeft}`,
            filtpos: `${state.posRight}`,
            inclkwic: 1,
            within: false,
            format: 'json',
            q: '~' + concId
        }
    }

    private hintListener(sourceId:string, msg:string):void {
        this.changeState(state => {
            state.cqlEditorMessages[sourceId] = msg;
        });
    }

    /**
     *
     * @todo duplicated code (models/query/common)
     */
    private findFocusedAttr(queryObj:AdvancedQuery):ParsedAttr|undefined {
        return List.find(
            (v, i) => v.rangeAll[0] <= queryObj.rawFocusIdx && (
                queryObj.rawFocusIdx <= v.rangeAll[1]),
            queryObj.parsedAttrs
        );
    }

    /**
     *
     * @todo partially duplicated code (models/query/common)
     */
    private reparseAdvancedQuery(
        queryObj:AdvancedQuery,
        sourceId:string,
        updateCurrAttrs:boolean
    ):void {

        let newAttrs:Array<ParsedAttr>;
        [queryObj.queryHtml, newAttrs] = highlightSyntax(
            queryObj.query,
            'advanced',
            this.layoutModel.getComponentHelpers(),
            this.attrHelper,
            (startIdx, endIdx) => {
                const matchingAttr = updateCurrAttrs ?
                    undefined :
                    List.find(
                        attr => attr.rangeVal[0] === startIdx && attr.rangeVal[1] === endIdx,
                        queryObj.parsedAttrs
                    );
                if (matchingAttr && matchingAttr.suggestions) {
                    const activeSugg = List.find(s => s.isActive, matchingAttr.suggestions.data);
                    return tuple(
                        `<a class="sugg" data-type="sugg" data-leftIdx="${startIdx}" data-rightIdx="${endIdx}" data-providerId="${activeSugg.providerId}">`, '</a>'
                    )
                }
                return tuple(null, null);
            },
            (msg) => this.hintListener(sourceId, msg)
        );
        queryObj.focusedAttr = this.findFocusedAttr(queryObj);

        if (updateCurrAttrs) {
            queryObj.parsedAttrs = newAttrs;
        }
    }

    /**
     *
     * @todo duplicated code (models/query/common)
     */
    private shouldDownArrowTriggerHistory(queryObj:AdvancedQuery):boolean {
        if (queryObj.rawAnchorIdx === queryObj.rawFocusIdx) {
            return queryObj.query.substr(queryObj.rawAnchorIdx+1).search(/[\n\r]/) === -1;

        } else {
            return false;
        }
    }

    /**
     * @param range in case we want to insert a CQL snippet into an existing code;
     *              if undefined then whole query is replaced
     *
     * @todo partially duplicated code (models/query/common)
     */
    protected setRawQuery(
        state:PqueryFormModelState,
        queryObj:AdvancedQuery,
        sourceId:string,
        query:string,
        insertRange:[number, number]|null

    ):void {
        if (insertRange !== null) {
            queryObj.query = queryObj.query.substring(0, insertRange[0]) + query +
                    queryObj.query.substr(insertRange[1]);

        } else {
            queryObj.query = query;
        }

        state.downArrowTriggersHistory[sourceId] = this.shouldDownArrowTriggerHistory(queryObj);

        this.reparseAdvancedQuery(queryObj, sourceId, true);
    }

    private pushStateToHistory(state:PqueryFormModelState, queryId:string):void {
        const args = new MultiDict();
        args.set('q', `~${queryId}`);
        this.layoutModel.getHistory().pushState<{}, HistoryState>(
            'pquery/result',
            args,
            {
                onPopStateAction: {
                    name: ActionName.PopHistory,
                    payload: {
                        corpname: state.corpname,
                        usesubcorp: state.usesubcorp,
                        page: 1, // TODO
                        queryId,
                        sort: undefined // this concerns the result model
                    }
                }
            },
            window.document.title
        )
    }

}