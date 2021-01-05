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
import { ConcServerArgs } from '../concordance/common';


export enum ActionName {
    MessageAdd = 'MESSAGE_ADD',
    MessageDecreaseTTL = 'MESSAGE_DECREASE_TTL',
    MessageClose = 'MESSAGE_CLOSED',
    SwitchCorpus = 'SWITCH_CORPUS',
    SwitchCorpusReady = 'SWITCH_CORPUS_READY',
    SwitchCorpusDone = 'SWITCH_CORPUS_DONE',
    CorpusSwitchModelRestore = 'CORPUS_SWITCH_MODEL_RESTORE',
    OverviewClose = 'OVERVIEW_CLOSE',
    OverviewCorpusInfoRequired = 'OVERVIEW_CORPUS_INFO_REQUIRED',
    OverviewShowCitationInfo = 'OVERVIEW_SHOW_CITATION_INFO',
    OverviewShowSubcorpusInfo = 'OVERVIEW_SHOW_SUBCORPUS_INFO',
    OverviewShowKeyShortcuts = 'OVERVIEW_SHOW_KEY_SHORTCUTS',
    ConcArgsUpdated = 'CONC_ARGS_UPDATED'
}

export interface CorpusSwitchModelRestorePayload {
    data:{[key:string]:any};
    corpora:Array<[string, string]>;
    changePrimaryCorpus?:boolean;
}

export namespace Actions {

    export interface MessageAdd extends Action<{
        messageType:Kontext.UserMessageTypes;
        message:any; // any is here intentionally - we just try to convert anything to a message
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
        changePrimaryCorpus?:boolean;
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

    export interface OverviewClose extends Action<{
    }> {
        name:ActionName.OverviewClose;
    }

    export interface OverviewCorpusInfoRequired extends Action<{
        corpusId:string;
    }> {
        name:ActionName.OverviewCorpusInfoRequired;
    }

    export interface OverviewShoActionwCitationInfo extends Action<{
        corpusId:string;
    }> {
        name:ActionName.OverviewShowCitationInfo;
    }

    export interface OverviewShowSubcorpusInfo extends Action<{
        corpusId:string;
        subcorpusId:string;
    }> {
        name:ActionName.OverviewShowSubcorpusInfo;
    }

    export interface OverviewShowKeyShortcuts extends Action<{
    }> {
        name:ActionName.OverviewShowKeyShortcuts;
    }

    export interface ConcArgsUpdated extends Action<{
        args:ConcServerArgs;
    }> {
        name:ActionName.ConcArgsUpdated;
    }

}