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

import { Dict, List, pipe } from 'cnc-tskit';
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

    addChild(child:TreeNode|string) {
        this.children.push(child);
    }

    renderNode(index:number=0) {
        const renderedChildren = List.map(
            (v, i) => v instanceof TreeNode ? v.renderNode(i) : v,
            this.children
        );

        switch (this.element) {
            case 'p':
                return <p key={index}>{renderedChildren}</p>;
            case 'br':
                return <br key={index}/>;
            case 'b':
                return <b key={index}>{renderedChildren}</b>;
            case 'i':
                return <i key={index}>{renderedChildren}</i>;
            case 'u':
                return <u key={index}>{renderedChildren}</u>;
            case '???':  // TODO
                return <span key={index}>{renderedChildren}</span>;
            case 'sup':
                return <sup key={index}>{renderedChildren}</sup>;
            case 'sub':
                return <sub key={index}>{renderedChildren}</sub>;
            case 'mark':
                return <mark key={index}> {renderedChildren} </mark>;
            case 'div':
                return <div key={index}>{renderedChildren}</div>;
            default:
                console.warn(`Unknown element type, can not render: ${this.element}`);
            case 'default':
                return <span key={index}>{renderedChildren}</span>;
        }
    }
}

class AttrMapping {
    attr:string;
    map:{[attrValue:string]:string};

    constructor(attr:string, map:{[attrValue:string]:string}) {
        this.attr = attr;
        this.map = map;
    }
}

const typefaceMap = {
    bold: 'b',
    italic: 'i',
    underline: 'u',
    overstrike: '???', // TODO
    superscript: 'sup',
    subscript: 'sub',
    default: 'default'
}

const structMapping:{[struct:string]:string|AttrMapping} = {
    p: 'p',
    lb: 'br', // children not expected
    hi: new AttrMapping('rend', typefaceMap)
}


export function init(he:Kontext.ComponentHelpers):React.FC<FormattedTextRendererProps> {

    const FormattedTextRenderer:React.FC<FormattedTextRendererProps> = (props) => {
        const rootNode = new TreeNode('div', [], null);

        pipe(
            props.data.content,
            // split content by xml tags (only strc classes)
            List.flatMap<{class:string, str:string}, {class:string, str:string}>(
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
            // build element tree from tags
            List.reduce(
                (activeNode, curr) => {
                    if (curr.class === 'strc') {
                        // handle closing tags
                        if (curr.str.startsWith('<\/')) {
                            const tagName = /<\/(\w+)>/g.exec(curr.str)[1];
                            const mappedTag = structMapping[tagName];

                            if (mappedTag) {
                                if (mappedTag instanceof AttrMapping) {
                                    if (activeNode.parent && Dict.hasValue(activeNode.element, mappedTag.map)) {
                                        return activeNode.parent;
                                    }
                                    // ignoring unknown attribute closing tag
                                    return activeNode;
                                
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
                            
                            console.warn(`Undefined tag mapping for ${curr.str}`);
                            return activeNode;
                        
                        // handle opening tags
                        } else {
                            const tagName = /<(\w+).*?>/g.exec(curr.str)[1];
                            let mappedTag = structMapping[tagName];
                            if (mappedTag instanceof AttrMapping) {
                                const re = new RegExp(`${mappedTag.attr}=(\\w+)`);
                                const attrValue = re.exec(curr.str);
                                if (attrValue) {
                                    mappedTag = mappedTag.map[attrValue[1]]
                                
                                } else {
                                    console.warn(`Attr '${mappedTag.attr}' not found in '${curr.str}'. Using default element.`);
                                    mappedTag = mappedTag.map['default'];
                                }
                            }

                            if (mappedTag) {
                                const lowerNode = new TreeNode(mappedTag, [], activeNode);
                                activeNode.addChild(lowerNode);
                                return mappedTag === 'br' ? activeNode : lowerNode;
                            }

                            console.warn(`Undefined tag mapping for ${curr.str}`);
                            return activeNode;        
                        }
                    
                    // searched word element
                    } else if (curr.class === 'coll') {
                        const wrapper = new TreeNode('mark', [curr.str], activeNode);
                        activeNode.addChild(wrapper);
                    
                    // plain text contents
                    } else {
                        activeNode.addChild(curr.str);
                    }

                    return activeNode;    
                },
                rootNode
            )
        );
        
        return rootNode.renderNode();
    };


    return FormattedTextRenderer;

}