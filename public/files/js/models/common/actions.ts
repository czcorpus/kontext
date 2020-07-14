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
import { Kontext } from '../../types/common';


export enum ActionName {
    MessageAdd = 'MESSAGE_ADD',
    MessageDecreaseTTL = 'MESSAGE_DECREASE_TTL',
    MessageClose = 'MESSAGE_CLOSED',
    SwitchCorpus = 'SWITCH_CORPUS',
    SwitchCorpusReady = 'SWITCH_CORPUS_READY',
    SwitchCorpusDone = 'SWITCH_CORPUS_DONE',
    CorpusSwitchModelRestore = 'CORPUS_SWITCH_MODEL_RESTORE'
}

export interface CorpusSwitchModelRestorePayload {
    data:{[key:string]:any};
    corpora:Array<[string, string]>;
}

export namespace Actions {

    export interface MessageAdd extends Action<{
        messageType:Kontext.UserMessageTypes;
        messageText:string;
    }> {
        name:ActionName.MessageAdd;
    }

    export interface MessageDecreaseTTL extends Action<{
    }> {
        name:ActionName.MessageDecreaseTTL;
    }

    export interface MessageClose extends Action<{
        messageId:string;
    }> {
        name:ActionName.MessageClose;
    }

    export interface CorpusSwitchModelRestore extends
            Action<CorpusSwitchModelRestorePayload> {
        name:ActionName.CorpusSwitchModelRestore;
    }

    export interface SwitchCorpus extends Action<{
        corpora:Array<string>;
        subcorpus:string;
    }> {
        name:ActionName.SwitchCorpus;
    }

    export interface SwitchCorpusDone extends Action<{
    }> {
        name:ActionName.SwitchCorpusDone;
    }

    export interface SwitchCorpusReady<T> extends Action<{
        modelId:string;
        data:T;
    }> {
        name:ActionName.SwitchCorpusReady;
    }
}