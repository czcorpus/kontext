/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

import { List, pipe } from 'cnc-tskit';
import * as React from 'react';
import { AjaxResponse } from '../../../types/ajaxResponses';
import { Kontext } from '../../../types/common';


export interface FormattedTextRendererProps {
    data:AjaxResponse.WideCtx;
}


class TreeNode {
    element:string;
    children:Array<TreeNode|string>;
    parent:TreeNode;

    constructor(element:string, children:Array<TreeNode|string>, parent:TreeNode) {
        this.element = element;
        this.children = children;
        this.parent = parent;
    }

    addChild(node:TreeNode) {
        this.children.push(node);
    }
}

const typefaceMap = {
    bold: 'b',
    italic: 'i',
    underline: 'u',
    overstrike: '???',
    superscript: 'sup',
    subscript: 'sub'
}

const mapping = {
    p: 'p',
    lb: 'br',
    hi: {
        attr: 'rend',
        map: typefaceMap
    }
}


export function init(he:Kontext.ComponentHelpers):React.FC<FormattedTextRendererProps> {

    const FormattedTextRenderer:React.FC<FormattedTextRendererProps> = (props) => {
        const root = new TreeNode('root', [], null);
        pipe(
            props.data.content,
            List.flatMap(
                v => {    
                    if (v.class === 'strc') {
                        const matches = v.str.match(/<.+?>/g);
                        const splits = v.str.split(/<.+?>/g);
                        const tmp = [];
                        for (let i = 0; i<splits.length; i++) {
                            if (splits[i]) tmp.push({str: splits[i], class: ''});
                            if (i < matches.length) tmp.push({str: matches[i], class: 'strc'});
                        }
                        return tmp;
                    }
                    
                    return [v];
                }
            ),
            List.reduce(
                (activeNode, curr) => {
                    if (curr.class === 'strc') {
                        // handle closing tags
                        if (curr.str.startsWith('<\/')) {
                            const tagName = /<\/(\w+)>/g.exec(curr.str)[1];
                            const mappedTag = mapping[tagName];

                            if (mappedTag) {
                                // ignoring unknown attributed tag
                                if (mappedTag instanceof Object) {
                                    return activeNode
                                
                                // handling closing tag
                                } else if (activeNode.parent && activeNode.element === mappedTag) {
                                    return activeNode.parent;
                                
                                // handling closing tag when missing opening tag
                                } else {
                                    const upperNode = new TreeNode(mappedTag, activeNode.children, activeNode);
                                    activeNode.children = [upperNode];
            
                                    return activeNode;
                                }
                            }
                            
                            console.warn(`Unknown tag/attr: ${curr.str}`);
                            activeNode.addChild(curr.str);
                            return activeNode;
                        
                        // handle opening tags
                        } else {
                            const tagName = /<(\w+).*?>/g.exec(curr.str)[1];
                            let mappedTag = mapping[tagName];
                            if (mappedTag instanceof Object) {
                                const re = new RegExp(`<.*?${mappedTag.attr}="(\w+)">`, 'g');
                                const attrValue = re.exec(curr.str)[1];
                                mappedTag = mappedTag.map[attrValue]
                            }

                            if (mappedTag) {
                                const lowerNode = new TreeNode(mappedTag, [], activeNode);
                                activeNode.addChild(lowerNode);
        
                                return lowerNode;
                            }

                            console.warn(`Unknown tag/attr: ${curr.str}`);
                            activeNode.addChild(curr.str);
                            return activeNode;        
                        }
                    
                    // searched word
                    } else if (curr.class === 'coll') {
                        const wrapper = new TreeNode('mark', [curr.str], activeNode);
                        activeNode.addChild(wrapper);
                    
                    // plain text contents
                    } else {
                        activeNode.addChild(curr.str);
                    }

                    return activeNode;    
                },
                root
            )
        );

        console.log(root);        
        
        return (
            <div>FORMATTED TEXT ---
                {List.map(v => v.str, props.data.content)}
            </div>
        );
    };


    return FormattedTextRenderer;

}