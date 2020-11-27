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

import { Keyboard, List } from 'cnc-tskit';
import * as React from 'react';


export class ContentEditable<T extends HTMLElement> {

    private readonly inputRef:React.RefObject<T>;

    constructor(inputRef:React.RefObject<T>,) {
        this.inputRef = inputRef;
    }

    extractText(root:Node) {
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

    reapplySelection(rawAnchorIdx:number, rawFocusIdx:number) {
        const sel = window.getSelection();
        const src = this.extractText(this.inputRef.current);

        const ans = List.foldl(
            (acc, [text, node]) => {
                const nodeStartIdx = acc.currIdx;
                const nodeEndIdx = nodeStartIdx + text.length;
                if (nodeStartIdx <= rawAnchorIdx && rawAnchorIdx <= nodeEndIdx) {
                    acc.anchorNode = node as T;
                    acc.anchorIdx = rawAnchorIdx - nodeStartIdx;
                }
                if (nodeStartIdx <= rawFocusIdx && rawFocusIdx <= nodeEndIdx) {
                    acc.focusNode = node as T;
                    acc.focusIdx = rawFocusIdx - nodeStartIdx;
                }
                acc.currIdx += text.length;
                return acc;
            },
            {
                anchorNode: this.inputRef.current,
                focusNode: this.inputRef.current,
                currIdx: 0,
                anchorIdx: 0,
                focusIdx: 0
            },
            src
        );
        sel.setBaseAndExtent(ans.anchorNode, ans.anchorIdx, ans.focusNode, ans.focusIdx);
    }

    getRawSelection(src:Array<[string, Node]>) {
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

    ffKeyDownHandler(
        evt:KeyboardEvent,
        onSetInput:(
            query:string,
            rawAnchorIdx:number,
            rawFocusIdx:number,
            insertRange:[number, number]|null
        )=>void,
        onMoveCursor:(
            rawAnchorIdx:number,
            rawFocusIdx:number,
        )=>void
    ) {

        if (evt.keyCode === Keyboard.Code.BACKSPACE || evt.keyCode === Keyboard.Code.DEL) {
            const src = this.extractText(this.inputRef.current);
            const [rawAnchorIdx, rawFocusIdx] = this.getRawSelection(src);
            const rawSrc = src.map(v => v[0]).join('');

            if (rawAnchorIdx === rawFocusIdx) {
                const query = evt.keyCode === Keyboard.Code.BACKSPACE ?
                        rawSrc.substring(0, rawAnchorIdx - 1) + rawSrc.substring(rawFocusIdx) :
                        rawSrc.substring(0, rawAnchorIdx) + rawSrc.substring(rawFocusIdx + 1);
                onSetInput(
                    query,
                    evt.keyCode === Keyboard.Code.BACKSPACE ? rawAnchorIdx - 1 : rawAnchorIdx,
                    evt.keyCode === Keyboard.Code.BACKSPACE ? rawFocusIdx - 1 : rawFocusIdx,
                    null
                );

            } else if (rawAnchorIdx < rawFocusIdx) {
                const query = rawSrc.substring(0, rawAnchorIdx) + rawSrc.substring(rawFocusIdx);
                onSetInput(
                    query,
                    evt.keyCode === Keyboard.Code.BACKSPACE ? rawAnchorIdx : rawAnchorIdx,
                    evt.keyCode === Keyboard.Code.BACKSPACE ? rawAnchorIdx : rawAnchorIdx,
                    null
                );

            } else {
                const query = rawSrc.substring(0, rawFocusIdx) + rawSrc.substring(rawAnchorIdx);
                onSetInput(
                    query,
                    evt.keyCode === Keyboard.Code.BACKSPACE ? rawFocusIdx : rawFocusIdx,
                    evt.keyCode === Keyboard.Code.BACKSPACE ? rawFocusIdx : rawFocusIdx,
                    null
                );
            }
            evt.preventDefault();

        } else if (evt.keyCode === Keyboard.Code.ENTER && evt.shiftKey) {
            const src = this.extractText(this.inputRef.current);
            const [rawAnchorIdx, rawFocusIdx] = this.getRawSelection(src);
            const query = src.map(v => v[0]).join('');
            onSetInput(
                    // We have to add a single whitespace here because otherwise FF cannot
                    // handle cursor position properly (normally it inserts its custom br
                    // type=_moz element which is even worse to handle). This is not ideal but
                    //  by far the most cheap solution.
                    rawFocusIdx === query.length ? '\n ' : '\n',
                    rawFocusIdx === query.length ? rawAnchorIdx + 2 : rawAnchorIdx + 1,
                    rawFocusIdx === query.length ? rawFocusIdx + 2 : rawFocusIdx + 1,
                    [rawAnchorIdx, rawFocusIdx]
            );
            evt.preventDefault();

        } else if (evt.keyCode === Keyboard.Code.END) {
            const src = this.extractText(this.inputRef.current);
            const [anchorIdx, focusIdx] = this.getRawSelection(src);
            const query = src.map(v => v[0]).join('');
            onMoveCursor(
                anchorIdx === focusIdx ? query.length : anchorIdx,
                query.length
            );
            evt.preventDefault();
        }
    }

}