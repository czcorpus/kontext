/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
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

import { Action, IModel } from 'kombo';
import { IUnregistrable } from '../../models/common/common';
import { AttrItem } from '../kontext';
import { ExportedSelection } from '../textTypes';
import { BasePlugin, IPluginApi } from './common';


// ------------------------------------------------------------------------
// -------------------------- [live_attributes] plug-in -------------------

export type View = React.ComponentClass|React.FC;

export type CustomAttribute = React.ComponentClass|React.FC;

export class Actions {

    static RefineClicked:Action<{
    }> = {
        name: 'LIVE_ATTRIBUTES_REFINE_CLICKED'
    };

    static RefineReady:Action<{
        selections:ExportedSelection;
        newSelections:Array<[string, string]>; // 2-tuples (attr name, attr_value)
    }> = {
        name: 'LIVE_ATTRIBUTES_REFINE_READY'
    };

    static isRefineReady(a:Action<{}>):a is typeof Actions.RefineReady {
        return a.name === Actions.RefineReady.name;
    }

    /**
     * RefineCancelled is used in case we want to
     * perform an "empty" refine action (e.g. nothing really changed
     * from the last refine but the whole machinery already running).
     * In such case we just pass empty data and dispatch this action.
     */
     static RefineCancelled:Action<{
         currentSubcorpSize:number;
     }> = {
        name: 'LIVE_ATTRIBUTES_REFINE_CANCELLED'
    }

    static ResetClicked:Action<{
    }> = {
        name: 'LIVE_ATTRIBUTES_RESET_CLICKED'
    };

    static UndoClicked:Action<{
    }> = {
        name: 'LIVE_ATTRIBUTES_UNDO_CLICKED'
    };

    static ToggleMinimizeAlignedLangList:Action<{
    }> = {
        name: 'LIVE_ATTRIBUTES_TOGGLE_MINIMIZE_ALIGNED_LANG_LIST'
    };

    static AlignedCorpChanged:Action<{
        idx:number;
    }> = {
        name: 'LIVE_ATTRIBUTES_ALIGNED_CORP_CHANGED'
    };
}

export interface Views {
    LiveAttrsView:View;
    LiveAttrsCustomTT:CustomAttribute;
}

export interface IPlugin extends IUnregistrable, BasePlugin {

    getViews(subcMixerView:View, textTypesModel:IModel<{}>):Views;

}

/**
 *
 */
export interface InitArgs {

    /**
     * A structural attribute used to uniquely identify a bibliographic
     * item (i.e. a book). Typically something like "doc.id".
     */
    bibAttr:string;

    /**
     * A list of aligned corpora available to be attached to
     * the current corpus.
     */
    availableAlignedCorpora:Array<AttrItem>;

    /**
     * Enable "refine" button when component is initialized?
     * (e.g. for restoring some previous state where user
     * already selected some values).
     */
    refineEnabled:boolean;

    /**
     * If manual mode is disabled then the list of
     * aligned corpora is synced automatically from
     * the query form (i.e. if user selects/drops an aligned
     * corpus then the model's internal list is updated
     * accordingly)
     */
    manualAlignCorporaMode:boolean;
}

export interface Factory {
    (
        pluginApi:IPluginApi,
        isEnabled:boolean,
        controlsAlignedCorpora:boolean,
        args:InitArgs
    ):IPlugin;
}

