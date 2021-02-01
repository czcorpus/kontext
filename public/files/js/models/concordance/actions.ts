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
import { AudioPlayerActions, DetailExpandPositions, LineSelectionModes, LineSelValue,
    AjaxConcResponse, LineGroupId, RefsColumn, PaginationActions } from './common';
import { SaveData } from '../../app/navigation';
import { TextTypes } from '../../types/common';

export enum ActionName {
    AddedNewOperation = 'CONCORDANCE_ADDED_NEW_OPERATION',
    ChangeMainCorpus = 'CONCORDANCE_CHANGE_MAIN_CORPUS',
    ExpandKwicDetail = 'CONCORDANCE_EXPAND_KWIC_DETAIL',
    PlayAudioSegment = 'CONCORDANCE_PLAY_AUDIO_SEGMENT',
    AudioPlayerClickControl = 'AUDIO_PLAYER_CLICK_CONTROL',
    ChangePage = 'CONCORDANCE_CHANGE_PAGE',
    ReloadConc = 'CONCORDANCE_REVISIT_PAGE',
    AsyncCalculationUpdated = 'CONCORDANCE_ASYNC_CALCULATION_UPDATED',
    AsyncCalculationFailed = 'CONCORDANCE_ASYNC_CALCULATION_FAILED',
    CalculateIpmForAdHocSubc = 'CONCORDANCE_CALCULATE_IPM_FOR_AD_HOC_SUBC',
    CalculateIpmForAdHocSubcReady = 'CONCORDANCE_CALCULATE_IPM_FOR_AD_HOC_SUBC_READY',
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
    ShowRefDetailDone = 'CONCORDANCE_SHOW_REF_DETAIL_DONE',
    PlaySpeech = 'CONCORDANCE_PLAY_SPEECH',
    StopSpeech = 'CONCORDANCE_STOP_SPEECH',
    RefResetDetail = 'CONCORDANCE_REF_RESET_DETAIL',
    SaveFormSubmit = 'CONCORDANCE_SAVE_FORM_SUBMIT',
    SaveFormSetHeading = 'CONCORDANCE_SAVE_FORM_SET_HEADING',
    SaveFormSetAlignKwic = 'CONCORDANCE_SAVE_FORM_SET_ALIGN_KWIC',
    SaveFormSetFromLine = 'CONCORDANCE_SAVE_FORM_SET_FROM_LINE',
    SaveFormSetToLine = 'CONCORDANCE_SAVE_FORM_SET_TO_LINE',
    SaveFormSetInclLineNumbers = 'CONCORDANCE_SAVE_FORM_SET_INCL_LINE_NUMBERS',
    SaveFormSetFormat = 'CONCORDANCE_SAVE_FORM_SET_FORMAT',
    ResultCloseSaveForm =  'CONCORDANCE_RESULT_CLOSE_SAVE_FORM',
    SelectLine = 'LINE_SELECTION_SELECT_LINE',
    RemoveSelectedLines = 'LINE_SELECTION_REMOVE_LINES',
    RemoveNonSelectedLines = 'LINE_SELECTION_REMOVE_OTHER_LINES',
    MarkLines = 'LINE_SELECTION_MARK_LINES',
    MarkLinesDone = 'LINE_SELECTION_MARK_LINES_DONE',
    RemoveLinesNotInGroups = 'LINE_SELECTION_REMOVE_NON_GROUP_LINES',
    RenameSelectionGroup = 'LINE_SELECTION_GROUP_RENAME',
    RenameSelectionGroupDone = 'LINE_SELECTION_GROUP_RENAME_DONE',
    ChangeEmail = 'LINE_SELECTION_CHANGE_EMAIL',
    ClearUserCredentials = 'LINE_SELECTION_CLEAR_USER_CREDENTIALS',
    ToggleLineSelOptions = 'CONCORDANCE_TOGGLE_LINE_SEL_OPTIONS',
    SendLineSelectionToEmail = 'LINE_SELECTION_SEND_URL_TO_EMAIL',
    SendLineSelectionToEmailDone = 'LINE_SELECTION_SEND_URL_TO_EMAIL_DONE',
    SortLineSelection = 'LINE_SELECTION_SORT_LINES',
    SetLineSelectionMode = 'CONCORDANCE_SET_LINE_SELECTION_MODE',
    UnlockLineSelection = 'LINE_SELECTION_REENABLE_EDIT',
    UnlockLineSelectionDone = 'LINE_SELECTION_REENABLE_EDIT_DONE',
    LineSelectionReset = 'LINE_SELECTION_RESET',
    LineSelectionResetOnServer = 'LINE_SELECTION_RESET_ON_SERVER',
    LineSelectionResetOnServerDone = 'LINE_SELECTION_RESET_ON_SERVER_DONE',
    SaveLineSelection = 'LINE_SELECTION_SAVE',
    ApplyStoredLineSelections = 'CONCORDANCE_APPLY_STORED_LINE_SELECTIONS',
    ApplyStoredLineSelectionsDone = 'CONCORDANCE_APPLY_STORED_LINE_SELECTIONS_DONE',
    PublishStoredLineSelections = 'CONCORDANCE_PUBLISH_STORED_LINE_SELECTIONS',
    ToggleLineGroupRenameForm = 'LINE_SELECTION_TOGGLE_LINE_GROUP_RENAME',
    MakeConcPermanent = 'QUERY_MAKE_CONCORDANCE_PERMANENT',
    GetConcArchiveStatus = 'QUERY_GET_CONC_ARCHIVED_STATUS',
    ShowSyntaxView = 'SHOW_SYNTAX_VIEW',
    CloseSyntaxView = 'CLOSE_SYNTAX_VIEW',
    HideAnonymousUserWarning = 'CONCORDANCE_HIDE_ANONYMOUS_USER_WARNING',
    DashboardMinimizeExtInfo = 'DASHBOARD_MINIMIZE_EXTENDED_INFO',
    DashboardMaximizeExtInfo = 'DASHBOARD_MAXIMIZE_EXTENDED_INFO',
    DashboardToggleExtInfo = 'DASHBOARD_TOGGLE_EXTENDED_INFO'
}

export interface ConcGroupChangePayload {
    concId:string;
    numLinesInGroups:number;
    lineGroupIds:Array<LineGroupId>;
    prevId:number;
    newId:number;
}

export interface PublishLineSelectionPayload {
    selections:Array<LineSelValue>;
    mode:LineSelectionModes;
}

export namespace Actions {

    export interface AddedNewOperation extends Action<{
        concId:string;
        data:AjaxConcResponse;
        changeMaincorp?:string;
    }> {
        name:ActionName.AddedNewOperation;
    }

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
        action:PaginationActions;
        pageNum:number;
        isPopState?:boolean;
    }> {
        name:ActionName.ChangePage;
    }

    export function isChangePage(a:Action):a is ChangePage {
        return a.name === ActionName.ChangePage;
    }

    export interface ReloadConc extends Action<{
        concId:string;
        isPopState?:boolean;
    }> {
        name:ActionName.ReloadConc;
    }

    export function isReloadConc(a:Action):a is ReloadConc {
        return a.name === ActionName.ReloadConc;
    }

    export interface AsyncCalculationUpdated extends Action<{
        finished:boolean;
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

    export interface CalculateIpmForAdHocSubcReady extends Action<{
        ttSelection:TextTypes.ExportedSelection;
    }> {
        name:ActionName.CalculateIpmForAdHocSubcReady;
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
        idx:number;
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

    export interface ShowRefDetailDone extends Action<{
        data:Array<[RefsColumn, RefsColumn]>;
        lineIdx:number;
    }> {
        name:ActionName.ShowRefDetailDone;
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

    export interface SaveFormSubmit extends Action<{
    }> {
        name:ActionName.SaveFormSubmit;
    }

    export interface SaveFormSetFormat extends Action<{
        value:SaveData.Format;
    }> {
        name:ActionName.SaveFormSetFormat;
    }

    export interface SaveFormSetHeading extends Action<{
        value:boolean;
    }> {
        name:ActionName.SaveFormSetHeading;
    }

    export interface SaveFormSetInclLineNumbers extends Action<{
        value:boolean;
    }> {
        name:ActionName.SaveFormSetInclLineNumbers;
    }

    export interface SaveFormSetAlignKwic extends Action<{
        value:boolean;
    }> {
        name:ActionName.SaveFormSetAlignKwic;
    }

    export interface SaveFormSetFromLine extends Action<{
        value:string;
    }> {
        name:ActionName.SaveFormSetFromLine;
    }

    export interface SaveFormSetToLine extends Action<{
        value:string;
    }> {
        name:ActionName.SaveFormSetToLine;
    }

    export interface ResultCloseSaveForm extends Action<{
    }> {
        name:ActionName.ResultCloseSaveForm;
    }

    export interface SelectLines extends Action<{
        value:number;
        tokenNumber:number;
        kwicLength:number;
    }> {
        name:ActionName.SelectLine;
    }

    export interface RemoveSelectedLines extends Action<{
    }> {
        name:ActionName.RemoveSelectedLines;
    }

    export interface RemoveNonSelectedLines extends Action<{
    }> {
        name:ActionName.RemoveNonSelectedLines;
    }

    export interface MarkLines extends Action<{
    }> {
        name:ActionName.MarkLines;
    }

    export interface MarkLinesDone extends Action<{
        data:AjaxConcResponse;
        groupIds:Array<LineGroupId>;
    }> {
        name:ActionName.MarkLinesDone;
    }

    export interface RemoveLinesNotInGroups extends Action<{
    }> {
        name:ActionName.RemoveLinesNotInGroups;
    }

    export interface RenameSelectionGroup extends Action<{
        srcGroupNum:number;
        dstGroupNum:number;
    }> {
        name:ActionName.RenameSelectionGroup;
    }

    export interface RenameSelectionGroupDone extends Action<ConcGroupChangePayload> {
        name:ActionName.RenameSelectionGroupDone;
    }

    export interface ChangeEmail extends Action<{
        email:string;
    }> {
        name:ActionName.ChangeEmail;
    }

    export interface ClearUserCredentials extends Action<{
    }> {
        name:ActionName.ClearUserCredentials;
    }

    export interface ToggleLineSelOptions extends Action<{
    }> {
        name:ActionName.ToggleLineSelOptions;
    }

    export interface LineSelectionReset extends Action<{
    }> {
        name:ActionName.LineSelectionReset;
    }

    export interface LineSelectionResetOnServer extends Action<{
    }> {
        name:ActionName.LineSelectionResetOnServer;
    }

    export interface LineSelectionResetOnServerDone extends Action<{
    }> {
        name:ActionName.LineSelectionResetOnServerDone;
    }

    export interface UnlockLineSelection extends Action<{
    }> {
        name:ActionName.UnlockLineSelection;
    }

    export interface UnlockLineSelectionDone extends Action<{
        selection:Array<LineSelValue>;
        query:Array<string>;
        mode:LineSelectionModes;

    }> {
        name:ActionName.UnlockLineSelectionDone;
    }

    export interface SendLineSelectionToEmail extends Action<{
        email:string;
    }> {
        name:ActionName.SendLineSelectionToEmail;
    }

    export interface SendLineSelectionToEmailDone extends Action<{
    }> {
        name:ActionName.SendLineSelectionToEmailDone;
    }

    export interface SortLineSelection extends Action<{
    }> {
        name:ActionName.SortLineSelection;
    }

    export interface SetLineSelectionMode extends Action<{
        mode:LineSelectionModes;
    }> {
        name:ActionName.SetLineSelectionMode;
    }

    export interface SaveLineSelection extends Action<{
    }> {
        name:ActionName.SaveLineSelection;
    }

    export interface ApplyStoredLineSelections extends Action<{
    }> {
        name:ActionName.ApplyStoredLineSelections;
    }

    export interface ApplyStoredLineSelectionsDone extends Action<PublishLineSelectionPayload> {
        name:ActionName.ApplyStoredLineSelectionsDone;
    }

    export interface PublishStoredLineSelections extends Action<PublishLineSelectionPayload> {
        name:ActionName.PublishStoredLineSelections;
    }

    export interface ToggleLineGroupRenameForm extends Action<{
    }> {
        name:ActionName.ToggleLineGroupRenameForm;
    }

    export interface MakeConcPermanent extends Action<{
        revoke:boolean;
    }> {
        name:ActionName.MakeConcPermanent;
    }

    export interface GetConcArchiveStatus extends Action<{
    }> {
        name:ActionName.GetConcArchiveStatus;
    }

    export interface ShowSyntaxView extends Action<{
        tokenNumber:number;
        kwicLength:number;
        targetHTMLElementID:string;
    }> {
        name:ActionName.ShowSyntaxView;
    }

    export interface CloseSyntaxView extends Action<{
    }> {
        name:ActionName.CloseSyntaxView;
    }

    export interface HideAnonymousUserWarning extends Action<{
    }> {
        name:ActionName.HideAnonymousUserWarning;
    }

    export interface DashboardMinimizeExtInfo extends Action<{
    }> {
        name:ActionName.DashboardMinimizeExtInfo;
    }

    export interface DashboardMaximizeExtInfo extends Action<{
    }> {
        name:ActionName.DashboardMaximizeExtInfo;
    }

    export interface DashboardToggleExtInfo extends Action<{
    }> {
        name:ActionName.DashboardToggleExtInfo;
    }

}