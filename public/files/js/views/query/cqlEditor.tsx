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

import {Kontext, KeyCodes} from '../../types/common';
import * as React from 'react';
import * as Rx from '@reactivex/rxjs';
import {CQLEditorModel, CQLEditorModelState} from '../../models/query/cqleditor/model';
import {SetQueryInputAction, MoveCursorInputAction} from '../../models/query/common';
import {ActionDispatcher} from '../../app/dispatcher';
import {QueryFormModel} from '../../models/query/common';


export interface CQLEditorProps {
    actionPrefix:string;
    sourceId:string;
    takeFocus:boolean;
    hasHistoryWidget:boolean;
    historyIsVisible:boolean;
    inputRef:React.RefObject<HTMLPreElement>;
    onReqHistory:()=>void;
    onEsc:()=>void;
}

export interface CQLEditorFallbackProps {
    sourceId:string;
    actionPrefix:string;
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


export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers,
            queryModel:QueryFormModel, editorModel:CQLEditorModel) {


    // ------------------- <CQLEditorFallback /> -----------------------------

    class CQLEditorFallback extends React.PureComponent<CQLEditorFallbackProps, {
        query:string;
        downArrowTriggersHistory:boolean;
    }> {

        constructor(props) {
            super(props);
            this.handleKeyDown = this.handleKeyDown.bind(this);
            this.inputKeyUpHandler = this.inputKeyUpHandler.bind(this);
            this.handleModelChange = this.handleModelChange.bind(this);
            this.handleInputChange = this.handleInputChange.bind(this);
            this.state = {
                query: queryModel.getQuery(this.props.sourceId),
                downArrowTriggersHistory: queryModel.getDownArrowTriggersHistory(this.props.sourceId)
            };
        }

        private inputKeyUpHandler(evt) {
            if (KeyCodes.isArrowKey(evt.keyCode) || evt.keyCode === KeyCodes.HOME || evt.keyCode === KeyCodes.END) {
                dispatcher.dispatch<MoveCursorInputAction>({
                    actionType: 'QUERY_INPUT_MOVE_CURSOR',
                    props: {
                        sourceId: this.props.sourceId,
                        rawAnchorIdx: this.props.inputRef.current.selectionStart,
                        rawFocusIdx: this.props.inputRef.current.selectionEnd
                    }
                });
            }
        }

        private handleKeyDown(evt) {
            if (evt.keyCode === KeyCodes.DOWN_ARROW &&
                    this.props.hasHistoryWidget &&
                    this.state.downArrowTriggersHistory &&
                    !this.props.historyIsVisible) {
                this.props.onReqHistory();

            } else if (evt.keyCode === KeyCodes.ESC) {
                this.props.onEsc();
            }
        }

        private handleInputChange(evt:React.ChangeEvent<HTMLTextAreaElement>) {
            dispatcher.dispatch<SetQueryInputAction>({
                actionType: this.props.actionPrefix + 'QUERY_INPUT_SET_QUERY',
                props: {
                    sourceId: this.props.sourceId,
                    query: evt.target.value,
                    rawAnchorIdx: this.props.inputRef.current.selectionStart,
                    rawFocusIdx: this.props.inputRef.current.selectionEnd,
                    insertRange: null
                }
            });
        }

        private handleModelChange() {
            this.setState({
                query: queryModel.getQuery(this.props.sourceId),
                downArrowTriggersHistory: queryModel.getDownArrowTriggersHistory(this.props.sourceId)
            });
        }

        componentDidMount() {
            queryModel.addChangeListener(this.handleModelChange);
        }

        componentWillUnmount() {
            queryModel.removeChangeListener(this.handleModelChange);
        }

        render():React.ReactElement<{}> {
            return <textarea className="cql-input" rows={2} cols={60} name="cql"
                                ref={this.props.inputRef}
                                value={this.state.query}
                                onChange={this.handleInputChange}
                                onKeyDown={this.handleKeyDown}
                                onKeyUp={this.inputKeyUpHandler}
                                spellCheck={false} />;
        }
    }

    // ------------------- <CQLEditor /> -----------------------------

    class CQLEditor extends React.Component<CQLEditorProps, CQLEditorModelState> {

        constructor(props:CQLEditorProps) {
            super(props);
            this.state = editorModel.getState();
            this.handleModelChange = this.handleModelChange.bind(this);
            this.handleEditorClick = this.handleEditorClick.bind(this);
            this.inputKeyUpHandler = this.inputKeyUpHandler.bind(this);
            this.inputKeyDownHandler = this.inputKeyDownHandler.bind(this);
            this.ffKeyDownHandler = this.ffKeyDownHandler.bind(this);
        }

        private handleModelChange(state:CQLEditorModelState) {
            this.setState(state);
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

            dispatcher.dispatch<SetQueryInputAction>({
                actionType: `${this.props.actionPrefix}QUERY_INPUT_SET_QUERY`,
                props: {
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

                        dispatcher.insert(Rx.Observable.of(
                            {
                                actionType: 'TAGHELPER_PRESET_PATTERN',
                                props: {
                                    sourceId: this.props.sourceId,
                                    pattern: this.state.rawCode.get(this.props.sourceId).substring(leftIdx + 1, rightIdx - 1) // +/-1 = get rid of quotes
                                }
                            },
                            {
                                actionType: 'QUERY_INPUT_SET_ACTIVE_WIDGET',
                                props: {
                                    sourceId: this.props.sourceId,
                                    value: 'tag',
                                    widgetArgs: {
                                        leftIdx: leftIdx,
                                        rightIdx: rightIdx
                                    }
                                }
                            }
                        ));
                    break;
                }
            }
        }

        private inputKeyUpHandler(evt:React.KeyboardEvent) {
            if (KeyCodes.isArrowKey(evt.keyCode) || evt.keyCode === KeyCodes.HOME || evt.keyCode === KeyCodes.END) {
                const src = this.extractText(this.props.inputRef.current);
                const [anchorIdx, focusIdx] = this.getRawSelection(src);
                dispatcher.dispatch<MoveCursorInputAction>({
                    actionType: `${this.props.actionPrefix}QUERY_INPUT_MOVE_CURSOR`,
                    props: {
                        sourceId: this.props.sourceId,
                        rawAnchorIdx: anchorIdx,
                        rawFocusIdx: focusIdx
                    }
                });
            }
        }

        private inputKeyDownHandler(evt:React.KeyboardEvent) {
            if (evt.keyCode === KeyCodes.DOWN_ARROW &&
                    this.props.hasHistoryWidget &&
                    this.state.downArrowTriggersHistory.get(this.props.sourceId) &&
                    !this.props.historyIsVisible) {
                this.props.onReqHistory();

            } else if (evt.keyCode === KeyCodes.ESC) {
                this.props.onEsc();
            }
        }

        private ffKeyDownHandler(evt:KeyboardEvent) {
            if (evt.keyCode === KeyCodes.BACKSPACE || evt.keyCode === KeyCodes.DEL) {
                const src = this.extractText(this.props.inputRef.current);
                const [rawAnchorIdx, rawFocusIdx] = this.getRawSelection(src);
                const rawSrc = src.map(v => v[0]).join('');

                if (rawAnchorIdx === rawFocusIdx) {
                    const query = evt.keyCode === KeyCodes.BACKSPACE ?
                            rawSrc.substring(0, rawAnchorIdx - 1) + rawSrc.substring(rawFocusIdx) :
                            rawSrc.substring(0, rawAnchorIdx) + rawSrc.substring(rawFocusIdx + 1);

                    dispatcher.dispatch<SetQueryInputAction>({
                        actionType: `${this.props.actionPrefix}QUERY_INPUT_SET_QUERY`,
                        props: {
                            sourceId: this.props.sourceId,
                            query: query,
                            rawAnchorIdx: evt.keyCode === KeyCodes.BACKSPACE ? rawAnchorIdx - 1 : rawAnchorIdx,
                            rawFocusIdx: evt.keyCode === KeyCodes.BACKSPACE ? rawFocusIdx - 1 : rawFocusIdx,
                            insertRange: null
                        }
                    });
                    this.reapplySelection(
                        evt.keyCode === KeyCodes.BACKSPACE ? rawAnchorIdx - 1 : rawAnchorIdx,
                        evt.keyCode === KeyCodes.BACKSPACE ? rawFocusIdx - 1 : rawFocusIdx
                    );

                } else if (rawAnchorIdx < rawFocusIdx) {
                    const query = rawSrc.substring(0, rawAnchorIdx) + rawSrc.substring(rawFocusIdx);
                    dispatcher.dispatch<SetQueryInputAction>({
                        actionType: `${this.props.actionPrefix}QUERY_INPUT_SET_QUERY`,
                        props: {
                            sourceId: this.props.sourceId,
                            query: query,
                            rawAnchorIdx: evt.keyCode === KeyCodes.BACKSPACE ? rawAnchorIdx : rawAnchorIdx,
                            rawFocusIdx: evt.keyCode === KeyCodes.BACKSPACE ? rawAnchorIdx : rawAnchorIdx,
                            insertRange: null
                        }
                    });
                    this.reapplySelection(
                        evt.keyCode === KeyCodes.BACKSPACE ? rawAnchorIdx : rawAnchorIdx,
                        evt.keyCode === KeyCodes.BACKSPACE ? rawAnchorIdx : rawAnchorIdx
                    );

                } else {
                    const query = rawSrc.substring(0, rawFocusIdx) + rawSrc.substring(rawAnchorIdx);
                    dispatcher.dispatch<SetQueryInputAction>({
                        actionType: `${this.props.actionPrefix}QUERY_INPUT_SET_QUERY`,
                        props: {
                            sourceId: this.props.sourceId,
                            query: query,
                            rawAnchorIdx: evt.keyCode === KeyCodes.BACKSPACE ? rawFocusIdx : rawFocusIdx,
                            rawFocusIdx: evt.keyCode === KeyCodes.BACKSPACE ? rawFocusIdx : rawFocusIdx,
                            insertRange: null
                        }
                    });
                    this.reapplySelection(
                        evt.keyCode === KeyCodes.BACKSPACE ? rawFocusIdx : rawFocusIdx,
                        evt.keyCode === KeyCodes.BACKSPACE ? rawFocusIdx : rawFocusIdx
                    );
                }
                evt.preventDefault();

            } else if (evt.keyCode === KeyCodes.ENTER && evt.shiftKey) {
                const src = this.extractText(this.props.inputRef.current);
                const [rawAnchorIdx, rawFocusIdx] = this.getRawSelection(src);
                const rawSrc = src.map(v => v[0]).join('');
                const query = rawSrc + '\n ';
                dispatcher.dispatch<SetQueryInputAction>({
                    actionType: `${this.props.actionPrefix}QUERY_INPUT_SET_QUERY`,
                    props: {
                        sourceId: this.props.sourceId,
                        query: query,
                        rawAnchorIdx: rawAnchorIdx + 1,
                        rawFocusIdx: rawFocusIdx + 1,
                        insertRange: null
                    }
                });
                this.reapplySelection(
                    rawAnchorIdx + 1,
                    rawAnchorIdx + 1
                );
                evt.preventDefault();
            }
        }

        shouldComponentUpdate(nextProps, nextState) {
            return this.state.rawAnchorIdx.get(this.props.sourceId) !== nextState.rawAnchorIdx.get(this.props.sourceId) ||
                    this.state.rawFocusIdx.get(this.props.sourceId) !== nextState.rawFocusIdx.get(this.props.sourceId) ||
                    this.state.rawCode.get(this.props.sourceId) !== nextState.rawCode.get(this.props.sourceId) ||
                    this.state.richCode.get(this.props.sourceId) !== nextState.richCode.get(this.props.sourceId) ||
                    // we want non-strict comparison below because message map is initialized as empty
                    // but even  editor interaction without generated message writes a [corp]=>null which
                    // changes the object
                    this.state.message.get(this.props.sourceId) != nextState.message.get(this.props.sourceId) ||
                    this.state.isEnabled !== nextState.isEnabled;
        }

        componentDidUpdate(prevProps, prevState) {
            if (this.state.rawAnchorIdx !== null && this.state.rawFocusIdx !== null) {
                this.reapplySelection(
                    this.state.rawAnchorIdx.get(this.props.sourceId),
                    this.state.rawFocusIdx.get(this.props.sourceId)
                );
            }
        }

        componentDidMount() {
            editorModel.addChangeListener(this.handleModelChange);
            if (this.props.takeFocus && this.props.inputRef.current) {
                this.props.inputRef.current.focus();
            }

            if (he.browserInfo.isFirefox()) {
                this.props.inputRef.current.addEventListener('keydown', this.ffKeyDownHandler);
            }
        }

        componentWillUnmount() {
            editorModel.removeChangeListener(this.handleModelChange);
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
                                dangerouslySetInnerHTML={{__html: this.state.richCode.get(this.props.sourceId)}}
                                onKeyDown={this.inputKeyDownHandler}
                                onKeyUp={this.inputKeyUpHandler} />
                    <div className="cql-editor-messages">
                        {
                            this.state.cqlEditorMessage ?
                            <div className="cql-editor-message"
                                    dangerouslySetInnerHTML={{__html: this.state.message.get(this.props.sourceId)}} /> : null
                        }
                    </div>
                </div>
            );
        }
    }


    return {
        CQLEditor: CQLEditor,
        CQLEditorFallback: CQLEditorFallback
    };


}