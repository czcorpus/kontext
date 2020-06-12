/*
 * Copyright (c) 2018 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

import * as Immutable from 'immutable';
import { Kontext } from '../types/common';
import { PageModel } from '../app/page';
import { Action, IFullActionControl, StatefulModel } from 'kombo';


export interface NonQueryCorpusSelectionModelState {
    currentSubcorp:string;
    origSubcorpName:string;
    isForeignSubcorp:boolean;
    availSubcorpora:Immutable.List<Kontext.SubcorpListItem>;
    corpora:Immutable.List<string>;
}

/**
 * Fixed corpus, selectable subcorpus. This is used as an alternative to query model
 * on the 'first_form' page for pages where we still expect switching of (sub)corpus
 * but not for querying purposes.
 */
export class NonQueryCorpusSelectionModel extends StatefulModel<NonQueryCorpusSelectionModelState> {

    private readonly layoutModel:PageModel;

    constructor({layoutModel, dispatcher, usesubcorp, origSubcorpName, foreignSubcorp, corpora, availSubcorpora=[]}:{
            layoutModel:PageModel;
            dispatcher:IFullActionControl;
            usesubcorp:string;
            origSubcorpName:string;
            foreignSubcorp:boolean;
            corpora:Array<string>;
            availSubcorpora:Array<Kontext.SubcorpListItem>}) {
        super(
            dispatcher,
            {
                currentSubcorp: usesubcorp,
                origSubcorpName: origSubcorpName,
                isForeignSubcorp: foreignSubcorp,
                availSubcorpora: Immutable.List<Kontext.SubcorpListItem>(availSubcorpora),
                corpora: Immutable.List<string>(corpora)
            }
        );
        this.layoutModel = layoutModel;
    }

    onAction(action:Action) {
        switch (action.name) {
            case 'QUERY_INPUT_SELECT_SUBCORP':
                if (action.payload['pubName']) {
                    this.state.currentSubcorp = action.payload['pubName'];
                    this.state.origSubcorpName = action.payload['subcorp'];
                    this.state.isForeignSubcorp = action.payload['foreign'];

                } else {
                    this.state.currentSubcorp = action.payload['subcorp'];
                    this.state.origSubcorpName = action.payload['subcorp'];
                    this.state.isForeignSubcorp = false;
                }
                const corpIdent = this.layoutModel.getCorpusIdent();
                this.layoutModel.setConf<Kontext.FullCorpusIdent>(
                    'corpusIdent',
                    {
                        id: corpIdent.id,
                        name: corpIdent.name,
                        variant: corpIdent.variant,
                        usesubcorp: this.state.currentSubcorp,
                        origSubcorpName: this.state.origSubcorpName,
                        foreignSubcorp: this.state.isForeignSubcorp
                    }
                );
                this.emitChange();
            break;
        }
    }

    unregister():void {}
}