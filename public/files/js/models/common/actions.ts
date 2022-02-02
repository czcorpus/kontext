/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
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
import * as Kontext from '../../types/kontext';
import { ConcServerArgs } from '../concordance/common';


export interface CorpusSwitchModelRestorePayload {
    data:{[key:string]:any};
    corpora:Array<[string, string]>;
    newPrimaryCorpus?:string;
}

export class Actions {

    static MessageAdd:Action<{
        messageType:Kontext.UserMessageTypes;
        message:any; // any is here intentionally - we just try to convert anything to a message
    }> = {
        name: 'MESSAGE_ADD'
    };

    static MessageDecreaseTTL:Action<{
    }> = {
        name: 'MESSAGE_DECREASE_TTL'
    };

    static MessageClose:Action<{
        messageId:string;
    }> = {
        name: 'MESSAGE_CLOSED'
    };

    static CorpusSwitchModelRestore:Action<CorpusSwitchModelRestorePayload> = {
        name: 'CORPUS_SWITCH_MODEL_RESTORE'
    };

    static SwitchCorpus:Action<{
        corpora:Array<string>;
        subcorpus:string;
        newPrimaryCorpus?:string;
    }> = {
        name: 'SWITCH_CORPUS'
    };

    static SwitchCorpusDone:Action<{}> = {
        name: 'SWITCH_CORPUS_DONE'
    };

    static SwitchCorpusReady:Action<{
        modelId:string;
        data:unknown;
    }> = {
        name: 'SWITCH_CORPUS_READY'
    };

    static isSwitchCorpusReady(a:Action):a is typeof Actions.SwitchCorpusReady {
        return a.name === Actions.SwitchCorpusReady.name;
    };

    static OverviewClose:Action<{}> = {
        name: 'OVERVIEW_CLOSE'
    };

    static OverviewCorpusInfoRequired:Action<{
        corpusId:string;
    }> = {
        name: 'OVERVIEW_CORPUS_INFO_REQUIRED'
    };

    static OverviewShowActionCitationInfo:Action<{
        corpusId:string;
    }> = {
        name: 'OVERVIEW_SHOW_CITATION_INFO'
    };

    static OverviewShowSubcorpusInfo:Action<{
        corpusId:string;
        subcorpusId:string;
    }> = {
        name: 'OVERVIEW_SHOW_SUBCORPUS_INFO'
    };

    static OverviewShowKeyShortcuts:Action<{
    }> = {
        name: 'OVERVIEW_SHOW_KEY_SHORTCUTS'
    };

    static ConcArgsUpdated:Action<{
        args:ConcServerArgs;
    }> = {
        name: 'CONC_ARGS_UPDATED'
    };

    static ConvertSVG:Action<{
        format:'svg'|'png';
        filename:string;
        blob:string;
    }> = {
        name: 'GLOBAL_CONVERT_SVG'
    };

    static ConvertSVGDone:Action<{
        target:'svg'|'png'|'jpg';
        filename:string;
        blob:string;
    }> = {
        name: 'GLOBAL_CONVERT_SVG_DONE'
    };
}