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
        const renderedChildren = List.reduce(
            (acc, curr, i) => {
                if (curr instanceof TreeNode && curr.element === 'noSpace') {
                    return acc.slice(0, -1);
                }

                acc.push(curr instanceof TreeNode ? curr.renderNode(i) : curr);
                if (i !== this.children.length - 1) {
                    if (curr instanceof TreeNode && ['doc', 'text'].includes(curr.element)) {
                        return acc;
                    }
                    acc.push(' ');
                }
                return acc;
            },
            [],
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
            case 'del':
                return <del key={index}>{renderedChildren}</del>;
            case 'sup':
                return <sup key={index}>{renderedChildren}</sup>;
            case 'sub':
                return <sub key={index}>{renderedChildren}</sub>;
            case 'mark':
                return <mark key={index}>{renderedChildren}</mark>;
            case 'div':
                return <div key={index}>{renderedChildren}</div>;
            case 'doc':
                return <div key={index} className={index === 0 ? null : "document"}>{renderedChildren}</div>;
            case 'text':
                return <div key={index} className={index === 0 ? null : "text"}>{renderedChildren}</div>;
            case 'span':
                return <span key={index}>{renderedChildren}</span>;
            case 'sentence':
                return <span key={index} className="sentence">{renderedChildren}</span>;
            default:
                console.warn(`Unknown element type, can not render: ${this.element}`);
                return <span key={index}>{renderedChildren}</span>;
        }
    }
}

interface AttrMapping {
    attr:string;
    map:{[attrValue:string]:string};
}

function isAttrMapping(object):object is AttrMapping {
    return object instanceof Object && 'attr' in object && 'map' in object;
}

interface ElementConf {
    element:string;
    attribute:string;
}

interface FeatureConf {
    paragraph?:ElementConf;
    newLine?:ElementConf;
    removeSpace?:ElementConf;
    typeface?:ElementConf;
    sentence?:ElementConf;
    text?:ElementConf;
    document?:ElementConf;
}

const typefaceMap = {
    bold: 'b',
    italic: 'i',
    underline: 'u',
    overstrike: 'del',
    superscript: 'sup',
    subscript: 'sub',
    default: 'span'
}

function getStructMapping(featureConf:FeatureConf) {
    const mapping = {};
    if (featureConf.paragraph) {
        mapping[featureConf.paragraph.element] = 'p';
    }
    if (featureConf.removeSpace) {
        mapping[featureConf.removeSpace.element] = 'noSpace';
    }
    if (featureConf.newLine) {
        mapping[featureConf.newLine.element] = 'br';
    }
    if (featureConf.typeface) {
        mapping[featureConf.typeface.element] = {attr: featureConf.typeface.attribute, map: typefaceMap};
    }
    if (featureConf.sentence) {
        mapping[featureConf.sentence.element] = 'sentence';
    }
    if (featureConf.text) {
        mapping[featureConf.text.element] = 'text';
    }
    if (featureConf.document) {
        mapping[featureConf.document.element] = 'doc';
    }
    return mapping;
}

export function init(he:Kontext.ComponentHelpers):React.FC<FormattedTextRendererProps> {

    const FormattedTextRenderer:React.FC<FormattedTextRendererProps> = (props) => {
        const structMapping = getStructMapping(props.data.features);
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
                                if (isAttrMapping(mappedTag)) {
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
                            if (isAttrMapping(mappedTag)) {
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
                                return ['br', 'noSpace'].includes(mappedTag) ? activeNode : lowerNode;
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