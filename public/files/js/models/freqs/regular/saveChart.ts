/*
 * Copyright (c) 2022 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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

import * as Kontext from '../../../types/kontext';
import { PageModel } from '../../../app/page';
import { IFullActionControl, StatefulModel } from 'kombo';
import { Actions } from './actions';
import { Actions as GlobalActions } from '../../common/actions';

export interface FreqChartsSaveFormModelState {
    formIsActive:boolean;
    sourceId:string; // active fcrit (we can save only one at a time)
    formats:{[sourceId:string]:Kontext.ChartExportFormat};
    criteria:Array<{n:string; label:string}>;
}


/**
 *
 */
export class FreqChartsSaveFormModel extends StatefulModel<FreqChartsSaveFormModelState> {

    private readonly layoutModel:PageModel;

    static readonly SVG_SAVE_ID_PREFIX = 'freq-charts:';

    constructor(
        dispatcher:IFullActionControl,
        layoutModel:PageModel,
        initialState:FreqChartsSaveFormModelState
    ) {
        super(dispatcher, initialState);

        this.layoutModel = layoutModel;

        this.addActionHandler(
            Actions.ChartSaveFormSelectChart,
            action => {
                this.changeState(
                    state => {
                        state.sourceId = action.payload.sourceId;
                    }
                );
            }
        );

        this.addActionHandler(
            Actions.FreqChartsSetDownloadFormat,
            action => {
                this.changeState(
                    state => {
                        state.formats[action.payload.sourceId] = action.payload.format;
                    }
                );
            }
        );
    }

}