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


interface SingleLineInputProps {
    sourceId:string;
    refObject:React.RefObject<HTMLSpanElement>;
    hasHistoryWidget:boolean;
    historyIsVisible:boolean;
    takeFocus:boolean;
    onReqHistory:()=>void;
    onEsc:()=>void;
}


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    queryModel:QueryFormModel<QueryFormModelState>,
):React.ComponentClass<SingleLineInputProps> {


    // ------------------- <SingleLineInput /> -----------------------------

    class SingleLineInput extends React.PureComponent<SingleLineInputProps & QueryFormModelState> {

        private readonly contentEditable:ContentEditable<HTMLSpanElement>;

        constructor(props) {
            super(props);
            this.handleInputChange = this.handleInputChange.bind(this);
            this.handleKeyDown = this.handleKeyDown.bind(this);
            this.handleKeyUp = this.handleKeyUp.bind(this);
            this.handleClick = this.handleClick.bind(this);
            this.contentEditable = new ContentEditable<HTMLSpanElement>(props.refObject);
        }


        private handleInputChange(evt:React.ChangeEvent<HTMLInputElement>) {
            const src = this.contentEditable.extractText(this.props.refObject.current);
            const [rawAnchorIdx, rawFocusIdx] = this.contentEditable.getRawSelection(src);
            const query = src.map(v => v[0]).join('');

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
                const src = this.contentEditable.extractText(this.props.refObject.current);
                const [anchorIdx, focusIdx] = this.contentEditable.getRawSelection(src);
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

        private handleClick(evt) {
            if (this.props.refObject.current) {
                const src = this.contentEditable.extractText(this.props.refObject.current);
                const [rawAnchorIdx, rawFocusIdx] = this.contentEditable.getRawSelection(src);
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

        componentDidUpdate(prevProps, prevState) {
            if (this.props.rawAnchorIdx !== null && this.props.rawFocusIdx !== null) {
                this.contentEditable.reapplySelection(
                    this.props.rawAnchorIdx[this.props.sourceId],
                    this.props.rawFocusIdx[this.props.sourceId]
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
                        dangerouslySetInnerHTML={{__html: this.props.queries[this.props.sourceId].query}} />
            );
        }
    }

    return BoundWithProps<SingleLineInputProps, QueryFormModelState>(SingleLineInput, queryModel);
}
