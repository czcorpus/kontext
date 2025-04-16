/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IActionDispatcher, BoundWithProps } from 'kombo';

import * as Kontext from '../../types/kontext.js';
import { QueryFormModel, QueryFormModelState } from '../../models/query/common.js';
import { Actions } from '../../models/query/actions.js';
import { ContentEditable } from './contentEditable.js';
import { Keyboard } from 'cnc-tskit';
import { strictEqualParsedQueries } from '../../models/query/query.js';


interface RichInputProps {
    sourceId:string;
    refObject:React.RefObject<HTMLSpanElement>;
    hasHistoryWidget:boolean;
    historyIsVisible:boolean;
    takeFocus:boolean;
    onReqHistory:()=>void;
    onEsc:()=>void;
}

interface RichInputFallbackProps {
    sourceId:string;
    refObject:React.RefObject<HTMLInputElement>;
    hasHistoryWidget:boolean;
    historyIsVisible:boolean;
    takeFocus:boolean;
    onReqHistory:()=>void;
    onEsc:()=>void;
}

interface RichInputViews {
    RichInput:React.ComponentClass<RichInputProps>;
    RichInputFallback:React.ComponentClass<RichInputFallbackProps>;
}

export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    queryModel:QueryFormModel<QueryFormModelState>,
):RichInputViews {


    // ------------------- <RichInput /> -----------------------------

    class RichInput extends React.PureComponent<RichInputProps & QueryFormModelState> {

        private readonly contentEditable:ContentEditable<HTMLSpanElement>;

        constructor(props) {
            super(props);
            this.handleInputChange = this.handleInputChange.bind(this);
            this.handleKeyDown = this.handleKeyDown.bind(this);
            this.handleKeyUp = this.handleKeyUp.bind(this);
            this.handleClick = this.handleClick.bind(this);
            this.ffKeyDownHandler = this.ffKeyDownHandler.bind(this);
            this.contentEditable = new ContentEditable<HTMLSpanElement>(props.refObject);
            this.handlePaste = this.handlePaste.bind(this);
            this.handleCompositionStart = this.handleCompositionStart.bind(this);
            this.handleCompositionEnd = this.handleCompositionEnd.bind(this);
        }

        private newInputDispatch(evt:React.ChangeEvent<HTMLInputElement>|React.CompositionEvent<HTMLInputElement>) {
            const [rawAnchorIdx, rawFocusIdx] = this.contentEditable.getRawSelection();
            const query = this.contentEditable.extractText();
            dispatcher.dispatch<typeof Actions.QueryInputSetQuery>({
                name: Actions.QueryInputSetQuery.name,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    query,
                    rawAnchorIdx,
                    rawFocusIdx,
                    insertRange: null
                }
            });
        }


        private handleInputChange(evt:React.ChangeEvent<HTMLInputElement>) {
            if (!this.props.compositionModeOn) {
                this.newInputDispatch(evt);
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

        private handleKeyDown(evt) {
            if (evt.key === Keyboard.Value.DOWN_ARROW &&
                    this.props.hasHistoryWidget &&
                    this.props.downArrowTriggersHistory[this.props.sourceId] &&
                        !this.props.historyIsVisible) {
                this.props.onReqHistory();

            } else if (evt.key === Keyboard.Value.ESC) {
                this.props.onEsc();
            }
        }

        private handleKeyUp(evt) {
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

        private handlePaste(e) {
            e.preventDefault();
            document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
        }

        private findLinkParent(elm:HTMLElement):HTMLElement {
            let curr = elm;
            while (curr !== this.props.refObject.current) {
                if (curr.nodeName === 'A') {
                    return curr;
                }
                curr = curr.parentElement;
            }
            return null;
        }

        private handleClick(evt:React.MouseEvent) {
            const a = this.findLinkParent(evt.target as HTMLElement);
            if (a !== null && (evt.ctrlKey || evt.metaKey)) {
                const tokenIdx = parseInt(a.getAttribute('data-tokenIdx'));
                dispatcher.dispatch<typeof Actions.ToggleQuerySuggestionWidget>({
                    name: Actions.ToggleQuerySuggestionWidget.name,
                    payload: {
                        formType: this.props.formType,
                        sourceId: this.props.sourceId,
                        tokenIdx: tokenIdx
                    }
                });

            } else if (this.props.refObject.current) {
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

        private handleCompositionStart() {
            dispatcher.dispatch<typeof Actions.SetCompositionMode>({
                name: Actions.SetCompositionMode.name,
                payload: {
                    formType: this.props.formType,
                    status: true
                }
            });
        }

        private handleCompositionEnd(evt:React.CompositionEvent<HTMLInputElement>) {
            dispatcher.dispatch<typeof Actions.SetCompositionMode>({
                name: Actions.SetCompositionMode.name,
                payload: {
                    formType: this.props.formType,
                    status: false
                }
            });
            // Chrome performs onCompositionEnd action after inputChange
            // we have to dispatch new state here
            this.newInputDispatch(evt);
        }

        componentDidUpdate(prevProps:RichInputProps & QueryFormModelState, _:unknown) {
            const queryObj = this.props.queries[this.props.sourceId];
            this.contentEditable.reapplySelection(
                queryObj.rawAnchorIdx,
                queryObj.rawFocusIdx
            );
        }

        componentDidMount() {
            if (this.props.takeFocus && this.props.refObject.current) {
                this.props.refObject.current.focus();
            }

            if (he.browserInfo.isFirefox()) {
                this.props.refObject.current.addEventListener('keydown', this.ffKeyDownHandler);
            }

        }

        componentWillUnmount() {
            if (he.browserInfo.isFirefox()) {
                this.props.refObject.current.removeEventListener('keydown', this.ffKeyDownHandler);
            }
        }

        render() {
            return (
                <span className="simple-input" contentEditable={true}
                        spellCheck={false}
                        ref={this.props.refObject}
                        onInput={this.handleInputChange}
                        onKeyDown={this.handleKeyDown}
                        onKeyUp={this.handleKeyUp}
                        onClick={this.handleClick}
                        onPaste={this.handlePaste}
                        onCompositionStart={this.handleCompositionStart}
                        onCompositionEnd={this.handleCompositionEnd}
                        dangerouslySetInnerHTML={{__html: this.props.queries[this.props.sourceId].queryHtml}} />
            );
        }
    }

    // ------------------- <RichInputFallback /> -----------------------------

    class RichInputFallback extends React.Component<RichInputFallbackProps & QueryFormModelState> {

        constructor(props) {
            super(props);
            this.handleInputChange = this.handleInputChange.bind(this);
            this.handleKeyDown = this.handleKeyDown.bind(this);
        }

        private handleInputChange(evt:React.ChangeEvent<HTMLInputElement>) {
            dispatcher.dispatch<typeof Actions.QueryInputSetQuery>({
                name: Actions.QueryInputSetQuery.name,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    query: evt.target.value,
                    rawAnchorIdx: this.props.refObject.current.selectionStart,
                    rawFocusIdx: this.props.refObject.current.selectionEnd,
                    insertRange: null
                }
            });
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

        render() {
            return <input className="simple-input" type="text"
                    spellCheck={false}
                    ref={this.props.refObject}
                    value={this.props.queries[this.props.sourceId].query}
                    onChange={this.handleInputChange}
                    onKeyDown={this.handleKeyDown} />;
        }
    }

    return {
        RichInput: BoundWithProps<RichInputProps, QueryFormModelState>(RichInput, queryModel),
        RichInputFallback: BoundWithProps<RichInputFallbackProps, QueryFormModelState>(RichInputFallback, queryModel)
    }
}
