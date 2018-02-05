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


/// <reference path="../../vendor.d.ts/react.d.ts" />
/// <reference path="../../vendor.d.ts/immutable.d.ts" />
/// <reference path="../../types/common.d.ts" />

import * as React from 'vendor/react';
import {highlightSyntax, AttrHelper} from '../../cqlsh/main';


export interface CQLEditorProps {
    query:string;
    attrList:Immutable.List<{n:string; label:string}>;
    structAttrList:Immutable.List<{n:string; label:string}>;
    attachCurrInputElement:(elm:HTMLElement)=>void;
    handleInputChange:(v:string)=>void;
    inputKeyHandler:(evt:KeyboardEvent)=>void;
}

export interface CQLEditorViews {
    CQLEditorFallback:React.ComponentClass;
    CQLEditor:React.ComponentClass;
}


export function init(dispatcher:Kontext.FluxDispatcher, he:Kontext.ComponentHelpers) {


    // ------------------- <CQLEditorFallback /> -----------------------------

    const CQLEditorFallback = (props:CQLEditorProps) => {

        return <textarea className="cql-input" rows="2" cols="60" name="cql"
                            ref={item => props.attachCurrInputElement(item)}
                            onChange={props.handleInputChange} value={props.query}
                            onKeyDown={props.inputKeyHandler} />;
    }

    // ------------------- <CQLEditor /> -----------------------------

    class CQLEditor extends React.Component<CQLEditorProps, {}> {

        private editorRoot:Node;

        private attrHelper:AttrHelper;

        constructor(props:CQLEditorProps) {
            super(props);
            this.editorRoot = null;
            this.attrHelper = new AttrHelper(props.attrList, props.structAttrList);
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

        private reapplySelection(root:Node, rawAnchorIdx:number, rawFocusIdx:number) {
            const sel = window.getSelection();
            const src = this.extractText(root);
            let anchorNode = root;
            let focusNode = root;
            let currIdx = 0;
            let anchorIdx = 0;
            let focusIdx = 0;

            src.forEach(([text, node]) => {
                const nodeStartIdx = currIdx;
                const nodeEndIdx = nodeStartIdx + text.length;
                if (nodeStartIdx <= rawAnchorIdx && rawAnchorIdx <= nodeEndIdx) {
                    anchorNode = node;
                    anchorIdx = rawAnchorIdx - nodeStartIdx;
                }
                if (nodeStartIdx <= rawFocusIdx && rawFocusIdx <= nodeEndIdx) {
                    focusNode = node;
                    focusIdx = rawFocusIdx - nodeStartIdx;
                }
                currIdx += text.length;
            });
            sel.setBaseAndExtent(anchorNode, anchorIdx, focusNode, focusIdx);
        }

        private getRawSelection(src:Array<[string, Node]>) {
            const sel = window.getSelection();
            let rawAnchorIdx = 0;
            let rawFocusIdx = 0;
            let currIdx = 0;

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

        private updateEditor(elm) {
            const src = this.extractText(elm);
            const [rawAnchorIdx, rawFocusIdx] = this.getRawSelection(src);
            this.props.handleInputChange(src.map(v => v[0]).join(''));
            elm.innerHTML = highlightSyntax(src.map(v => v[0]).join(''), 'cql', he, this.attrHelper);
            this.reapplySelection(elm, rawAnchorIdx, rawFocusIdx);
        };

        private refFn(item) {
            this.props.attachCurrInputElement(item);
            this.editorRoot = item;
        }

        componentDidMount() {
            this.editorRoot.appendChild(document.createTextNode(this.props.query));
            this.updateEditor(this.editorRoot);
        }

        render() {
            return <pre contentEditable={true}
                            onInput={(evt) => this.updateEditor(evt.target)}
                            className="cql-input"
                            style={{width: '40em', height: '5em'}}
                            ref={(item) => this.refFn(item)}
                            onChange={this.props.handleInputChange} value={this.props.query}
                            onKeyDown={this.props.inputKeyHandler} />;
        }
    }


    return {
        CQLEditor: CQLEditor,
        CQLEditorFallback: CQLEditorFallback
    };


}