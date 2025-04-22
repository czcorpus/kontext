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

import * as React from 'react';
import * as Kontext from '../types/kontext.js';
import * as S from './query/style.js';
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { Keyboard, List, pipe, tuple } from 'cnc-tskit';

import { QueryFormModelState } from '../models/query/common.js';
import { QueryFormModel } from '../models/query/common.js';
import { Actions, QueryFormType } from '../models/query/actions.js';
import { ContentEditable } from './query/contentEditable.js';
import { AdvancedQuery, findTokenIdxBySuggFocusIdx, SimpleQuery, strictEqualParsedQueries } from '../models/query/query.js';
import { PqueryFormModel } from '../models/pquery/form.js';


export interface CQLEditorProps {
    formType:QueryFormType;
    sourceId:string;
    corpname:string;
    hasFocus:boolean;
    hasHistoryWidget:boolean;
    historyIsVisible:boolean;
    isSingleInstance:boolean;
    minHeightEm?:number;
    onReqHistory:()=>void;
    onEsc:()=>void;
}

export interface CQLEditorFallbackProps {
    formType:QueryFormType;
    sourceId:string;
    hasHistoryWidget:boolean;
    historyIsVisible:boolean;
    isSingleInstance:boolean;
    minHeightEm?:number;
    onReqHistory:()=>void;
    onEsc:()=>void;
}

export interface CQLEditorViews {
    CQLEditorFallback:React.ComponentClass;
    CQLEditor:React.ComponentClass;
}

interface CQLEditorCoreState {
    queries:{[sourceId:string]:AdvancedQuery|SimpleQuery}|unknown; // pquery block -> query
    downArrowTriggersHistory:{[sourceId:string]:boolean};
    cqlEditorMessages:{[sourceId:string]:Array<string>};
    compositionModeOn:boolean;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            queryModel:QueryFormModel<QueryFormModelState>|PqueryFormModel) {


    // ------------------- <CQLEditorFallback /> -----------------------------

    class CQLEditorFallback extends React.PureComponent<CQLEditorFallbackProps &
            QueryFormModelState> {

        private inputRef:React.RefObject<HTMLTextAreaElement>;

        constructor(props) {
            super(props);
            this.handleKeyDown = this.handleKeyDown.bind(this);
            this.inputKeyUpHandler = this.inputKeyUpHandler.bind(this);
            this.handleInputChange = this.handleInputChange.bind(this);
            this.inputRef = React.createRef();
        }

        private inputKeyUpHandler(evt) {
            if (Keyboard.isArrowKey(evt.keyCode) || evt.key === Keyboard.Value.HOME ||
                    evt.key === Keyboard.Value.END) {
                dispatcher.dispatch<typeof Actions.QueryInputMoveCursor>({
                    name: Actions.QueryInputMoveCursor.name,
                    payload: {
                        formType: this.props.formType,
                        sourceId: this.props.sourceId,
                        rawAnchorIdx: this.inputRef.current.selectionStart,
                        rawFocusIdx: this.inputRef.current.selectionEnd
                    }
                });
            }
        }

        private handleKeyDown(evt) {
            if (evt.key === Keyboard.Value.DOWN_ARROW &&
                    this.props.hasHistoryWidget &&
                    this.props.downArrowTriggersHistory &&
                    !this.props.historyIsVisible) {
                this.props.onReqHistory();

            } else if (evt.key === Keyboard.Value.ESC) {
                this.props.onEsc();
            }
        }

        private handleInputChange(evt:React.ChangeEvent<HTMLTextAreaElement>) {
            dispatcher.dispatch<typeof Actions.QueryInputSetQuery>({
                name: Actions.QueryInputSetQuery.name,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    query: evt.target.value,
                    rawAnchorIdx: this.inputRef.current.selectionStart,
                    rawFocusIdx: this.inputRef.current.selectionEnd,
                    insertRange: null
                }
            });
        }

        render():React.ReactElement<{}> {
            return <textarea className="cql-input" rows={2} cols={60} name="cql"
                                ref={this.inputRef}
                                value={this.props.queries[this.props.sourceId].query}
                                onChange={this.handleInputChange}
                                onKeyDown={this.handleKeyDown}
                                onKeyUp={this.inputKeyUpHandler}
                                spellCheck={false}
                                style={this.props.minHeightEm ?
                                    { minHeight: `${this.props.minHeightEm}em` } : null} />;
        }
    }

    // ------------------- <CQLEditor /> -----------------------------

    class CQLEditor extends React.PureComponent<(CQLEditorProps & CQLEditorCoreState)> {

        private inputRef:React.RefObject<HTMLPreElement>;

        private readonly contentEditable:ContentEditable<HTMLPreElement>;

        constructor(props) {
            super(props);
            this.handleEditorClick = this.handleEditorClick.bind(this);
            this.inputKeyUpHandler = this.inputKeyUpHandler.bind(this);
            this.inputKeyDownHandler = this.inputKeyDownHandler.bind(this);
            this.ffKeyDownHandler = this.ffKeyDownHandler.bind(this);
            this.handleSelect = this.handleSelect.bind(this);
            this.handleCompositionStart = this.handleCompositionStart.bind(this);
            this.handleCompositionEnd = this.handleCompositionEnd.bind(this);
            this.handleInputFocus = this.handleInputFocus.bind(this);
            this.inputRef = React.createRef();
            this.contentEditable = new ContentEditable<HTMLPreElement>(this.inputRef);
        }

        private newInputDispatch() {
            const [rawAnchorIdx, rawFocusIdx] = this.contentEditable.getRawSelection();
            const query = this.contentEditable.extractText();

            dispatcher.dispatch<typeof Actions.QueryInputSetQuery>({
                name: Actions.QueryInputSetQuery.name,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    query: query,
                    rawAnchorIdx,
                    rawFocusIdx,
                    insertRange: null
                }
            });
        }

        private handleInputFocus() {
            if (!this.props.isSingleInstance) {
                dispatcher.dispatch(
                    Actions.QueryInputSetFocusInput,
                    {
                        corpname: this.props.sourceId
                    }
                );
            }
        }

        private handleInputChange() {
            if (!this.props.compositionModeOn) {
                this.newInputDispatch();
            }
        }

        private handleCompositionStart() {
            dispatcher.dispatch<typeof Actions.SetCompositionMode>({
                name: Actions.SetCompositionMode.name,
                payload: {
                    formType: this.props.formType,
                    status: true
                }
            });
        }

        private handleCompositionEnd() {
            dispatcher.dispatch<typeof Actions.SetCompositionMode>({
                name: Actions.SetCompositionMode.name,
                payload: {
                    formType: this.props.formType,
                    status: false
                }
            });
            // Chrome performs onCompositionEnd action after inputChange
            // we have to dispatch new state here
            this.newInputDispatch();
        }

        private findLinkParent(elm:HTMLElement):HTMLElement {
            let curr = elm;
            while (curr !== this.inputRef.current) {
                if (curr.nodeName === 'A') {
                    return curr;
                }
                curr = curr.parentElement;
            }
            return null;
        }

        private handleEditorClick(evt:React.MouseEvent<{}>) {
            const a = this.findLinkParent(evt.target as HTMLElement);
            if (a !== null && evt.ctrlKey) {
                switch (a.getAttribute('data-type')) {
                    case 'tag':
                        const leftIdx = parseInt(a.getAttribute('data-leftIdx'));
                        const rightIdx = parseInt(a.getAttribute('data-rightIdx'));
                        const queryObj = this.props.queries[this.props.sourceId];
                        dispatcher.dispatch<typeof Actions.SetActiveInputWidget>({
                            name: Actions.SetActiveInputWidget.name,
                            payload: {
                                formType: this.props.formType,
                                sourceId: this.props.sourceId,
                                corpname: this.props.corpname,
                                currQuery: queryObj.query,
                                value: 'tag',
                                appliedQueryRange: tuple(
                                    leftIdx, rightIdx
                                )
                            }
                        });
                    break;
                    case 'sugg': {
                        const leftIdx = parseInt(a.getAttribute('data-leftIdx'));
                        const queryObj = this.props.queries[this.props.sourceId];
                        if (queryObj.qtype === 'advanced') {
                            const tokenIdx = findTokenIdxBySuggFocusIdx(queryObj, leftIdx);
                            dispatcher.dispatch<typeof Actions.ToggleQuerySuggestionWidget>({
                                name: Actions.ToggleQuerySuggestionWidget.name,
                                payload: {
                                    formType: this.props.formType,
                                    sourceId: this.props.sourceId,
                                    tokenIdx: tokenIdx
                                }
                            });
                        }
                    }
                    break;
                }

            } else {
                const [rawAnchorIdx, rawFocusIdx] = this.contentEditable.getRawSelection();
                dispatcher.dispatch<typeof Actions.QueryInputMoveCursor>({
                    name: Actions.QueryInputMoveCursor.name,
                    payload: {
                        formType: this.props.formType,
                        sourceId: this.props.sourceId,
                        rawAnchorIdx,
                        rawFocusIdx
                    }
                });
            }
        }

        private inputKeyUpHandler(evt:React.KeyboardEvent) {
            if (Keyboard.isArrowKey(evt.keyCode) || evt.key === Keyboard.Value.HOME ||
                    evt.key === Keyboard.Value.END) {
                const [anchorIdx, focusIdx] = this.contentEditable.getRawSelection();
                dispatcher.dispatch<typeof Actions.QueryInputMoveCursor>({
                    name: Actions.QueryInputMoveCursor.name,
                    payload: {
                        formType: this.props.formType,
                        sourceId: this.props.sourceId,
                        rawAnchorIdx: anchorIdx,
                        rawFocusIdx: focusIdx
                    }
                });
            }
        }

        private inputKeyDownHandler(evt:React.KeyboardEvent) {
            if (evt.key === Keyboard.Value.DOWN_ARROW &&
                    this.props.hasHistoryWidget &&
                    this.props.downArrowTriggersHistory[this.props.sourceId] &&
                    !this.props.historyIsVisible) {
                this.props.onReqHistory();

            } else if (evt.key === Keyboard.Value.ESC) {
                this.props.onEsc();
            }
        }

        private ffKeyDownHandler(evt:KeyboardEvent) {
            this.contentEditable.ffKeyDownHandler(
                evt,
                (query, rawAnchorIdx, rawFocusIdx, insertRange) => {

                    dispatcher.dispatch<typeof Actions.QueryInputSetQuery>({
                        name: Actions.QueryInputSetQuery.name,
                        payload: {
                            formType: this.props.formType,
                            sourceId: this.props.sourceId,
                            query,
                            rawAnchorIdx,
                            rawFocusIdx,
                            insertRange
                        }
                    });
                },
                (rawAnchorIdx, rawFocusIdx) => {
                    dispatcher.dispatch<typeof Actions.QueryInputMoveCursor>({
                        name: Actions.QueryInputMoveCursor.name,
                        payload: {
                            formType: this.props.formType,
                            sourceId: this.props.sourceId,
                            rawAnchorIdx,
                            rawFocusIdx
                        }
                    });
                },
                (anchorIdx, focusIdx) => {
                    dispatcher.dispatch<typeof Actions.QueryInputSelectText>({
                        name: Actions.QueryInputSelectText.name,
                        payload: {
                            sourceId: this.props.sourceId,
                            formType: this.props.formType,
                            anchorIdx,
                            focusIdx
                        }
                    });
                }
            );
        }

        private handleSelect() {
            if (!this.props.compositionModeOn) {
                const [anchorIdx, focusIdx] = this.contentEditable.getRawSelection();
                dispatcher.dispatch<typeof Actions.QueryInputSelectText>({
                    name: Actions.QueryInputSelectText.name,
                    payload: {
                        sourceId: this.props.sourceId,
                        formType: this.props.formType,
                        anchorIdx,
                        focusIdx
                    }
                });
            }
        }

        componentDidUpdate(prevProps, prevState) {
           if (this.props.hasFocus) {
            const queryObj = this.props.queries[this.props.sourceId];
                this.contentEditable.reapplySelection(
                    queryObj.rawAnchorIdx,
                    queryObj.rawFocusIdx
                );
            }
        }

        componentDidMount() {
            if (this.inputRef.current) {
                this.inputRef.current.addEventListener('focus', this.handleInputFocus);
                if (this.props.hasFocus) {
                    this.inputRef.current.focus();
                    const queryObj = this.props.queries[this.props.sourceId];
                    this.contentEditable.reapplySelection(
                        queryObj.rawAnchorIdx,
                        queryObj.rawFocusIdx
                    );
                }
            }

            if (he.browserInfo.isFirefox()) {
                this.inputRef.current.addEventListener('keydown', this.ffKeyDownHandler);
            }
        }

        componentWillUnmount() {
            if (this.inputRef.current) {
                this.inputRef.current.removeEventListener('focus', this.handleInputFocus);
            }
            if (he.browserInfo.isFirefox()) {
                this.inputRef.current.removeEventListener('keydown', this.ffKeyDownHandler);
            }
        }

        render() {
            return (
                <div>
                    <S.SyntaxHighlight
                                contentEditable={true}
                                spellCheck={false}
                                onInput={(evt) => this.handleInputChange()}
                                onCompositionStart={this.handleCompositionStart}
                                onCompositionEnd={this.handleCompositionEnd}
                                onClick={this.handleEditorClick}
                                className="cql-input"
                                ref={this.inputRef}
                                dangerouslySetInnerHTML={
                                    {__html: this.props.queries[this.props.sourceId].queryHtml || ''}}
                                onKeyDown={this.inputKeyDownHandler}
                                onKeyUp={this.inputKeyUpHandler}
                                onSelect={this.handleSelect}
                                style={this.props.minHeightEm ?
                                        { minHeight: `${this.props.minHeightEm}em` } : null} />
                    {
                        List.empty(this.props.cqlEditorMessages[this.props.sourceId]) ?
                            null :
                            <S.CQLEditorMessagesUL>
                            {
                                pipe(
                                    this.props.cqlEditorMessages[this.props.sourceId],
                                    List.map(
                                        (msg, i) => (
                                            <React.Fragment key={`msg:${i}`}>
                                                <li dangerouslySetInnerHTML={{__html: msg}} />
                                                {i < List.size(this.props.cqlEditorMessages[this.props.sourceId]) - 1 ?
                                                    ', ' : ''}
                                            </React.Fragment>
                                        )
                                    )
                                )
                            }
                            </S.CQLEditorMessagesUL>
                    }
                </div>
            );
        }
    }

    const BoundEditor = queryModel instanceof QueryFormModel ?
        BoundWithProps<CQLEditorProps, CQLEditorCoreState>(CQLEditor, queryModel) :
        BoundWithProps<CQLEditorProps, CQLEditorCoreState>(CQLEditor, queryModel);

    const BoundFallbackEditor = queryModel instanceof QueryFormModel ?
        BoundWithProps<CQLEditorFallbackProps, CQLEditorCoreState>(CQLEditorFallback, queryModel) :
        BoundWithProps<CQLEditorFallbackProps, CQLEditorCoreState>(CQLEditorFallback, queryModel);

    return {
        CQLEditor: BoundEditor,
        CQLEditorFallback: BoundFallbackEditor
    };


}