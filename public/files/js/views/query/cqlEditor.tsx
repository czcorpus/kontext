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

import { of as rxOf } from 'rxjs';
import * as React from 'react';
import { Kontext } from '../../types/common';
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { Keyboard } from 'cnc-tskit';

import { CQLEditorModel, CQLEditorModelState } from '../../models/query/cqleditor/model';
import { QueryFormModelState } from '../../models/query/common';
import { QueryFormModel } from '../../models/query/common';
import { Actions, ActionName, QueryFormType } from '../../models/query/actions';


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
            queryModel:QueryFormModel<QueryFormModelState>, editorModel:CQLEditorModel) {


    // ------------------- <CQLEditorFallback /> -----------------------------

    class CQLEditorFallback extends React.PureComponent<CQLEditorFallbackProps & QueryFormModelState> {

        constructor(props) {
            super(props);
            this.handleKeyDown = this.handleKeyDown.bind(this);
            this.inputKeyUpHandler = this.inputKeyUpHandler.bind(this);
            this.handleInputChange = this.handleInputChange.bind(this);
        }

        private inputKeyUpHandler(evt) {
            if (Keyboard.isArrowKey(evt.keyCode) || evt.keyCode === Keyboard.Code.HOME || evt.keyCode === Keyboard.Code.END) {
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
                                value={this.props.queries[this.props.sourceId]}
                                onChange={this.handleInputChange}
                                onKeyDown={this.handleKeyDown}
                                onKeyUp={this.inputKeyUpHandler}
                                spellCheck={false} />;
        }
    }

    // ------------------- <CQLEditor /> -----------------------------

    class CQLEditor extends React.PureComponent<CQLEditorProps & CQLEditorModelState> {

        constructor(props) {
            super(props);
            this.handleEditorClick = this.handleEditorClick.bind(this);
            this.inputKeyUpHandler = this.inputKeyUpHandler.bind(this);
            this.inputKeyDownHandler = this.inputKeyDownHandler.bind(this);
            this.ffKeyDownHandler = this.ffKeyDownHandler.bind(this);
        }

        private extractText(root:Node) {
            const ans:Array<[string, Node]> = [];
            for (let i = 0; i < root.childNodes.length; i += 1) {
                const elm = root.childNodes[i];
                switch (elm.nodeType) {
                    case Node.TEXT_NODE:
                        ans.push([elm.nodeValue, elm]);
                    break;
                    case Node.ELEMENT_NODE:
                        ans.splice(ans.length, 0, ...this.extractText(elm));
                    break;
                }
            };
            return ans;
        }

        private reapplySelection(rawAnchorIdx:number, rawFocusIdx:number) {
            const sel = window.getSelection();
            const src = this.extractText(this.props.inputRef.current);
            let anchorNode = this.props.inputRef.current;
            let focusNode = this.props.inputRef.current;
            let currIdx = 0;
            let anchorIdx = 0;
            let focusIdx = 0;

            src.forEach(([text, node]) => {
                const nodeStartIdx = currIdx;
                const nodeEndIdx = nodeStartIdx + text.length;
                if (nodeStartIdx <= rawAnchorIdx && rawAnchorIdx <= nodeEndIdx) {
                    anchorNode = node as HTMLPreElement;
                    anchorIdx = rawAnchorIdx - nodeStartIdx;
                }
                if (nodeStartIdx <= rawFocusIdx && rawFocusIdx <= nodeEndIdx) {
                    focusNode = node as HTMLPreElement;
                    focusIdx = rawFocusIdx - nodeStartIdx;
                }
                currIdx += text.length;
            });
            sel.setBaseAndExtent(anchorNode, anchorIdx, focusNode, focusIdx);
        }

        private getRawSelection(src:Array<[string, Node]>) {
            let rawAnchorIdx = 0;
            let rawFocusIdx = 0;
            let currIdx = 0;
            const sel = window.getSelection();

            src.forEach(([text, node]) => {
                if (node === sel.anchorNode) {
                    rawAnchorIdx = currIdx + sel.anchorOffset;
                }
                if (node === sel.focusNode) {
                    rawFocusIdx = currIdx + sel.focusOffset;
                }
                currIdx += text.length;
            });
            return [rawAnchorIdx, rawFocusIdx];
        }

        private handleInputChange() {
            const src = this.extractText(this.props.inputRef.current);
            const [rawAnchorIdx, rawFocusIdx] = this.getRawSelection(src);
            const query = src.map(v => v[0]).join('');

            dispatcher.dispatch<Actions.QueryInputSetQuery>({
                name: ActionName.QueryInputSetQuery,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    query: query,
                    rawAnchorIdx: rawAnchorIdx,
                    rawFocusIdx: rawFocusIdx,
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
                        const leftIdx = Number(a.getAttribute('data-leftIdx'));
                        const rightIdx = Number(a.getAttribute('data-rightIdx'));

                        dispatcher.dispatch({
                            name: 'TAGHELPER_PRESET_PATTERN',
                            payload: {
                                sourceId: this.props.sourceId,
                                pattern: this.props.rawCode[this.props.sourceId].substring(leftIdx + 1, rightIdx - 1) // +/-1 = get rid of quotes
                            }
                        });
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
                    break;
                }
            }
        }

        private inputKeyUpHandler(evt:React.KeyboardEvent) {
            if (Keyboard.isArrowKey(evt.keyCode) || evt.keyCode === Keyboard.Code.HOME || evt.keyCode === Keyboard.Code.END) {
                const src = this.extractText(this.props.inputRef.current);
                const [anchorIdx, focusIdx] = this.getRawSelection(src);
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
            if (evt.keyCode === Keyboard.Code.BACKSPACE || evt.keyCode === Keyboard.Code.DEL) {
                const src = this.extractText(this.props.inputRef.current);
                const [rawAnchorIdx, rawFocusIdx] = this.getRawSelection(src);
                const rawSrc = src.map(v => v[0]).join('');

                if (rawAnchorIdx === rawFocusIdx) {
                    const query = evt.keyCode === Keyboard.Code.BACKSPACE ?
                            rawSrc.substring(0, rawAnchorIdx - 1) + rawSrc.substring(rawFocusIdx) :
                            rawSrc.substring(0, rawAnchorIdx) + rawSrc.substring(rawFocusIdx + 1);

                    dispatcher.dispatch<Actions.QueryInputSetQuery>({
                        name: ActionName.QueryInputSetQuery,
                        payload: {
                            formType: this.props.formType,
                            sourceId: this.props.sourceId,
                            query: query,
                            rawAnchorIdx: evt.keyCode === Keyboard.Code.BACKSPACE ? rawAnchorIdx - 1 : rawAnchorIdx,
                            rawFocusIdx: evt.keyCode === Keyboard.Code.BACKSPACE ? rawFocusIdx - 1 : rawFocusIdx,
                            insertRange: null
                        }
                    });

                } else if (rawAnchorIdx < rawFocusIdx) {
                    const query = rawSrc.substring(0, rawAnchorIdx) + rawSrc.substring(rawFocusIdx);
                    dispatcher.dispatch<Actions.QueryInputSetQuery>({
                        name: ActionName.QueryInputSetQuery,
                        payload: {
                            formType: this.props.formType,
                            sourceId: this.props.sourceId,
                            query: query,
                            rawAnchorIdx: evt.keyCode === Keyboard.Code.BACKSPACE ? rawAnchorIdx : rawAnchorIdx,
                            rawFocusIdx: evt.keyCode === Keyboard.Code.BACKSPACE ? rawAnchorIdx : rawAnchorIdx,
                            insertRange: null
                        }
                    });

                } else {
                    const query = rawSrc.substring(0, rawFocusIdx) + rawSrc.substring(rawAnchorIdx);
                    dispatcher.dispatch<Actions.QueryInputSetQuery>({
                        name: ActionName.QueryInputSetQuery,
                        payload: {
                            formType: this.props.formType,
                            sourceId: this.props.sourceId,
                            query: query,
                            rawAnchorIdx: evt.keyCode === Keyboard.Code.BACKSPACE ? rawFocusIdx : rawFocusIdx,
                            rawFocusIdx: evt.keyCode === Keyboard.Code.BACKSPACE ? rawFocusIdx : rawFocusIdx,
                            insertRange: null
                        }
                    });
                }
                evt.preventDefault();

            } else if (evt.keyCode === Keyboard.Code.ENTER && evt.shiftKey) {
                const src = this.extractText(this.props.inputRef.current);
                const [rawAnchorIdx, rawFocusIdx] = this.getRawSelection(src);
                const query = src.map(v => v[0]).join('');
                dispatcher.dispatch<Actions.QueryInputSetQuery>({
                    name: ActionName.QueryInputSetQuery,
                    payload: {
                        formType: this.props.formType,
                        sourceId: this.props.sourceId,
                        // We have to add a single whitespace here because otherwise FF cannot handle cursor
                        // position properly (normally it inserts its custom br type=_moz element which is
                        // even worse to handle). This is not ideal but by far the most cheap solution.
                        query: rawFocusIdx === query.length ? '\n ' : '\n',
                        rawAnchorIdx: rawFocusIdx === query.length ? rawAnchorIdx + 2 : rawAnchorIdx + 1,
                        rawFocusIdx: rawFocusIdx === query.length ? rawFocusIdx + 2 : rawFocusIdx + 1,
                        insertRange: [rawAnchorIdx, rawFocusIdx]
                    }
                });
                evt.preventDefault();

            } else if (evt.keyCode === Keyboard.Code.END) {
                const src = this.extractText(this.props.inputRef.current);
                const [anchorIdx, focusIdx] = this.getRawSelection(src);
                const query = src.map(v => v[0]).join('');
                dispatcher.dispatch<Actions.QueryInputMoveCursor>({
                    name: ActionName.QueryInputMoveCursor,
                    payload: {
                        formType: this.props.formType,
                        sourceId: this.props.sourceId,
                        rawAnchorIdx: anchorIdx === focusIdx ? query.length : anchorIdx,
                        rawFocusIdx: query.length
                    }
                });
                evt.preventDefault();
            }
        }

        componentDidUpdate(prevProps, prevState) {
            if (this.props.rawAnchorIdx !== null && this.props.rawFocusIdx !== null) {
                this.reapplySelection(
                    this.props.rawAnchorIdx[this.props.sourceId],
                    this.props.rawFocusIdx[this.props.sourceId]
                );
            }
        }

        componentDidMount() {
            if (this.props.takeFocus && this.props.inputRef.current) {
                this.props.inputRef.current.focus();
            }

            if (he.browserInfo.isFirefox()) {
                this.props.inputRef.current.addEventListener('keydown', this.ffKeyDownHandler);
            }

            dispatcher.dispatch<Actions.CQLEditorInitialize>({
                name: ActionName.CQLEditorInitialize
            });
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
                                dangerouslySetInnerHTML={{__html: this.props.richCode[this.props.sourceId] || ''}}
                                onKeyDown={this.inputKeyDownHandler}
                                onKeyUp={this.inputKeyUpHandler} />
                    <div className="cql-editor-messages">
                        {
                            this.props.cqlEditorMessage ?
                            <div className="cql-editor-message"
                                    dangerouslySetInnerHTML={{__html: this.props.message[this.props.sourceId]}} /> : null
                        }
                    </div>
                </div>
            );
        }
    }

    const BoundEditor = BoundWithProps<CQLEditorProps, CQLEditorModelState>(CQLEditor, editorModel);

    const BoundFallbackEditor = BoundWithProps<CQLEditorFallbackProps, QueryFormModelState>(CQLEditorFallback, queryModel);

    return {
        CQLEditor: BoundEditor,
        CQLEditorFallback: BoundFallbackEditor
    };


}