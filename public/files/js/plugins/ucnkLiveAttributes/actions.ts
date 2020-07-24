/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

import { Action } from 'kombo';

export enum ActionName {
    RefineClicked = 'LIVE_ATTRIBUTES_REFINE_CLICKED',
    ResetClicked = 'LIVE_ATTRIBUTES_RESET_CLICKED',
    UndoClicked = 'LIVE_ATTRIBUTES_UNDO_CLICKED',
    ToggleMinimizeAlignedLangList = 'LIVE_ATTRIBUTES_TOGGLE_MINIMIZE_ALIGNED_LANG_LIST',
    AlignedCorpChanged = 'LIVE_ATTRIBUTES_ALIGNED_CORP_CHANGED',

}


export namespace Actions {

    export interface RefineClicked extends Action<{
    }> {
        name:ActionName.RefineClicked;
    }

    export interface ResetClicked extends Action<{
    }> {
        name:ActionName.ResetClicked;
    }

    export interface UndoClicked extends Action<{
    }> {
        name:ActionName.UndoClicked;
    }

    export interface ToggleMinimizeAlignedLangList extends Action<{
    }> {
        name:ActionName.ToggleMinimizeAlignedLangList;
    }

    export interface AlignedCorpChanged extends Action<{
        idx:number;
    }> {
        name:ActionName.AlignedCorpChanged;
    }

}