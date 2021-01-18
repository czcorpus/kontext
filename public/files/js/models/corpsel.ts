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

import { Action, IFullActionControl, StatefulModel } from 'kombo';

import { Kontext } from '../types/common';
import { PageModel } from '../app/page';
import { Actions as QueryActions, ActionName as QueryActionName } from './query/actions';



export interface NonQueryCorpusSelectionModelState {
    currentSubcorp:string;
    origSubcorpName:string;
    isForeignSubcorp:boolean;
    availSubcorpora:Array<Kontext.SubcorpListItem>;
    corpora:Array<string>;
}

/**
 * Fixed corpus, selectable subcorpus. This is used as an alternative to query model
 * on the 'query' page for pages where we still expect switching of (sub)corpus
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
                availSubcorpora: availSubcorpora,
                corpora: corpora
            }
        );
        this.layoutModel = layoutModel;

        this.addActionHandler<QueryActions.QueryInputSelectSubcorp>(
            QueryActionName.QueryInputSelectSubcorp,
            action => {
                this.changeState(state => {
                    if (action.payload.pubName) {
                        state.currentSubcorp = action.payload.pubName;
                        state.origSubcorpName = action.payload.subcorp;
                        state.isForeignSubcorp = action.payload.foreign;

                    } else {
                        state.currentSubcorp = action.payload.subcorp;
                        state.origSubcorpName = action.payload.subcorp;
                        state.isForeignSubcorp = false;
                    }
                });
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
            }
        );
    }
}