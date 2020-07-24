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
import { CalculationResults } from './common';

export enum ActionName {

    ShowWidget = 'UCNK_SUBCMIXER_SHOW_WIDGET',
    HideWidget = 'UCNK_SUBCMIXER_HIDE_WIDGET',
    SetRatio = 'UCNK_SUBCMIXER_SET_RATIO',
    SetRatioValidate = 'UCNK_SUBCMIXER_SET_RATIO_VALIDATE',
    SubmitTask = 'UCNK_SUBCMIXER_SUBMIT_TASK',
    SubmitTaskDone = 'UCNK_SUBCMIXER_SUBMIT_TASK_DONE',
    SubmitCreateSubcorpus = 'UCNK_SUBCMIXER_CREATE_SUBCORPUS',
    CreateSubcorpusDone = 'UCNK_SUBCMIXER_CREATE_SUBCORPUS_DONE',
    ClearResult = 'UCNK_SUBCMIXER_CLEAR_RESULT'

}

export namespace Actions {

    export interface ShowWidget extends Action<{
    }> {
        name: ActionName.ShowWidget;
    }

    export interface HideWidget extends Action<{
    }> {
        name: ActionName.HideWidget;
    }

    export interface SetRatio extends Action<{
        attrName:string;
        attrValue:string;
        ratio:string;
    }> {
        name: ActionName.SetRatio;
    }

    export interface SetRatioValidate extends Action<{
        attrName:string;
        attrValue:string;
        isInvalid:boolean;
    }> {
        name: ActionName.SetRatioValidate;
    }

    export interface SubmitTask extends Action<{
    }> {
        name: ActionName.SubmitTask;
    }

    export interface SubmitTaskDone extends Action<{
        result:CalculationResults;
    }> {
        name: ActionName.SubmitTaskDone;
    }

    export interface SubmitCreateSubcorpus extends Action<{
    }> {
        name: ActionName.SubmitCreateSubcorpus;
    }

    export interface CreateSubcorpusDone extends Action<{
    }> {
        name: ActionName.CreateSubcorpusDone;
    }

    export interface ClearResult extends Action<{
    }> {
        name: ActionName.ClearResult;
    }
}