/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Freq2DTableModel } from '../twoDimension/table2d';
import { Freq2DFlatViewModel } from '../twoDimension/flatTable';
import { IFullActionControl, StatefulModel } from 'kombo';
import { Actions as MainMenuActions } from '../../mainMenu/actions';
import { Actions as Actions2df } from '../twoDimension/actions';


export interface FreqCTResultsSaveModelState {
    saveMode:string;
}

export class FreqCTResultsSaveModel extends StatefulModel<FreqCTResultsSaveModelState> {

    ctTableModel:Freq2DTableModel;

    ctFlatModel:Freq2DFlatViewModel;

    constructor(dispatcher:IFullActionControl, ctTableModel:Freq2DTableModel, ctFlatModel:Freq2DFlatViewModel) {
        super(dispatcher, {saveMode: null});
        this.ctTableModel = ctTableModel;
        this.ctFlatModel = ctFlatModel;

        this.addActionHandler<typeof Actions2df.SetCtSaveMode>(
            Actions2df.SetCtSaveMode.name,
            action => this.changeState(state => {state.saveMode = action.payload.value})
        );

        this.addActionHandler<typeof MainMenuActions.DirectSave>(
            MainMenuActions.DirectSave.name,
            action => {
                if (this.state.saveMode === 'table') {
                    this.ctTableModel.submitDataConversion(action.payload.saveformat);

                } else if (this.state.saveMode === 'list') {
                    this.ctFlatModel.submitDataConversion(action.payload.saveformat);
                }
            }
        );
    }

}