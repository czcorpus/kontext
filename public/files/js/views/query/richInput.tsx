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

import { Kontext } from '../../types/common';
import { QueryFormModel, QueryFormModelState } from '../../models/query/common';
import { Actions, ActionName } from '../../models/query/actions';
import { ContentEditable } from './contentEditable';
import { Keyboard } from 'cnc-tskit';
import { strictEqualParsedQueries } from '../../models/query/query';


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
            this.handleSelect = this.handleSelect.bind(this);
        }


        private handleInputChange(evt:React.ChangeEvent<HTMLInputElement>) {
            const [rawAnchorIdx, rawFocusIdx] = this.contentEditable.getRawSelection();
            const query = this.contentEditable.extractText();

            dispatcher.dispatch<Actions.QueryInputSetQuery>({
                name: ActionName.QueryInputSetQuery,
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

        private handleKeyDown(evt) {
            if (evt.keyCode === Keyboard.Code.DOWN_ARROW &&
                    this.props.hasHistoryWidget &&
                    this.props.downArrowTriggersHistory[this.props.sourceId] &&
                        !this.props.historyIsVisible) {
                this.props.onReqHistory();

            } else if (evt.keyCode === Keyboard.Code.ESC) {
                this.props.onEsc();
            }
        }

        private handleKeyUp(evt) {
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
                dispatcher.dispatch<Actions.ToggleQuerySuggestionWidget>({
                    name: ActionName.ToggleQuerySuggestionWidget,
                    payload: {
                        formType: this.props.formType,
                        sourceId: this.props.sourceId,
                        tokenIdx: tokenIdx
                    }
                });

            } else if (this.props.refObject.current) {
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

        componentDidUpdate(prevProps:RichInputProps & QueryFormModelState, _:unknown) {
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
                        onSelect={this.handleSelect}
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
            dispatcher.dispatch<Actions.QueryInputSetQuery>({
                name: ActionName.QueryInputSetQuery,
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
            if (evt.keyCode === Keyboard.Code.DOWN_ARROW &&
                    this.props.hasHistoryWidget &&
                    this.props.downArrowTriggersHistory &&
                    !this.props.historyIsVisible) {
                this.props.onReqHistory();

            } else if (evt.keyCode === Keyboard.Code.ESC) {
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
