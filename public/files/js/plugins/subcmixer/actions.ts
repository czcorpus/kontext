/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { CalculationResults } from './common.js';


export class Actions {

    static SetRatio:Action<{
        attrName:string;
        attrValue:string;
        ratio:string;
    }> = {
        name: 'UCNK_SUBCMIXER_SET_RATIO'
    };

    static SetRatioValidate:Action<{
        attrName:string;
        attrValue:string;
        isInvalid:boolean;
    }> = {
        name: 'UCNK_SUBCMIXER_SET_RATIO_VALIDATE'
    };

    static SubmitTask:Action<{
    }> = {
        name: 'UCNK_SUBCMIXER_SUBMIT_TASK'
    };

    static SubmitTaskDone:Action<{
        result:CalculationResults;
    }> = {
        name: 'UCNK_SUBCMIXER_SUBMIT_TASK_DONE'
    };

    static SubmitCreateSubcorpus:Action<{
    }> = {
        name: 'UCNK_SUBCMIXER_CREATE_SUBCORPUS'
    };

    static CreateSubcorpusDone:Action<{
    }> = {
        name: 'UCNK_SUBCMIXER_CREATE_SUBCORPUS_DONE'
    };

    static ClearResult:Action<{
    }> = {
        name: 'UCNK_SUBCMIXER_CLEAR_RESULT'
    };
}