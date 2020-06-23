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
import { AudioPlayerActions, DetailExpandPositions } from './common';

export enum ActionName {
    ChangeMainCorpus = 'CONCORDANCE_CHANGE_MAIN_CORPUS',
    ExpandKwicDetail = 'CONCORDANCE_EXPAND_KWIC_DETAIL',
    PlayAudioSegment = 'CONCORDANCE_PLAY_AUDIO_SEGMENT',
    AudioPlayerClickControl = 'AUDIO_PLAYER_CLICK_CONTROL',
    ChangePage = 'CONCORDANCE_CHANGE_PAGE',
    RevisitPage = 'CONCORDANCE_REVISIT_PAGE',
    AsyncCalculationUpdated = 'CONCORDANCE_ASYNC_CALCULATION_UPDATED',
    AsyncCalculationFailed = 'CONCORDANCE_ASYNC_CALCULATION_FAILED',
    CalculateIpmForAdHocSubc = 'CONCORDANCE_CALCULATE_IPM_FOR_AD_HOC_SUBC',
    ChangeLangVisibility = 'CONCORDANCE_CHANGE_LANG_VISIBILITY',
    SwitchKwicSentMode = 'CONCORDANCE_SWITCH_KWIC_SENT_MODE',
    DataWaitTimeInc = 'CONCORDANCE_DATA_WAIT_TIME_INC',
    LoadTTDictOverview = 'CONCORDANCE_LOAD_TT_DIST_OVERVIEW',
    RemoveChartItemsLimit = 'CONCORDANCE_REMOVE_CHART_ITEMS_LIMIT',
    RestoreChartItemsLimit = 'CONCORDANCE_RESTORE_CHART_ITEMS_LIMIT',
    ShowKwicDetail = 'CONCORDANCE_SHOW_KWIC_DETAIL',
    ShowTokenDetail = 'CONCORDANCE_SHOW_TOKEN_DETAIL',
    ShowWholeDocument = 'CONCORDANCE_SHOW_WHOLE_DOCUMENT',
    ShowSpeechDetail = 'CONCORDANCE_SHOW_SPEECH_DETAIL',
    ExpandSpeechDetail = 'CONCORDANCE_EXPAND_SPEECH_DETAIL',
    DetailSwitchMode = 'CONCORDANCE_DETAIL_SWITCH_MODE',
    ResetDetail = 'CONCORDANCE_RESET_DETAIL',
    ShowRefDetail = 'CONCORDANCE_SHOW_REF_DETAIL',
    PlaySpeech = 'CONCORDANCE_PLAY_SPEECH',
    StopSpeech = 'CONCORDANCE_STOP_SPEECH',
    RefResetDetail = 'CONCORDANCE_REF_RESET_DETAIL'
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

    export interface AsyncCalculationFailed extends Action<{
    }> {
        name:ActionName.AsyncCalculationFailed;
    }

    export interface CalculateIpmForAdHocSubc extends Action<{
    }> {
        name:ActionName.CalculateIpmForAdHocSubc;
    }

    export interface ChangeLangVisibility extends Action<{
        corpusId:string;
        value:boolean;
    }> {
        name:ActionName.ChangeLangVisibility;
    }

    export interface SwitchKwicSentMode extends Action<{
    }> {
        name:ActionName.SwitchKwicSentMode;
    }

    export interface DataWaitTimeInc extends Action<{
    }> {
        name:ActionName.DataWaitTimeInc;
    }

    export interface ExpandKwicDetail extends Action<{
        position:DetailExpandPositions;
    }> {
        name:ActionName.ExpandKwicDetail;
    }

    export interface LoadTTDictOverview extends Action<{
    }> {
        name:ActionName.LoadTTDictOverview;
    }

    export interface RemoveChartItemsLimit extends Action<{
    }> {
        name:ActionName.RemoveChartItemsLimit;
    }

    export interface RestoreChartItemsLimit extends Action<{
    }> {
        name:ActionName.RestoreChartItemsLimit;
    }

    export interface ShowKwicDetail extends Action<{
        corpusId:string;
        tokenNumber:number;
        kwicLength:number;
        lineIdx:number;
    }> {
        name:ActionName.ShowKwicDetail;
    }

    export interface ShowTokenDetail extends Action<{
        corpusId:string;
        tokenNumber:number;
        lineIdx:number;
    }> {
        name:ActionName.ShowTokenDetail;
    }

    export interface ShowWholeDocument extends Action<{
    }> {
        name:ActionName.ShowWholeDocument;
    }

    export interface ShowSpeechDetail extends Action<{
        corpusId:string;
        tokenNumber:number;
        kwicLength:number;
        lineIdx:number;
    }> {
        name:ActionName.ShowSpeechDetail;
    }

    export interface ExpandSpeechDetail extends Action<{
        position:DetailExpandPositions;
    }> {
        name:ActionName.ExpandSpeechDetail;
    }

    export interface DetailSwitchMode extends Action<{
        value:string; // TODO more specific types here
    }> {
        name:ActionName.DetailSwitchMode;
    }

    export interface ResetDetail extends Action<{
    }> {
        name:ActionName.ResetDetail;
    }

    export interface ShowRefDetail extends Action<{
        corpusId:string;
        tokenNumber:number;
        lineIdx:number;
    }> {
        name:ActionName.ShowRefDetail;
    }

    export interface PlaySpeech extends Action<{
        rowIdx:number;
        segments:Array<string>;
    }> {
        name:ActionName.PlaySpeech;
    }

    export interface StopSpeech extends Action<{
    }> {
        name:ActionName.StopSpeech;
    }

    export interface RefResetDetail extends Action<{
    }> {
        name:ActionName.RefResetDetail;
    }
}