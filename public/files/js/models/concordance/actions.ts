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
import { AudioPlayerActions } from './common';

export enum ActionName {
    ChangeMainCorpus = 'CONCORDANCE_CHANGE_MAIN_CORPUS',
    ExpandKwicDetail = 'CONCORDANCE_EXPAND_KWIC_DETAIL',
    PlayAudioSegment = 'CONCORDANCE_PLAY_AUDIO_SEGMENT',
    AudioPlayerClickControl = 'AUDIO_PLAYER_CLICK_CONTROL',
    ChangePage = 'CONCORDANCE_CHANGE_PAGE',
    RevisitPage = 'CONCORDANCE_REVISIT_PAGE',
    AsyncCalculationUpdated = 'CONCORDANCE_ASYNC_CALCULATION_UPDATED'
}

export namespace Actions {

    export interface ChangeMainCorpus extends Action<{
        maincorp:string;
    }> {
        name:ActionName.ChangeMainCorpus;
    }

    export interface PlayAudioSegment extends Action<{
        chunksIds:Array<string>;
    }> {
        name:ActionName.PlayAudioSegment;
    }

    export interface AudioPlayerClickControl extends Action<{
        action:AudioPlayerActions;
    }> {
        name:ActionName.AudioPlayerClickControl;
    }

    export interface ChangePage extends Action<{
        action:string;
        pageNum:number;
    }> {
        name:ActionName.ChangePage;
    }

    export interface RevisitPage extends Action<{
        action:string;
        pageNum:number;
    }> {
        name:ActionName.RevisitPage;
    }

    export interface AsyncCalculationUpdated extends Action<{
        finished:number;
        concsize:number;
        fullsize:number;
        relconcsize:number;
        arf:number;
        availPages:number;
    }> {
        name:ActionName.AsyncCalculationUpdated;
    }

    export interface X extends Action<{
    }> {
        name:ActionName.X;
    }

    export interface X extends Action<{
    }> {
        name:ActionName.X;
    }

    export interface X extends Action<{
    }> {
        name:ActionName.X;
    }

    export interface ExpandKwicDetail extends Action<{
    }> {
        name:ActionName.ExpandKwicDetail;
    }
}