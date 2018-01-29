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
/// <reference path="../../types/common.d.ts" />

import * as React from 'vendor/react';



export interface CQLEditorProps {
    attachCurrInputElement:(elm:HTMLElement)=>void;
    handleInputChange:(v:string)=>void;
    query:string;
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

    const CQLEditor = (props:CQLEditorProps) => {

        const extractText = (root:Node) => {
            const ans:Array<string> = [];
            Array.from(root.childNodes).forEach(elm => {
                switch (elm.nodeType) {
                    case Node.TEXT_NODE:
                        ans.push(elm.textContent);
                    break;
                    case Node.ELEMENT_NODE:
                        ans.splice(ans.length, 0, ...extractText(elm));
                    break;
                }
            });
            return ans.join('');
        };

        const updateEditor = (v) => {
            const src = extractText(v.target);
            props.handleInputChange(src);
        };

        return <pre contentEditable={true}
                        onInput={updateEditor}
                        className="cql-input"
                        style={{width: '40em', height: '3em'}}
                        ref={item => props.attachCurrInputElement(item)}
                        onChange={props.handleInputChange} value={props.query}
                        onKeyDown={props.inputKeyHandler} />;
    }


    return {
        CQLEditor: CQLEditor,
        CQLEditorFallback: CQLEditorFallback
    };


}