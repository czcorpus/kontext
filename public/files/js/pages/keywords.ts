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

import * as Kontext from '../types/kontext';
import { PageModel } from '../app/page';
import { KontextPage } from '../app/main';
import { init as viewInit } from '../views/keywords/result';
import { Root } from 'react-dom/client';
import { KeywordsResultModel } from '../models/keywords/result';
import { KeywordsSubmitArgs } from '../models/keywords/common';
import { Actions } from '../models/keywords/actions';


/**
 *
 */
export class KeywordsResultPage {

    private readonly layoutModel:PageModel;

    private resultModel:KeywordsResultModel;

    private reactRoot:Root;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            this.resultModel = new KeywordsResultModel({
                dispatcher: this.layoutModel.dispatcher,
                layoutModel: this.layoutModel,
                refCorpname: this.layoutModel.getConf<KeywordsSubmitArgs>('KeywordsForm').ref_corpname,
                refSubcorpId: this.layoutModel.getConf<KeywordsSubmitArgs>('KeywordsForm').ref_usesubcorp,
                focusCorpname: this.layoutModel.getCorpusIdent().id,
                focusSubcorpname: this.layoutModel.getCorpusIdent().subcName,
                focusSubcorpId: this.layoutModel.getCorpusIdent().usesubcorp,
                attr: this.layoutModel.getConf<KeywordsSubmitArgs>('KeywordsForm').wlattr,
            });
            const view = viewInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                keywordsResultModel: this.resultModel,
            });
            this.reactRoot = this.layoutModel.renderReactComponent(
                view,
                window.document.getElementById('keywords-result-mount'),
            );

            this.layoutModel.getHistory().setOnPopState(
                (evt:PopStateEvent) => {
                    if ('kwsort' in evt.state && 'kwpage' in evt.state) {
                        this.layoutModel.dispatcher.dispatch(
                            Actions.KeywordsHistoryPopState,
                            {...evt.state}
                        );
                    }
                }
            );
            this.layoutModel.initKeyShortcuts();
        });
    }
}


export function init(conf:Kontext.Conf):void {
    new KeywordsResultPage(new KontextPage(conf)).init();
}