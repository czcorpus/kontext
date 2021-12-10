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
import * as TextTypes from '../../types/textTypes';
import { DataSaveFormat } from '../../app/navigation/save';


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


export class Actions {

    static AddedNewOperation:Action<{
        concId:string;
        data:AjaxConcResponse;
        changeMaincorp?:string;
    }> = {
        name: 'CONCORDANCE_ADDED_NEW_OPERATION'
    };

    static ChangeMainCorpus:Action<{
        maincorp:string;
    }> = {
        name: 'CONCORDANCE_CHANGE_MAIN_CORPUS'
    };

    static ExpandKwicDetail:Action<{
        position:DetailExpandPositions;
    }> = {
        name: 'CONCORDANCE_EXPAND_KWIC_DETAIL'
    };

    static PlayAudioSegment:Action<{
        chunksIds:Array<string>;
    }> = {
        name: 'CONCORDANCE_PLAY_AUDIO_SEGMENT'
    };

    static AudioPlayerClickControl:Action<{
        playerId:string;
        action:AudioPlayerActions;
    }> = {
        name: 'AUDIO_PLAYER_CLICK_CONTROL'
    };

    static AudioPlayerSetPosition:Action<{
        playerId:string;
        offset:number;
    }> = {
        name: 'AUDIO_PLAYER_SET_POSITION'
    };

    static AudioPlayersStop:Action<{}> = {
        name: 'AUDIO_PLAYERS_STOP'
    };

    static ChangePage:Action<{
        action:PaginationActions;
        pageNum:number;
        isPopState?:boolean;
    }> = {
        name: 'CONCORDANCE_CHANGE_PAGE'
    };

    static isChangePage(a:Action):a is typeof Actions.ChangePage {
        return a.name === Actions.ChangePage.name;
    }

    static ReloadConc:Action<{
        concId:string;
        isPopState?:boolean;
    }> = {
        name: 'CONCORDANCE_RELOAD_CONC'
    };

    static isReloadConc(a:Action):a is typeof Actions.ReloadConc {
        return a.name === Actions.ReloadConc.name;
    }

    static AsyncCalculationUpdated:Action<{
        finished:boolean;
        concsize:number;
        fullsize:number;
        relconcsize:number;
        arf:number;
        availPages:number;
    }> = {
        name: 'CONCORDANCE_ASYNC_CALCULATION_UPDATED'
    };

    static ConcordanceRecalculationReady:Action<{
        concSize:number;
        overviewMinFreq:number;
    }> = {
        name: 'CONCORDANCE_RECALCULATION_READY'
    };

    static isConcordanceRecalculationReady(a:Action):a is typeof Actions.ConcordanceRecalculationReady {
        return a.name === Actions.ConcordanceRecalculationReady.name;
    }


    static AsyncCalculationFailed:Action<{}> = {
        name: 'CONCORDANCE_ASYNC_CALCULATION_FAILED'
    };

    static CalculateIpmForAdHocSubc:Action<{}> = {
        name: 'CONCORDANCE_CALCULATE_IPM_FOR_AD_HOC_SUBC'
    };

    static CalculateIpmForAdHocSubcReady:Action<{
        ttSelection:TextTypes.ExportedSelection;
    }> = {
        name: 'CONCORDANCE_CALCULATE_IPM_FOR_AD_HOC_SUBC_READY'
    };

    static CalculateIpmForAdHocSubcDone:Action<{
        ipm:number;
    }> = {
        name: 'CONCORDANCE_CALCULATE_IPM_FOR_AD_HOC_SUBC_DONE'
    };

    static ChangeLangVisibility:Action<{
        corpusId:string;
        value:boolean;
    }> = {
        name: 'CONCORDANCE_CHANGE_LANG_VISIBILITY'
    };

    static SwitchKwicSentMode:Action<{}> = {
        name: 'CONCORDANCE_SWITCH_KWIC_SENT_MODE'
    };

    static DataWaitTimeInc:Action<{
        idx:number;
    }> = {
        name: 'CONCORDANCE_DATA_WAIT_TIME_INC'
    };

    static LoadTTDictOverview:Action<{}> = {
        name: 'CONCORDANCE_LOAD_TT_DIST_OVERVIEW'
    };

    static RemoveChartItemsLimit:Action<{}> = {
        name: 'CONCORDANCE_REMOVE_CHART_ITEMS_LIMIT'
    };

    static RestoreChartItemsLimit:Action<{}> = {
        name: 'CONCORDANCE_RESTORE_CHART_ITEMS_LIMIT'
    };

    static ShowKwicDetail:Action<{
        corpusId:string;
        tokenNumber:number;
        kwicLength:number;
        lineIdx:number;
    }> = {
        name: 'CONCORDANCE_SHOW_KWIC_DETAIL'
    };

    static ShowTokenDetail:Action<{
        corpusId:string;
        tokenNumber:number;
        lineIdx:number;
    }> = {
        name: 'CONCORDANCE_SHOW_TOKEN_DETAIL'
    };

    static ShowWholeDocument:Action<{}> = {
        name: 'CONCORDANCE_SHOW_WHOLE_DOCUMENT'
    };

    static ShowSpeechDetail:Action<{
        corpusId:string;
        tokenNumber:number;
        kwicLength:number;
        lineIdx:number;
    }> = {
        name: 'CONCORDANCE_SHOW_SPEECH_DETAIL'
    };

    static ExpandSpeechDetail:Action<{
        position:DetailExpandPositions;
    }> = {
        name: 'CONCORDANCE_EXPAND_SPEECH_DETAIL'
    };

    static DetailSwitchMode:Action<{
        value:string; // TODO more specific types here
    }> = {
        name: 'CONCORDANCE_DETAIL_SWITCH_MODE'
    };

    static ResetDetail:Action<{}> = {
        name: 'CONCORDANCE_RESET_DETAIL'
    };

    static ShowRefDetail:Action<{
        corpusId:string;
        tokenNumber:number;
        lineIdx:number;
    }> = {
        name: 'CONCORDANCE_SHOW_REF_DETAIL'
    };

    static ShowRefDetailDone:Action<{
        data:Array<[RefsColumn, RefsColumn]>;
        lineIdx:number;
    }> = {
        name: 'CONCORDANCE_SHOW_REF_DETAIL_DONE'
    };

    static PlaySpeech:Action<{
        rowIdx: number;
        segments: Array<string>;
    }> = {
        name: 'CONCORDANCE_PLAY_SPEECH'
    };

    static RefResetDetail:Action<{}> = {
        name: 'CONCORDANCE_REF_RESET_DETAIL'
    };

    static SaveFormSubmit:Action<{}> = {
        name: 'CONCORDANCE_SAVE_FORM_SUBMIT'
    };

    static SaveFormSetHeading:Action<{
        value:boolean;
    }> = {
        name: 'CONCORDANCE_SAVE_FORM_SET_HEADING'
    };

    static SaveFormSetAlignKwic:Action<{
        value:boolean;
    }> = {
        name: 'CONCORDANCE_SAVE_FORM_SET_ALIGN_KWIC'
    };

    static SaveFormSetFromLine:Action<{
        value:string;
    }> = {
        name: 'CONCORDANCE_SAVE_FORM_SET_FROM_LINE'
    };

    static SaveFormSetToLine:Action<{
        value:string;
    }> = {
        name: 'CONCORDANCE_SAVE_FORM_SET_TO_LINE'
    };

    static SaveFormSetInclLineNumbers:Action<{
        value:boolean;
    }> = {
        name: 'CONCORDANCE_SAVE_FORM_SET_INCL_LINE_NUMBERS'
    };

    static SaveFormSetFormat:Action<{
        value:DataSaveFormat;
    }> = {
        name: 'CONCORDANCE_SAVE_FORM_SET_FORMAT'
    };

    static ResultCloseSaveForm:Action<{}> = {
        name: 'CONCORDANCE_RESULT_CLOSE_SAVE_FORM'
    };

    static SelectLine:Action<{
        value:number;
        tokenNumber:number;
        kwicLength:number;
    }> = {
        name: 'LINE_SELECTION_SELECT_LINE'
    };

    static RemoveSelectedLines:Action<{}> = {
        name: 'LINE_SELECTION_REMOVE_LINES'
    };

    static RemoveNonSelectedLines:Action<{}> = {
        name: 'LINE_SELECTION_REMOVE_OTHER_LINES'
    };

    static MarkLines:Action<{}> = {
        name: 'LINE_SELECTION_MARK_LINES'
    };

    static MarkLinesDone:Action<{
        data:AjaxConcResponse;
        groupIds:Array<LineGroupId>;
    }> = {
        name: 'LINE_SELECTION_MARK_LINES_DONE'
    };

    static RemoveLinesNotInGroups:Action<{}> = {
        name: 'LINE_SELECTION_REMOVE_NON_GROUP_LINES'
    };

    static RenameSelectionGroup:Action<{
        srcGroupNum:number;
        dstGroupNum:number;
    }> = {
        name: 'LINE_SELECTION_GROUP_RENAME'
    };

    static RenameSelectionGroupDone:Action<{
        concId:string;
        numLinesInGroups:number;
        lineGroupIds:Array<LineGroupId>;
        prevId:number;
        newId:number;
    }> = {
        name: 'LINE_SELECTION_GROUP_RENAME_DONE'
    };

    static ChangeEmail:Action<{
        email:string;
    }> = {name: 'LINE_SELECTION_CHANGE_EMAIL'};

    static ClearUserCredentials:Action<{}> = {
        name: 'LINE_SELECTION_CLEAR_USER_CREDENTIALS'
    };

    static ToggleLineSelOptions:Action<{}> = {
        name: 'CONCORDANCE_TOGGLE_LINE_SEL_OPTIONS'
    };

    static SendLineSelectionToEmail:Action<{
        email:string;
    }> = {
        name: 'LINE_SELECTION_SEND_URL_TO_EMAIL'
    };

    static SendLineSelectionToEmailDone:Action<{}> = {
        name: 'LINE_SELECTION_SEND_URL_TO_EMAIL_DONE'
    };

    static SortLineSelection:Action<{}> = {
        name: 'LINE_SELECTION_SORT_LINES'
    };

    static SetLineSelectionMode:Action<{
        mode:LineSelectionModes;
    }> = {
        name: 'CONCORDANCE_SET_LINE_SELECTION_MODE'
    };

    static UnlockLineSelection:Action<{}> = {
        name: 'LINE_SELECTION_REENABLE_EDIT'
    };

    static UnlockLineSelectionDone:Action<{
        selection:Array<LineSelValue>;
        queryId:string;
        mode:LineSelectionModes;
    }> = {
        name: 'LINE_SELECTION_REENABLE_EDIT_DONE'
    };

    static LineSelectionReset:Action<{}> = {
        name: 'LINE_SELECTION_RESET'
    };

    static LineSelectionResetOnServer:Action<{}> = {
        name: 'LINE_SELECTION_RESET_ON_SERVER'
    };

    static LineSelectionResetOnServerDone:Action<{}> = {
        name: 'LINE_SELECTION_RESET_ON_SERVER_DONE'
    };

    static SaveLineSelection:Action<{}> = {
        name: 'LINE_SELECTION_SAVE'
    };

    static ApplyStoredLineSelections:Action<{}> = {
        name: 'CONCORDANCE_APPLY_STORED_LINE_SELECTIONS'
    };

    static ApplyStoredLineSelectionsDone:Action<{
        selections:Array<LineSelValue>;
        mode:LineSelectionModes;
    }> = {
        name: 'CONCORDANCE_APPLY_STORED_LINE_SELECTIONS_DONE'
    };

    static PublishStoredLineSelections:Action<{
        selections:Array<LineSelValue>;
        mode:LineSelectionModes;
    }> = {
        name: 'CONCORDANCE_PUBLISH_STORED_LINE_SELECTIONS'
    };

    static ToggleLineGroupRenameForm:Action<{}> = {
        name: 'LINE_SELECTION_TOGGLE_LINE_GROUP_RENAME'
    };

    static MakeConcPermanent:Action<{
        revoke:boolean;
    }> = {
        name: 'QUERY_MAKE_CONCORDANCE_PERMANENT'
    };

    static GetConcArchiveStatus:Action<{}> = {
        name: 'QUERY_GET_CONC_ARCHIVED_STATUS'
    };

    static ShowSyntaxView:Action<{
        sentenceTokens:Array<{corpus:string; tokenId:number; kwicLength:number}>;
        targetHTMLElementID:string;
    }> = {
        name: 'SHOW_SYNTAX_VIEW'
    };

    static CloseSyntaxView:Action<{}> = {
        name: 'CLOSE_SYNTAX_VIEW'
    };

    static HideAnonymousUserWarning:Action<{}> = {
        name: 'CONCORDANCE_HIDE_ANONYMOUS_USER_WARNING'
    };

    static DashboardMinimizeExtInfo:Action<{}> = {
        name: 'DASHBOARD_MINIMIZE_EXTENDED_INFO'
    };

    static DashboardMaximizeExtInfo:Action<{}> = {
        name: 'DASHBOARD_MAXIMIZE_EXTENDED_INFO'
    };

    static DashboardToggleExtInfo:Action<{}> = {
        name: 'DASHBOARD_TOGGLE_EXTENDED_INFO'
    };
}
