/*
 * Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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

import { HTTP } from 'cnc-tskit';
import { IActionDispatcher, SEDispatcher, StatelessModel } from 'kombo';
import { PageModel } from '../../app/page';
import { IUnregistrable } from '../common/common';
import { Actions } from './actions';
import { Actions as GlobalActions } from '../common/actions';
import { KeywordsSubmitArgs, KeywordsSubmitResponse } from './common';
import { WlnumsTypes, WlTypes } from '../wordlist/common';



export interface KeywordsFormState {
    isBusy:boolean;
    refCorp:string;
    refSubcorp:string;
    attr:string;
    pattern:string;
}

export interface KeywordsFormCorpSwitchPreserve {
}

export interface KeywordsFormModelArgs {
    dispatcher:IActionDispatcher;
    layoutModel:PageModel;
    initialArgs:{
        ref_corpname:string;
        ref_usesubcorp:string;
        wlattr:string;
        wlpat:string;
    };
}

/**
 *
 */
export class KeywordsFormModel extends StatelessModel<KeywordsFormState> implements IUnregistrable {

    private readonly layoutModel:PageModel;

    constructor({
        dispatcher,
        layoutModel,
        initialArgs,
    }:KeywordsFormModelArgs) {
        super(
            dispatcher,
            {
                isBusy: false,
                refCorp: initialArgs ? initialArgs.ref_corpname : layoutModel.getNestedConf('corpusIdent', 'name'),
                refSubcorp: initialArgs ? initialArgs.ref_usesubcorp : '',
                attr: initialArgs ? initialArgs.wlattr : 'lemma',
                pattern: initialArgs ? initialArgs.wlpat : '.*',
            }
        );
        this.layoutModel = layoutModel;

        this.addActionHandler(
            GlobalActions.CorpusSwitchModelRestore,
            (state, action)  => {
                if (!action.error) {
                    this.deserialize(
                        state,
                        action.payload.data[this.getRegistrationId()] as KeywordsFormCorpSwitchPreserve,
                        action.payload.corpora,
                    );
                }
            }
        );

        this.addActionHandler(
            GlobalActions.SwitchCorpus,
            (state, action) => {
                dispatcher.dispatch<typeof GlobalActions.SwitchCorpusReady>({
                    name: GlobalActions.SwitchCorpusReady.name,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: this.serialize(state)
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.SetRefCorp,
            (state, action) => {
                state.refCorp = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.SetRefSubcorp,
            (state, action) => {
                state.refSubcorp = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.SetAttr,
            (state, action) => {
                state.attr = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.SetPattern,
            (state, action) => {
                state.pattern = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.SubmitQuery,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.submitRequest(state, dispatch);
            }
        );

        this.addActionHandler(
            Actions.SubmitQueryDone,
            (state, action) => {
                state.isBusy = false;
            }
        );
    }

    getRegistrationId():string {
        return 'KeywordsFormModel';
    }

    private serialize(state:KeywordsFormState):KeywordsFormCorpSwitchPreserve {
        return {
        };
    }

    private deserialize(
        state:KeywordsFormState,
        data:KeywordsFormCorpSwitchPreserve,
        corpora:Array<[string, string]>
    ):void {
        if (data) {
        }
    }

    createKeywordsArgs(state:KeywordsFormState, corpname:string, subcorp:string):KeywordsSubmitArgs {
        return {
            corpname: corpname,
            usesubcorp: subcorp,
            ref_corpname: state.refCorp,
            ref_usesubcorp: state.refSubcorp,
            include_nonwords: false,
            wlattr: state.attr,
            wlminfreq: 5,
            wlnums: WlnumsTypes.FRQ,
            wlpat: state.pattern,
            wltype: 'simple',
        }
    }

    submitRequest(state:KeywordsFormState, dispatch:SEDispatcher) {
        const corp = this.layoutModel.getCorpusIdent();
        this.layoutModel.ajax$<KeywordsSubmitResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'keywords/submit',
                {format: 'json'}
            ),
            this.createKeywordsArgs(state, corp.name, corp.usesubcorp),
            {contentType: 'application/json'}
        ).subscribe({
            next: (data) => {
                dispatch(Actions.SubmitQueryDone);
                window.location.href = this.layoutModel.createActionUrl(
                    'keywords/result',
                    {
                        corpname: corp.name,
                        usesubcorp: corp.usesubcorp,
                        q: `~${data.kw_query_id}`,
                    }
                );
            },
            error: (err) => {
                dispatch(Actions.SubmitQueryDone, err);
            }
        });
    }

}