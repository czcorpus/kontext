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
import {Kontext} from '../types/common';
import {PluginInterfaces} from '../types/plugins';
import {PageModel} from '../app/main';
import { StatefulModel } from './base';
import { ActionDispatcher, ActionPayload } from '../app/dispatcher';

/**
 * Fixed corpus, selectable subcorpus. This is used as an alternative to query model
 * on the 'first_form' page for pages where we still expect switching of (sub)corpus
 * but not for querying purposes.
 */
export class NonQueryCorpusSelectionModel extends StatefulModel implements PluginInterfaces.Corparch.ICorpSelection {

    private layoutModel:PageModel;

    private currentSubcorp:string;

    private origSubcorpName:string;

    private availSubcorpora:Immutable.List<Kontext.SubcorpListItem>;

    private corpora:Immutable.List<string>;

    constructor({layoutModel, dispatcher, usesubcorp, origSubcorpName, corpora, availSubcorpora=[]}:{
            layoutModel:PageModel;
            dispatcher:ActionDispatcher;
            usesubcorp:string;
            origSubcorpName:string;
            corpora:Array<string>;
            availSubcorpora:Array<Kontext.SubcorpListItem>}) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.currentSubcorp = usesubcorp;
        this.origSubcorpName = origSubcorpName;
        this.availSubcorpora = Immutable.List<Kontext.SubcorpListItem>(availSubcorpora);
        this.corpora = Immutable.List<string>(corpora);

        this.dispatcherRegister((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'QUERY_INPUT_SELECT_SUBCORP':
                    if (payload.props['pubName']) {
                        this.currentSubcorp = payload.props['pubName'];
                        this.origSubcorpName = payload.props['subcorp'];

                    } else {
                        this.currentSubcorp = payload.props['subcorp'];
                        this.origSubcorpName = payload.props['subcorp'];
                    }
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    getCurrentSubcorpus():string {
        return this.currentSubcorp;
    }

    getOrigSubcorpName():string {
        return this.origSubcorpName;
    }

    getAvailableSubcorpora():Immutable.List<Kontext.SubcorpListItem> {
        return this.availSubcorpora;
    }

    getAvailableAlignedCorpora():Immutable.List<Kontext.AttrItem> {
        return Immutable.List<Kontext.AttrItem>();
    }

    getCorpora():Immutable.List<string> {
        return this.corpora;
    }
}