/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

import { tuple, pipe, List, Dict, HTTP } from 'cnc-tskit';
import { Action, StatefulModel, IFullActionControl } from 'kombo';

import * as PluginInterfaces from '../../../types/plugins/index.js';
import { TagBuilderBaseState } from '../common.js';
import { Actions } from '../actions.js';
import * as Kontext from '../../../types/kontext.js';
import { Actions as QueryActions } from '../../../models/query/actions.js';
import { IPluginApi } from '../../../types/plugins/common.js';
import { KVAttrConf } from '../common.js';


interface DataResponse extends Kontext.AjaxResponse {
    attrs:{[name:string]:Array<string>};
    udFeats:{[name:string]:Array<string>};
    attrConf:Array<KVAttrConf>;
}


function composeQuery(data:TagsetStatus):string {
    const attrsQuery = pipe(
        data.allAttrs,
        Dict.toEntries(),
        List.filter(
            ([, selectableValues]) => List.some(v => v.selected, selectableValues)
        ),
        List.map(
            ([name, selectableValues]) => tuple(name, List.filter(v => v.selected, selectableValues))
        ),
        List.sorted(([v1,], [v2,]) => v1.localeCompare(v2)),
        List.map(
            ([recName, groupedRecs]) => `${recName}="${List.map(r => r.value, groupedRecs).join('|')}"`
        )
    );
    const udQuery = pipe(
        data.allUdFeats,
        Dict.toEntries(),
        List.filter(
            ([, selectableValues]) => List.some(v => v.selected, selectableValues)
        ),
        List.map(
            ([name, selectableValues]) => tuple(name, List.filter(v => v.selected, selectableValues))
        ),
        List.sorted(([v1,], [v2,]) => v1.localeCompare(v2)),
        List.map(
            ([recName, groupedRecs]) => `feats="${List.map(r => `${recName}=${r.value}`, groupedRecs).join('|')}"`
        )
    );
    return `[${[...attrsQuery,...udQuery].join(' & ')}]`;
}


export interface SelectableValue {
    value:string;
    available:'unavailable'|'available'|'edited'|'locked'|'locked';
    selected:boolean;
    filteredOut:boolean;
}

export function selectableValIsVisible(v:SelectableValue):boolean {
    return v.available !== 'unavailable' && !v.filteredOut;
}

interface SelectionOperation {
    attr:string;
    value:string;
    isUdFeat:boolean;
    checked:boolean;
}


export interface TagsetStatus {

    corpname:string;

    /**
     * An encoded representation of a tag selection. From CQL
     * point of view, this is just a string. Typically,
     * this can be used directly as a part of 'generatedQuery'.
     *
     * The value is used when user directly modifies an
     * existing tag within a CQL query. In such case, we
     * inject just the raw value.
     */
    rawPattern:string;

    // a string-exported variant of the current UD props selection
    generatedQuery:string;

    error:Error|null;

    allAttrs:{[key:string]:Array<SelectableValue>};

    /**
     * filter for both allAttrs and allUdFeats.
     * Please note that the ud feats are filtered by their name
     */
    attrsFilters:{[key:string]:string};

    allUdFeats:{[key:string]:Array<SelectableValue>};

    udFeatsFilters:{[key:string]:string};

    lockedAttrs:{[name:string]:boolean};

    filterFeaturesHistory:Array<null|SelectionOperation>;

    expandedUdFeat:string;

    posField:string;

    featureField:string;

    // where in the current CQL query the resulting
    // expression will by inserted
    queryRange:[number, number];

    locked:boolean;

    attrConf:Array<KVAttrConf>;
}


export function createEmptyUDTagsetStatus(tagsetInfo:PluginInterfaces.TagHelper.TagsetInfo, corpname:string):TagsetStatus {
    return {
        corpname,
        generatedQuery: '',
        rawPattern: '', // not applicable for the current UI
        error: null,
        allAttrs: {},
        attrsFilters: {},
        allUdFeats: {},
        udFeatsFilters: {},
        lockedAttrs: {},
        filterFeaturesHistory: [null],
        expandedUdFeat: '',
        posField: tagsetInfo.posAttr,
        featureField: tagsetInfo.featAttr,
        queryRange:[0, 0],
        locked: false,
        attrConf: []
    };
}

export interface UDTagBuilderModelState extends TagBuilderBaseState {

    data:{[sourceId:string]:TagsetStatus};

}

export class UDTagBuilderModel extends StatefulModel<UDTagBuilderModelState> {

    private readonly pluginApi:IPluginApi;

    private readonly tagsetId:string;

    constructor(dispatcher:IFullActionControl, pluginApi:IPluginApi,
            initialState:UDTagBuilderModelState, tagsetId:string) {
        super(dispatcher, initialState);
        this.pluginApi = pluginApi;
        this.tagsetId = tagsetId;

        this.addActionSubtypeHandler(
            Actions.KVToggleUDFeat,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    const curr = state.data[action.payload.sourceId].expandedUdFeat;
                    if (curr === action.payload.value) {
                        state.data[action.payload.sourceId].expandedUdFeat = undefined;

                    } else {
                        state.data[action.payload.sourceId].expandedUdFeat = action.payload.value;
                    }
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.GetInitialData,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    if (!Dict.hasKey(action.payload.sourceId, state.data)) {
                        state.data[action.payload.sourceId] = createEmptyUDTagsetStatus(
                                state.tagsetInfo, action.payload.corpname);
                    }
                });
                if (this.state.data[action.payload.sourceId].filterFeaturesHistory.length === 1) {
                    this.getFilteredFeatures<typeof Actions.KVGetInitialDataDone['payload']>(
                        (data, err) => err ?
                        {
                            name: Actions.KVGetInitialDataDone.name,
                            error: err

                        } :
                        {
                            name: Actions.KVGetInitialDataDone.name,
                            payload: {
                                tagsetId: this.tagsetId,
                                sourceId: action.payload.sourceId,
                                attrs: data.attrs,
                                udFeats: data.udFeats,
                                attrConf: data.attrConf
                            }
                        },
                        action.payload.sourceId
                    );

                } else {
                    this.dispatchSideEffect<typeof Actions.KVGetInitialDataNOP>({
                        name: Actions.KVGetInitialDataNOP.name,
                        payload: {
                            tagsetId: action.payload.tagsetId
                        }
                    });
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.KVGetInitialDataDone,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                if (action.error) {
                    this.pluginApi.showMessage('error', action.error);
                    return;
                }
                this.changeState(state => {
                    state.data[action.payload.sourceId].attrConf = action.payload.attrConf;
                    state.data[action.payload.sourceId].allAttrs = pipe(
                        action.payload.attrs,
                        Dict.map(
                            (values, k) => List.map(
                                value => ({
                                    value,
                                    available: 'available',
                                    selected: false,
                                    filteredOut: false
                                }),
                                values
                            )
                        )
                    );
                    state.data[action.payload.sourceId].attrsFilters = Dict.map(
                        (v, k) => '',
                        action.payload.attrs
                    );
                    state.data[action.payload.sourceId].allUdFeats = pipe(
                        action.payload.udFeats,
                        Dict.map(
                            (values, k) => List.map(
                                value => ({
                                    value,
                                    available: 'available',
                                    selected: false,
                                    filteredOut: false
                                }),
                                values
                            )
                        )
                    );
                    state.data[action.payload.sourceId].udFeatsFilters = Dict.map(
                        (v, k) => '',
                        action.payload.udFeats
                    );
                    state.isBusy = false;
                });
            }
        );

        this.addActionHandler(
            Actions.KVSetAttrFilter,
            action => {
                this.changeState(
                    state => {
                        state.data[action.payload.sourceId].attrsFilters[action.payload.attr] = action.payload.value;
                        if (action.payload.attr == 'ud') {
                            state.data[action.payload.sourceId].allUdFeats = Dict.map(
                                (items, attr) => {
                                    if (attr.toLowerCase().includes(action.payload.value) ||
                                            List.some(v => v.value.toLowerCase().includes(action.payload.value), items)) {
                                        List.forEach(
                                            item => {
                                                item.filteredOut = false;
                                            },
                                            items
                                        )

                                    } else {
                                        List.forEach(
                                            item => {
                                                item.filteredOut = true;
                                            },
                                            items
                                        )
                                    }
                                    return items
                                },
                                state.data[action.payload.sourceId].allUdFeats
                            );

                        } else {
                            state.data[action.payload.sourceId].allAttrs[action.payload.attr] = List.map(
                                item => ({
                                    ...item,
                                    filteredOut: !item.value.toLowerCase().includes(action.payload.value.toLowerCase())
                                }),
                                state.data[action.payload.sourceId].allAttrs[action.payload.attr]
                            );
                        }
                    }
                );
            }
        );

        this.addActionHandler(
            Actions.KVSetUDFeatsFilter,
            action => {
                this.changeState(
                    state => {
                        state.data[action.payload.sourceId].udFeatsFilters[action.payload.attr] = action.payload.value;
                    }
                );
            }
        );

        this.addActionSubtypeHandler(
            Actions.KVGetInitialDataNOP,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    state.isBusy = false;
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.KVGetFilteredDataDone,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                if (action.error) {
                    this.pluginApi.showMessage('error', action.error);
                    return;
                }
                this.changeState(state => {
                    const data = state.data[action.payload.sourceId];
                    Dict.forEach(
                        (items, attr) => {
                            if (action.payload.activeAttr === attr) {
                                List.forEach(
                                    item => {
                                        if (item.available === 'available') {
                                            item.available = 'edited';
                                        }
                                    },
                                    items
                                );

                            } else if (List.some(v => v.available && v.selected, items)) {
                                List.forEach(
                                    item => {
                                        if (item.available !== 'unavailable') {
                                            item.available = 'locked';
                                        }
                                    },
                                    items
                                );

                            } else {
                                List.forEach(
                                    item => {
                                        item.available = (() => {
                                            if (List.find(
                                                v => v === item.value,
                                                action.payload.attrs[attr] || []
                                                ) !== undefined) {
                                                return 'available';
                                            }
                                            item.selected = false;
                                            return 'unavailable';
                                        })()
                                    },
                                    items
                                );
                            }
                        },
                        data.allAttrs
                    );
                    if (!!action.payload.activeUdFeat) {
                        Dict.forEach(
                            (items, attr) => {
                                List.forEach(
                                    item => {
                                        if (item.available === 'available') {
                                            item.available = 'edited';
                                        }
                                    },
                                    items
                                )
                            },
                            data.allUdFeats
                        );

                    } else if (Dict.some(items => List.some(v => v.available && v.selected, items), data.allUdFeats)) {
                        Dict.forEach(
                            items => {
                                List.forEach(
                                    item => {
                                        if (item.available !== 'unavailable') {
                                            item.available = 'locked';
                                        }
                                    },
                                    items
                                );
                            },
                            data.allUdFeats
                        );

                    } else {
                        Dict.forEach(
                            (items, attr) => {
                                List.forEach(
                                    item => {
                                        item.available = (() => {
                                            if (List.find(
                                                v => v === item.value,
                                                action.payload.udFeats[attr] || []
                                                ) !== undefined) {
                                                return 'available';
                                            }
                                            item.selected = false;
                                            return 'unavailable';
                                        })()
                                    },
                                    items
                                )
                            },
                            data.allUdFeats
                        );
                    }
                    data.generatedQuery = composeQuery(data);
                    state.isBusy = false;
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.KVAddFilter,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    if (action.payload.isUdFeat) {
                        const srch = List.find(
                            v => v.value === action.payload.value,
                            state.data[action.payload.sourceId].allUdFeats[action.payload.name]
                        );
                        if (srch) {
                            srch.selected = true;
                        }

                    } else {
                        const srch = List.find(
                            v => v.value === action.payload.value,
                            state.data[action.payload.sourceId].allAttrs[action.payload.name]
                        );
                        if (srch) {
                            srch.selected = true;
                        }
                    }
                    state.data[action.payload.sourceId].filterFeaturesHistory.push({
                        attr: action.payload.name,
                        value: action.payload.value,
                        checked: true,
                        isUdFeat: action.payload.isUdFeat
                    });
                });
                this.updateFeatures(
                    action.payload.sourceId,
                    action.payload.isUdFeat ? undefined : action.payload.name,
                    action.payload.isUdFeat ? action.payload.name : undefined
                );
            }
        );

        this.addActionSubtypeHandler(
            Actions.KVRemoveFilter,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    if (action.payload.isUdFeat) {
                        const srch = List.find(
                            v => v.value === action.payload.value,
                            state.data[action.payload.sourceId].allUdFeats[action.payload.name]
                        );
                        if (srch) {
                            srch.selected = false;
                        }

                    } else {
                        const srch = List.find(
                            v => v.value === action.payload.value,
                            state.data[action.payload.sourceId].allAttrs[action.payload.name]
                        );
                        if (srch) {
                            srch.selected = false;
                        }
                    }
                    state.data[action.payload.sourceId].filterFeaturesHistory.push({
                        attr: action.payload.name,
                        value: action.payload.value,
                        checked: false,
                        isUdFeat: action.payload.isUdFeat
                    });
                });
                this.updateFeatures(
                    action.payload.sourceId,
                    action.payload.isUdFeat ? undefined : action.payload.name,
                    action.payload.isUdFeat ? action.payload.name : undefined
                );
            }
        );

        this.addActionSubtypeHandler(
            Actions.Undo,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                if (List.size(this.state.data[action.payload.sourceId].filterFeaturesHistory) === 1) {
                    this.pluginApi.showMessage('info', 'already at the beginning');
                    return;
                }
                const lastOp = List.last(this.state.data[action.payload.sourceId].filterFeaturesHistory);
                this.changeState(state => {
                    const data = state.data[action.payload.sourceId];
                    data.filterFeaturesHistory = List.init(data.filterFeaturesHistory);
                    if (lastOp.isUdFeat) {
                        const srch = List.find(
                            v => v.value === lastOp.value,
                            data.allUdFeats[lastOp.attr]
                        );
                        if (srch) {
                            srch.selected = !lastOp.checked;
                        }

                    } else {
                        const srch = List.find(
                            v => v.value === lastOp.value,
                            data.allAttrs[lastOp.attr]
                        );
                        if (srch) {
                            srch.selected = !lastOp.checked;
                        }
                    }
                    state.isBusy = true;
                    data.generatedQuery = composeQuery(data);
                });
                this.updateFeatures(
                    action.payload.sourceId,
                    lastOp.isUdFeat ? undefined : lastOp.attr,
                    lastOp.isUdFeat ? lastOp.attr : undefined
                );
            }
        );

        this.addActionSubtypeHandler(
            Actions.Reset,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    const data = state.data[action.payload.sourceId];
                    data.filterFeaturesHistory = [null];
                    data.allAttrs = pipe(
                        data.allAttrs,
                        Dict.map(
                            (values, k) => {
                                return List.map(
                                    item => ({...item, available: 'available', selected: false}),
                                    values
                                )
                            }
                        )
                    );
                    data.allUdFeats = pipe(
                        data.allUdFeats,
                        Dict.map(
                            (values, k) => {
                                return List.map(
                                    item => ({...item, available: 'available', selected: false}),
                                    values
                                )
                            }
                        )
                    )
                    data.generatedQuery = composeQuery(data);
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.SetActiveTag,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    if (!Dict.hasKey(action.payload.sourceId, state.data)) {
                        state.data[action.payload.sourceId] = createEmptyUDTagsetStatus(
                                state.tagsetInfo, action.payload.corpname);
                    }
                });
                if (this.state.data[action.payload.sourceId].filterFeaturesHistory.length === 1) {
                    this.getFilteredFeatures<typeof Actions.KVGetInitialDataDone['payload']>(
                        (data, err) => err ?
                        {
                            name: Actions.KVGetInitialDataDone.name,
                            error: err

                        } :
                        {
                            name: Actions.KVGetInitialDataDone.name,
                            payload: {
                                tagsetId: this.tagsetId,
                                sourceId: action.payload.sourceId,
                                attrs: data.attrs,
                                udFeats: data.udFeats,
                                attrConf: data.attrConf

                            }
                        },
                        action.payload.sourceId
                    );

                } else {
                    this.dispatchSideEffect<typeof Actions.KVGetInitialDataNOP>({
                        name: Actions.KVGetInitialDataNOP.name,
                        payload: {
                            tagsetId: action.payload.tagsetId
                        }
                    });
                }
            }
        );

        this.addActionHandler(
            QueryActions.SetActiveInputWidget,
            action => {
                this.changeState(state => {
                    if (!Dict.hasKey(action.payload.sourceId, state.data)) {
                        state.data[action.payload.sourceId] = createEmptyUDTagsetStatus(
                                state.tagsetInfo, action.payload.corpname);
                    }
                    state.data[action.payload.sourceId].queryRange = action.payload.appliedQueryRange;
                });
            }
        );
    }

    private exportFilter(state:UDTagBuilderModelState, sourceId:string) {
        return {
            corpname: sourceId,
            attrs: pipe(
                state.data[sourceId].allAttrs,
                Dict.filter(
                    (items, k) => List.some(v => v.selected, items)
                ),
                Dict.map(
                    (items, k) => pipe(
                        items,
                        List.filter(v => v.selected),
                        List.map(v => v.value)
                    )
                )
            ),
            udFeats: pipe(
                state.data[sourceId].allUdFeats,
                Dict.filter(
                    (items, k) => List.some(v => v.selected, items)
                ),
                Dict.map(
                    (items, k) => pipe(
                        items,
                        List.filter(v => v.selected),
                        List.map(v => v.value)
                    )
                )
            )
        }
    }

    private getFilteredFeatures<U>(
        actionFactory:(data:DataResponse, err?:Error)=>Action<U>,
        sourceId:string
    ) {
        const baseArgs = {
            corpname: this.state.data[sourceId].corpname,
            tagset: this.state.tagsetInfo.ident
        };

        this.pluginApi.ajax$<DataResponse>(
            HTTP.Method.POST,
            this.pluginApi.createActionUrl(
                'corpora/ajax_get_tag_variants',
                baseArgs
            ),
            {args: JSON.stringify(this.exportFilter(this.state, sourceId))},

        ).subscribe({
            next: result => {
                this.dispatchSideEffect<Action<U>>(actionFactory(result));
            },
            error: error => {
                this.dispatchSideEffect(actionFactory(null, error));
            }
        });
    }

    private updateFeatures(sourceId:string, activeAttr:string|undefined, activeUdFeat:string|undefined):void {
        this.getFilteredFeatures<typeof Actions.KVGetFilteredDataDone['payload']>(
            (data, err) => err ?
                {
                    name: Actions.KVGetFilteredDataDone.name,
                    error: err

                } :
                {
                    name: Actions.KVGetFilteredDataDone.name,
                    payload: {
                        tagsetId: this.tagsetId,
                        sourceId,
                        attrs: data.attrs,
                        activeAttr,
                        activeUdFeat,
                        udFeats: data.udFeats
                    }
                },
            sourceId
        );
    }

}
