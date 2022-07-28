/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Observable, tap, throwError } from 'rxjs';
import { IActionQueue, StatelessModel } from 'kombo';

import { PageModel } from '../../app/page';
import { Actions } from './actions';
import { HTTP } from 'cnc-tskit';
import { CreateSubcorpus, SubcorpusRecord } from './common';
import { SubcorpusPropertiesResponse } from '../common/layout';



export interface DerivedSubcorp {
    cql:string|undefined;
    published:boolean;
    description:string|undefined;
}


export interface SubcorpusEditModelState {
    isBusy:boolean;
    data:SubcorpusRecord|undefined;
    derivedSubc:DerivedSubcorp|undefined;
    liveAttrsEnabled:boolean;
}

/*
if (action.payload.value === 'reuse') {
                    const line = this.state.lines[action.payload.row];
                    if (line.cql === undefined && line.cqlAvailable) {
                        this.changeState(state => {
                            state.isBusy = true;
                        });

                        this.layoutModel.ajax$<SubcorpusInfoResponse>(
                            HTTP.Method.GET,
                            this.layoutModel.createActionUrl('subcorpus/subcorpus_info'),
                            {
                                'corpname': line.corpname,
                                'usesubcorp': line.usesubcorp
                            }
                        ).subscribe({
                            next: data => {
                                if (data.extended_info) {
                                    this.changeState(state => {
                                        state.lines[action.payload.row].cql = data.extended_info.cql;
                                        state.isBusy = false;
                                    })
                                }
                            },
                            error: error => {
                                this.changeState(
                                    state => {
                                        state.isBusy = false;
                                    }
                                );
                                this.layoutModel.showMessage('error', error);
                            }
                        });
                    }
                }
                */



export class SubcorpusEditModel extends StatelessModel<SubcorpusEditModelState> {

    readonly layoutModel:PageModel;

    constructor(
        dispatcher:IActionQueue,
        initialState:SubcorpusEditModelState,
        layoutModel:PageModel
    ) {
        super(dispatcher, initialState);
        this.layoutModel = layoutModel;

        this.addActionHandler(
            Actions.LoadSubcorpus,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.layoutModel.ajax$<SubcorpusPropertiesResponse>(
                    HTTP.Method.GET,
                    this.layoutModel.createActionUrl('/subcorpus/properties'),
                    {
                        corpname: action.payload?.corpname,
                        _usesubcorp: action.payload?.subcname,
                    }

                ).subscribe({
                    next: (data) => {
                        dispatch(
                            Actions.LoadSubcorpusDone,
                            {
                                corpname: action.payload?.corpname,
                                subcname: action.payload?.subcname,
                                // TODO improve data SubcorpusRecord type
                                data: {
                                    corpname: data.data.corpus_name,
                                    usesubcorp: data.data.id,
                                    origSubcName: data.data.name,
                                    deleted: data.data.archived,
                                    created: data.data.created,
                                    published: data.data.published,
                                    selections: data.data.text_types||data.data.within_cond||data.data.cql,
                                    size: data.data.size,
                                    description: data.data.public_description,
                                },
                                textTypes: data.textTypes,
                                structsAndAttrs: data.structsAndAttrs,
                                liveAttrsEnabled: data.liveAttrsEnabled,
                            }
                        );
                    },
                    error: (error) => {
                        dispatch(
                            Actions.LoadSubcorpusDone,
                            error
                        );
                    }
                })
            }
        );

        this.addActionHandler(
            Actions.LoadSubcorpusDone,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    // TODO
                    console.log('err: ', action.error)

                } else {
                    state.data = action.payload?.data;
                    state.liveAttrsEnabled = action.payload.liveAttrsEnabled;
                }
            }
        );

        this.addActionHandler(
            Actions.WipeSubcorpus,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.wipeSubcorpus(
                    state

                ).subscribe({
                    next: data => {
                        dispatch(
                            Actions.WipeSubcorpusDone
                        )
                        // TODO this goes to subc list model (WipeSubcorpusDone)
                        //this.layoutModel.showMessage('info',
                        //this.layoutModel.translate('subclist__subc_wipe_confirm_msg'));

                    },
                    error: error => {
                        this.layoutModel.showMessage('error', error);
                    }
                })
            }
        );

        this.addActionHandler(
            Actions.WipeSubcorpusDone,
            (state, action) => {
                state.isBusy = false;
            }
        )

        this.addActionHandler(
            Actions.RestoreSubcorpus,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.createSubcorpus(
                    state,
                    true
                ).subscribe({
                    next: data => {
                        dispatch(
                            Actions.RestoreSubcorpusDone,
                        )
                    },
                    error: error => {
                        dispatch(
                            Actions.RestoreSubcorpusDone,
                            error
                        )
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.RestoreSubcorpusDone,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);

                } else {
                    this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_restore_confirm_msg'));
                }
            }
        )

        this.addActionHandler(
            Actions.ReuseQuery,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.createSubcorpus(
                    state,
                    false,
                    action.payload.newName,
                    action.payload.newCql

                ).subscribe({
                    next: data => {
                        dispatch(Actions.ReuseQueryDone);
                    },
                    error: error => {
                        dispatch(Actions.ReuseQueryDone, error);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.ReuseQueryDone,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_reuse_confirm_msg'));

                } else {
                    this.layoutModel.showMessage('error', action.error);
                }
            }
        );

        this.addActionHandler(
            Actions.PublishSubcorpus,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.publishSubcorpus(
                    state,
                    action.payload.description

                ).subscribe({
                    next: _ => {
                        dispatch(Actions.PublishSubcorpusDone);
                    },
                    error: error => {
                        dispatch(Actions.PublishSubcorpusDone, error);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.PublishSubcorpusDone,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);

                } else {
                    state.data.published = action.payload.published;
                    state.data.description = action.payload.description;
                    state.data.origSubcName = state.data.usesubcorp;
                    state.data.usesubcorp = action.payload.pubSubcname;
                    this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_published'));
                }
            }
        )

        this.addActionHandler(
            Actions.SubmitPublicDescription,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.updateSubcorpusDescSubmit(state).subscribe({
                    next: _ => {
                        dispatch(
                            Actions.SubmitPublicDescriptionDone
                        );

                    },
                    error: error => {
                        dispatch(
                            Actions.SubmitPublicDescriptionDone,
                            error
                        )
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.SubmitPublicDescriptionDone,
            (state, action) => {
                if (action.error) {
                    this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_desc_updated'));

                } else {
                    this.layoutModel.showMessage('error', action.error);
                }
            }
        )

        this.addActionHandler(
            Actions.UpdatePublicDescription,
            (state, action) => {
                state.data.description = action.payload.description;
            }
        );
    }

    private updateSubcorpusDescSubmit(state:SubcorpusEditModelState):Observable<any> {
        return this.layoutModel.ajax$(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/update_public_desc'),
            {
                corpname: state.data.corpname,
                usesubcorp: state.data.usesubcorp,
                description: state.data.description
            }
        );
    }

    private publishSubcorpus(state:SubcorpusEditModelState, description:string):Observable<any> {
        if (state.data.deleted) {
            return throwError(() => new Error('Cannot publish deleted subcorpus'));
        }
        return this.layoutModel.ajax$(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/publish_subcorpus'),
            {
                corpname: state.data.corpname,
                subcname: state.data.usesubcorp,
                description
            }
        );
    }

    private createSubcorpus(
        state:SubcorpusEditModelState,
        removeOrig:boolean,
        subcname?:string,
        cql?:string
    ):Observable<any> {

        return this.layoutModel.ajax$<CreateSubcorpus>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/ajax_create_subcorpus'),
            {
                corpname: state.data.corpname,
                subcname: subcname !== undefined ? subcname : state.data.usesubcorp,
                publish: false,
                //cql: cql !== undefined ? cql : state.data.cql // TODO not just from CQL
            }

        ).pipe(
            tap((data) => {
                data.processed_subc.forEach(item => {
                    this.layoutModel.registerTask({
                        ident: item.ident,
                        label: item.label,
                        category: item.category,
                        status: item.status,
                        created: item.created,
                        error: item.error,
                        args: item.args,
                        url: undefined
                    });

                });
            })
        );
    }

    private wipeSubcorpus(state:SubcorpusEditModelState):Observable<any> {
        return this.layoutModel.ajax$(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/ajax_wipe_subcorpus'),
            {
                corpname: state.data.corpname,
                subcname: state.data.usesubcorp
            }
        );
    }


}