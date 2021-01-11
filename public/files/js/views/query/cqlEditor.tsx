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
import { Kontext } from '../../types/common';
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { Keyboard } from 'cnc-tskit';

import { QueryFormModelState } from '../../models/query/common';
import { QueryFormModel } from '../../models/query/common';
import { Actions, ActionName, QueryFormType } from '../../models/query/actions';
import { ContentEditable } from './contentEditable';
import { findTokenIdxByFocusIdx, strictEqualParsedQueries } from '../../models/query/query';


export interface CQLEditorProps {
    formType:QueryFormType;
    sourceId:string;
    takeFocus:boolean;
    hasHistoryWidget:boolean;
    historyIsVisible:boolean;
    inputRef:React.RefObject<HTMLPreElement>;
    onReqHistory:()=>void;
    onEsc:()=>void;
}

export interface CQLEditorFallbackProps {
    formType:QueryFormType;
    sourceId:string;
    hasHistoryWidget:boolean;
    historyIsVisible:boolean;
    inputRef:React.RefObject<HTMLTextAreaElement>;
    onReqHistory:()=>void;
    onEsc:()=>void;
}

export interface CQLEditorViews {
    CQLEditorFallback:React.ComponentClass;
    CQLEditor:React.ComponentClass;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            queryModel:QueryFormModel<QueryFormModelState>) {


    // ------------------- <CQLEditorFallback /> -----------------------------

    class CQLEditorFallback extends React.PureComponent<CQLEditorFallbackProps &
            QueryFormModelState> {

        constructor(props) {
            super(props);
            this.handleKeyDown = this.handleKeyDown.bind(this);
            this.inputKeyUpHandler = this.inputKeyUpHandler.bind(this);
            this.handleInputChange = this.handleInputChange.bind(this);
        }

        private inputKeyUpHandler(evt) {
            if (Keyboard.isArrowKey(evt.keyCode) || evt.keyCode === Keyboard.Code.HOME ||
                    evt.keyCode === Keyboard.Code.END) {
                dispatcher.dispatch<Actions.QueryInputMoveCursor>({
                    name: ActionName.QueryInputMoveCursor,
                    payload: {
                        formType: this.props.formType,
                        sourceId: this.props.sourceId,
                        rawAnchorIdx: this.props.inputRef.current.selectionStart,
                        rawFocusIdx: this.props.inputRef.current.selectionEnd
                    }
                });
            }
        }

        private handleKeyDown(evt) {
            if (evt.keyCode === Keyboard.Code.DOWN_ARROW &&
                    this.props.hasHistoryWidget &&
                    this.props.downArrowTriggersHistory &&
                    !this.props.historyIsVisible) {
                this.props.onReqHistory();

            } else if (evt.keyCode === Keyboard.Code.ESC) {
                this.props.onEsc();
            }
        }

        private handleInputChange(evt:React.ChangeEvent<HTMLTextAreaElement>) {
            dispatcher.dispatch<Actions.QueryInputSetQuery>({
                name: ActionName.QueryInputSetQuery,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    query: evt.target.value,
                    rawAnchorIdx: this.props.inputRef.current.selectionStart,
                    rawFocusIdx: this.props.inputRef.current.selectionEnd,
                    insertRange: null
                }
            });
        }

        render():React.ReactElement<{}> {
            return <textarea className="cql-input" rows={2} cols={60} name="cql"
                                ref={this.props.inputRef}
                                value={this.props.queries[this.props.sourceId].query}
                                onChange={this.handleInputChange}
                                onKeyDown={this.handleKeyDown}
                                onKeyUp={this.inputKeyUpHandler}
                                spellCheck={false} />;
        }
    }

    // ------------------- <CQLEditor /> -----------------------------

    class CQLEditor extends React.PureComponent<CQLEditorProps & QueryFormModelState> {

        private readonly contentEditable:ContentEditable<HTMLPreElement>;

        constructor(props) {
            super(props);
            this.handleEditorClick = this.handleEditorClick.bind(this);
            this.inputKeyUpHandler = this.inputKeyUpHandler.bind(this);
            this.inputKeyDownHandler = this.inputKeyDownHandler.bind(this);
            this.ffKeyDownHandler = this.ffKeyDownHandler.bind(this);
            this.handleSelect = this.handleSelect.bind(this);
            this.contentEditable = new ContentEditable<HTMLPreElement>(this.props.inputRef);
        }

        private handleInputChange() {
            const [rawAnchorIdx, rawFocusIdx] = this.contentEditable.getRawSelection();
            const query = this.contentEditable.extractText();

            dispatcher.dispatch<Actions.QueryInputSetQuery>({
                name: ActionName.QueryInputSetQuery,
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

        private findLinkParent(elm:HTMLElement):HTMLElement {
            let curr = elm;
            while (curr !== this.props.inputRef.current) {
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

                        dispatcher.dispatch<Actions.SetActiveInputWidget>({
                            name: ActionName.SetActiveInputWidget,
                            payload: {
                                formType: this.props.formType,
                                sourceId: this.props.sourceId,
                                value: 'tag',
                                widgetArgs: {
                                    leftIdx: leftIdx,
                                    rightIdx: rightIdx
                                }
                            }
                        });
                        dispatcher.dispatch<Actions.QueryTaghelperPresetPattern>({
                            name: ActionName.QueryTaghelperPresetPattern,
                            payload: {
                                formType: this.props.formType,
                                sourceId: this.props.sourceId,
                                pattern: this.props.queries[this.props.sourceId].query.substring(
                                    leftIdx + 1, rightIdx - 1) // +/-1 = get rid of quotes
                            }
                        });
                    break;
                    case 'sugg': {
                        const leftIdx = parseInt(a.getAttribute('data-leftIdx'));
                        const queryObj = this.props.queries[this.props.sourceId];
                        if (queryObj.qtype === 'advanced') {
                            const tokenIdx = findTokenIdxByFocusIdx(queryObj, leftIdx);
                            dispatcher.dispatch<Actions.ToggleQuerySuggestionWidget>({
                                name: ActionName.ToggleQuerySuggestionWidget,
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
                dispatcher.dispatch<Actions.QueryInputMoveCursor>({
                    name: ActionName.QueryInputMoveCursor,
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
            if (Keyboard.isArrowKey(evt.keyCode) || evt.keyCode === Keyboard.Code.HOME ||
                    evt.keyCode === Keyboard.Code.END) {
                const [anchorIdx, focusIdx] = this.contentEditable.getRawSelection();
                dispatcher.dispatch<Actions.QueryInputMoveCursor>({
                    name: ActionName.QueryInputMoveCursor,
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
            if (evt.keyCode === Keyboard.Code.DOWN_ARROW &&
                    this.props.hasHistoryWidget &&
                    this.props.downArrowTriggersHistory[this.props.sourceId] &&
                    !this.props.historyIsVisible) {
                this.props.onReqHistory();

            } else if (evt.keyCode === Keyboard.Code.ESC) {
                this.props.onEsc();
            }
        }

        private ffKeyDownHandler(evt:KeyboardEvent) {
            this.contentEditable.ffKeyDownHandler(
                evt,
                (query, rawAnchorIdx, rawFocusIdx, insertRange) => {

                    dispatcher.dispatch<Actions.QueryInputSetQuery>({
                        name: ActionName.QueryInputSetQuery,
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
                    dispatcher.dispatch<Actions.QueryInputMoveCursor>({
                        name: ActionName.QueryInputMoveCursor,
                        payload: {
                            formType: this.props.formType,
                            sourceId: this.props.sourceId,
                            rawAnchorIdx,
                            rawFocusIdx
                        }
                    });
                },
                (anchorIdx, focusIdx) => {
                    dispatcher.dispatch<Actions.QueryInputSelectText>({
                        name: ActionName.QueryInputSelectText,
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
            const [anchorIdx, focusIdx] = this.contentEditable.getRawSelection();
            dispatcher.dispatch<Actions.QueryInputSelectText>({
                name: ActionName.QueryInputSelectText,
                payload: {
                    sourceId: this.props.sourceId,
                    formType: this.props.formType,
                    anchorIdx,
                    focusIdx
                }
            });
        }

        componentDidUpdate(prevProps, prevState) {
            const prevQueryObj = prevProps.queries[this.props.sourceId];
            const queryObj = this.props.queries[this.props.sourceId];
            if (prevQueryObj.rawAnchorIdx !== queryObj.rawAnchorIdx ||
                        prevQueryObj.rawFocusIdx !== queryObj.rawFocusIdx ||
                        prevQueryObj.query !== queryObj.query ||
                        !strictEqualParsedQueries(prevQueryObj, queryObj)) {
                this.contentEditable.reapplySelection(
                    queryObj.rawAnchorIdx,
                    queryObj.rawFocusIdx
                );
            }
        }

        componentDidMount() {
            if (this.props.takeFocus && this.props.inputRef.current) {
                this.props.inputRef.current.focus();
                const queryObj = this.props.queries[this.props.sourceId];
                this.contentEditable.reapplySelection(
                    queryObj.rawAnchorIdx,
                    queryObj.rawFocusIdx
                );
            }

            if (he.browserInfo.isFirefox()) {
                this.props.inputRef.current.addEventListener('keydown', this.ffKeyDownHandler);
            }
        }

        componentWillUnmount() {
            if (he.browserInfo.isFirefox()) {
                this.props.inputRef.current.removeEventListener('keydown', this.ffKeyDownHandler);
            }
        }

        render() {
            return (
                <div>
                    <pre contentEditable={true}
                                spellCheck={false}
                                onInput={(evt) => this.handleInputChange()}
                                onClick={this.handleEditorClick}
                                className="cql-input"
                                ref={this.props.inputRef}
                                dangerouslySetInnerHTML={
                                    {__html: this.props.queries[this.props.sourceId].queryHtml || ''}}
                                onKeyDown={this.inputKeyDownHandler}
                                onKeyUp={this.inputKeyUpHandler}
                                onSelect={this.handleSelect} />
                    <div className="cql-editor-messages">
                        {
                            this.props.cqlEditorMessages[this.props.sourceId] ?
                                <div className="cql-editor-message"
                                    dangerouslySetInnerHTML={
                                        {__html: this.props.cqlEditorMessages[this.props.sourceId]}} /> :
                                null
                        }
                    </div>
                </div>
            );
        }
    }

    const BoundEditor = BoundWithProps<CQLEditorProps, QueryFormModelState>(CQLEditor, queryModel);

    const BoundFallbackEditor = BoundWithProps<CQLEditorFallbackProps,
            QueryFormModelState>(CQLEditorFallback, queryModel);

    return {
        CQLEditor: BoundEditor,
        CQLEditorFallback: BoundFallbackEditor
    };


}