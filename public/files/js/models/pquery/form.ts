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
import { Observable, forkJoin, of as rxOf } from 'rxjs';
import { PageModel } from '../../app/page';
import { Actions } from './actions';
import { IUnregistrable } from '../common/common';
import { Actions as GlobalActions } from '../common/actions';
import { Actions as QueryActions } from '../query/actions';
import { Actions as ATActions } from '../../models/asyncTask/actions';
import { AdvancedQuery, AdvancedQuerySubmit } from '../query/query';
import * as Kontext from '../../types/kontext';
import * as TextTypes from '../../types/textTypes';
import { ConcQueryResponse } from '../concordance/common';
import { catchError, concatMap, map, reduce, tap } from 'rxjs/operators';
import { ConcQueryArgs, FilterServerArgs, QueryContextArgs } from '../query/common';
import { AsyncTaskArgs, FreqIntersectionArgs, FreqIntersectionResponse, createSourceId,
    PqueryFormModelState,
    PqueryAlignTypes,
    ParadigmaticQuery,
    SubsetComplementsAndRatio,
    SupersetAndRatio} from './common';
import { highlightSyntax, ParsedAttr } from '../query/cqleditor/parser';
import { AttrHelper } from '../query/cqleditor/attrs';
import { AlignTypes } from '../freqs/twoDimension/common';


interface PqueryFormModelSwitchPreserve {
    queries:string;
    minFreq:Kontext.FormValue<string>;
    attr:string;
    posLeft:number;
    posRight:number;
    posAlign:AlignTypes|PqueryAlignTypes;
}

interface HistoryState {
    onPopStateAction:typeof Actions.PopHistory;
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

        this.addActionHandler<typeof Actions.SubmitQuery>(
            Actions.SubmitQuery.name,
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

                this.submitForm(this.state).subscribe({
                    next: task => {
                        this.dispatchSideEffect<typeof Actions.SubmitQueryDone>({
                            name: Actions.SubmitQueryDone.name,
                            payload: {
                                corpname: this.state.corpname,
                                usesubcorp: this.state.usesubcorp,
                                task
                            },
                        });
                    },
                    error: error => {
                        this.layoutModel.showMessage('error', error);
                        this.dispatchSideEffect<typeof Actions.SubmitQueryDone>({
                            name: Actions.SubmitQueryDone.name,
                            error
                        });
                    }
                })
            }
        );

        this.addActionHandler<typeof Actions.SubmitQueryDone>(
            Actions.SubmitQueryDone.name,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.task = action.payload.task;
                    });
                }
            }
        );

        this.addActionHandler<typeof GlobalActions.CorpusSwitchModelRestore>(
            GlobalActions.CorpusSwitchModelRestore.name,
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

        this.addActionHandler<typeof GlobalActions.SwitchCorpus>(
            GlobalActions.SwitchCorpus.name,
            action => {
                dispatcher.dispatch<typeof GlobalActions.SwitchCorpusReady>({
                    name: GlobalActions.SwitchCorpusReady.name,
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

        this.addActionHandler<typeof QueryActions.QueryInputSelectSubcorp>(
            QueryActions.QueryInputSelectSubcorp.name,
            action => {
                this.changeState(state => {
                    state.usesubcorp = action.payload.subcorp;
                });
            }
        );

        this.addActionHandler<typeof QueryActions.QueryInputSetQuery>(
            QueryActions.QueryInputSetQuery.name,
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

        this.addActionHandler<typeof QueryActions.QueryInputMoveCursor>(
            QueryActions.QueryInputMoveCursor.name,
            action => {
                this.changeState(state => {
                    const queryObj = state.queries[action.payload.sourceId];
                    queryObj.rawAnchorIdx = action.payload.rawAnchorIdx;
                    queryObj.rawFocusIdx = action.payload.rawFocusIdx;
                });
            }
        );

        this.addActionHandler<typeof Actions.AddQueryItem>(
            Actions.AddQueryItem.name,
            action => {
                this.changeState(state => this.addSpecificationQueryItem(state));
            }
        );

        this.addActionHandler<typeof Actions.RemoveQueryItem>(
            Actions.RemoveQueryItem.name,
            action => {
                this.changeState(state => {
                    state.queries = this.removeItem(state.queries, action.payload.sourceId);
                    state.concWait = this.removeItem(state.concWait, action.payload.sourceId);
                    if (!Dict.some((v, _) => v.expressionRole.type === 'specification', state.queries)) {
                        this.addSpecificationQueryItem(state);
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.FreqChange>(
            Actions.FreqChange.name,
            action => {
                this.changeState(state => {
                    state.minFreq.value = action.payload.value;
                    const tst = new Number(state.minFreq.value);
                    state.minFreq.isInvalid = isNaN(tst.valueOf()) || tst.valueOf() !== parseInt(state.minFreq.value);
                });
            }
        );

        this.addActionHandler<typeof Actions.SetPositionIndex>(
            Actions.SetPositionIndex.name,
            action => {
                this.changeState(state => {
                    state.posLeft = action.payload.valueLeft;
                    state.posRight = action.payload.valueRight;
                });
            }
        );

        this.addActionHandler<typeof Actions.SetAlignType>(
            Actions.SetAlignType.name,
            action => {
                this.changeState(state => {
                    state.posAlign = action.payload.value;
                });
            }
        );

        this.addActionHandler<typeof Actions.AttrChange>(
            Actions.AttrChange.name,
            action => {
                this.changeState(state => {
                    state.attr = action.payload.value;
                });
            }
        );

        this.addActionHandler<typeof Actions.StatePushToHistory>(
            Actions.StatePushToHistory.name,
            action => {
                this.pushStateToHistory(this.state, action.payload.queryId);
            }
        );

        this.addActionHandler<typeof Actions.PopHistory>(
            Actions.PopHistory.name,
            action => {
                console.log('pop history: ', action);
            }
        );

        this.addActionHandler<typeof Actions.ToggleModalForm>(
            Actions.ToggleModalForm.name,
            action => {
                this.changeState(state => {
                    state.modalVisible = action.payload.visible;
                });
            }
        );

        this.addActionHandler<typeof Actions.ParamsToggleForm>(
            Actions.ParamsToggleForm.name,
            action => {
                this.changeState(state => {
                    state.paramsVisible = !state.paramsVisible;
                });
            }
        );

        this.addActionHandler<typeof ATActions.AsyncTasksChecked>(
            ATActions.AsyncTasksChecked.name,
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

        this.addActionHandler<typeof Actions.ConcordanceReady>(
            Actions.ConcordanceReady.name,
            action => {
                this.changeState(state => {
                    if (action.error) {
                        state.concWait = Dict.map(_ => 'none', state.concWait);
                        state.isBusy = false;

                    } else {
                        state.concWait[action.payload.sourceId] = 'finished';
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.SetExpressionRoleType>(
            Actions.SetExpressionRoleType.name,
            action => {
                if (action.payload.value !== 'specification' &&
                        Dict.some(
                            (v, _) => v.expressionRole.type === action.payload.value, this.state.queries
                        )) {
                    this.layoutModel.showMessage('warning', `TODO Only one field ca be of type '${action.payload.value}'`)

                } else {
                    this.changeState(state => {
                        state.queries[action.payload.sourceId].expressionRole.type = action.payload.value
                        if (!Dict.some((v, _) => v.expressionRole.type === 'specification', state.queries)) {
                            this.addSpecificationQueryItem(state);
                        }
                    });
                }
            }
        );

        this.addActionHandler<typeof Actions.SetExpressionRoleRatio>(
            Actions.SetExpressionRoleRatio.name,
            action => {
                this.changeState(state => {
                    state.queries[action.payload.sourceId].expressionRole.maxNonMatchingRatio.value = action.payload.value;
                    const tst = new Number(action.payload.value);
                    state.queries[action.payload.sourceId].expressionRole.maxNonMatchingRatio.isInvalid = isNaN(tst.valueOf());
                });
            }
        );

        this.addActionHandler<typeof Actions.ResultApplyQuickFilter>(
            Actions.ResultApplyQuickFilter.name,
            action => {
                action.payload.concId
                this.state.queries
                this.dispatchSideEffect<typeof Actions.ResultApplyQuickFilterArgsReady>({
                    name: Actions.ResultApplyQuickFilterArgsReady.name,
                    payload: {
                        attr: this.state.attr,
                        posAlign: this.state.posAlign,
                        posLeft: this.state.posLeft,
                        posRight: this.state.posRight,
                    }
                })
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

    private mkFilterStream(
        state:PqueryFormModelState,
        concResponse:ConcQueryResponse
    ):Observable<[ConcQueryResponse, ConcQueryResponse, number]> {

        if (Dict.some(v => v.expressionRole.type === 'subset', state.queries)) {
            const [subsetSourceId, subsetQuery] = Dict.find(v => v.expressionRole.type === 'subset', state.queries);
            return this.layoutModel.ajax$<ConcQueryResponse>(
                    HTTP.Method.POST,
                    this.layoutModel.createActionUrl(
                        'filter',
                        [tuple('format', 'json')]
                    ),
                    this.createSubsetCompletentFilterArgs(state, subsetQuery, concResponse.conc_persistence_op_id),
                    {contentType: 'application/json'}
            ).pipe(
                tap( _ => {
                    this.dispatchSideEffect<typeof Actions.ConcordanceReady>({
                        name: Actions.ConcordanceReady.name,
                        payload: {sourceId: subsetSourceId}
                    })
                }),
                concatMap(
                    concSubsetResponse => rxOf(tuple(
                        concResponse,
                        concSubsetResponse,
                        parseFloat(state.queries[subsetSourceId].expressionRole.maxNonMatchingRatio.value)
                    ))
                )
            )

        } else {
            return rxOf(tuple(concResponse, null, 0))
        }
    }

    private mkSupersetStream(state:PqueryFormModelState):Observable<[ConcQueryResponse, number]> {
        if (Dict.some(v => v.expressionRole.type === 'superset', state.queries)) {
            const [sourceId, supersetQuery] = Dict.find(v => v.expressionRole.type === 'superset', state.queries);
            return this.layoutModel.ajax$<ConcQueryResponse>(
                    HTTP.Method.POST,
                    this.layoutModel.createActionUrl(
                        'query_submit',
                        [tuple('format', 'json')]
                    ),
                    this.createConcSubmitArgs(state, supersetQuery, false),
                    {contentType: 'application/json'}

            ).pipe(
                map(
                    v => tuple<ConcQueryResponse, Error>(v, null)
                ),
                catchError(
                    err => rxOf(tuple<ConcQueryResponse, Error>(null, err))
                ),
                tap(
                    ([,error]) => {
                        if (error) {
                            this.dispatchSideEffect<typeof Actions.ConcordanceReady>({
                                name: Actions.ConcordanceReady.name,
                                payload: {sourceId},
                                error
                            });

                        } else {
                            this.dispatchSideEffect<typeof Actions.ConcordanceReady>({
                                name: Actions.ConcordanceReady.name,
                                payload: {sourceId}
                            });
                        }
                    }
                ),
                map(
                    ([resp, error]) => {
                        if (error) {
                            throw error;
                        }
                        return tuple(
                            resp,
                            parseFloat(state.queries[sourceId].expressionRole.maxNonMatchingRatio.value)
                        );
                    }
                )
            );

        } else {
            return rxOf([null, 0]);
        }
    }

    private submitForm(state:PqueryFormModelState):Observable<Kontext.AsyncTaskInfo<AsyncTaskArgs>> {
        return forkJoin([
            rxOf(...pipe(
                state.queries,
                Dict.toEntries(),
                List.filter(([_, query]) => query.expressionRole.type === 'specification')

            )).pipe(
                concatMap(
                    ([sourceId, specQuery]) => this.layoutModel.ajax$<ConcQueryResponse>(
                        HTTP.Method.POST,
                        this.layoutModel.createActionUrl(
                            'query_submit',
                            [tuple('format', 'json')]
                        ),
                        this.createConcSubmitArgs(state, specQuery, false),
                        {contentType: 'application/json'}

                    ).pipe(
                        map(
                            resp => tuple<string, ConcQueryResponse, Error>(sourceId, resp, undefined)
                        ),
                        catchError(
                            err => {
                                console.log('catching error: ', err);
                                return rxOf(tuple<string, ConcQueryResponse, Error>(sourceId, undefined, err))
                            }
                        )
                    )
                ),
                tap(
                    ([sourceId,, error]) => {
                        if (error) {
                            this.dispatchSideEffect<typeof Actions.ConcordanceReady>({
                                name: Actions.ConcordanceReady.name,
                                payload: {sourceId},
                                error
                            });

                        } else {
                            this.dispatchSideEffect<typeof Actions.ConcordanceReady>({
                                name: Actions.ConcordanceReady.name,
                                payload: {sourceId}
                            });
                        }
                    }
                ),
                concatMap(
                    ([,concResponse, error]) => {
                        if (error) {
                            throw error;
                        }
                        return this.mkFilterStream(state, concResponse);
                    }
                ),
                reduce(
                    (acc, respTuple) => List.push(respTuple, acc),
                    [] as Array<[ConcQueryResponse, ConcQueryResponse, number]>
                )
            ),
            this.mkSupersetStream(state)

        ]).pipe(
            concatMap(
                ([specAndSubsets, [supersetResponse, supersetsMNMRatio]]) => this.submitFreqIntersection(
                    state,
                    List.map(
                        ([spec,]) => spec.conc_persistence_op_id,
                        specAndSubsets
                    ),
                    List.every(([,v,]) => v !== null, specAndSubsets) ?
                        {
                            conc_ids: List.map(
                                ([,subs,]) => subs ? subs.conc_persistence_op_id : null,
                                specAndSubsets
                            ),
                            max_non_matching_ratio: specAndSubsets[0][2]
                        } :
                        null,
                    supersetResponse ?
                        {
                            conc_id: supersetResponse.conc_persistence_op_id,
                            max_non_matching_ratio: supersetsMNMRatio
                        } :
                        null
                )
            ),
            tap(
                (fiResponse) => {
                    this.dispatchSideEffect<typeof ATActions.InboxAddAsyncTask>({
                        name: ATActions.InboxAddAsyncTask.name,
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
        concSubsetComplements:SubsetComplementsAndRatio|null,
        concSuperset:SupersetAndRatio|null
    ):Observable<FreqIntersectionResponse> {

        const args:FreqIntersectionArgs = {
            corpname: state.corpname,
            usesubcorp: state.usesubcorp,
            conc_ids: concIds,
            conc_subset_complements: concSubsetComplements,
            conc_superset: concSuperset,
            min_freq: parseInt(state.minFreq.value),
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

    private createSubsetCompletentFilterArgs(
        state:PqueryFormModelState,
        query:ParadigmaticQuery,
        concId:string
    ):FilterServerArgs {

        const currArgs = this.layoutModel.getConcArgs();

        return {
            type: 'filterQueryArgs',
            maincorp: state.corpname,
            viewmode: 'kwic',
            pagesize: 1,
            attrs: [], // TODO
            attr_vmode: currArgs.attr_vmode,
            base_viewattr: currArgs.base_viewattr,
            ctxattrs: [],
            structs: [],
            refs: [],
            fromp: 1,
            qtype: 'advanced',
            query: query.query,
            queryParsed: undefined,
            default_attr: query.default_attr,
            qmcase: false,
            use_regexp: false,
            pnfilter: 'p',
            // position `whole kwic as one word` is handled as `first`
            filfl: state.posAlign === AlignTypes.RIGHT ? 'l' : 'f',
            filfpos: '0',
            filtpos: `${List.size(query.parsedAttrs) - 1}`,
            inclkwic: 1,
            within: false,
            format: 'json',
            q: ['~' + concId],
            no_query_history: true
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
        this.layoutModel.getHistory().pushState<{}, HistoryState>(
            'pquery/result',
            {q: `~${queryId}`},
            {
                onPopStateAction: {
                    name: Actions.PopHistory.name,
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

    private addSpecificationQueryItem(state:PqueryFormModelState) {
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
            expressionRole: {
                type: 'specification',
                maxNonMatchingRatio: Kontext.newFormValue('0', true)
            }
        }
    }

}