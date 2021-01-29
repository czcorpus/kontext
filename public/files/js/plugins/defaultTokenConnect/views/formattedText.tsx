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

import { Dict, List, pipe, tuple } from 'cnc-tskit';
import * as React from 'react';
import { AjaxResponse } from '../../../types/ajaxResponses';
import { Kontext } from '../../../types/common';


export interface FormattedTextRendererProps {
    data:AjaxResponse.WideCtx;
}


class TreeNode {
    element:string;
    className:string;
    children:Array<TreeNode|string>;
    parent:TreeNode;

    // because some elements produce more that one target elements (<hi rend=bold italic>) we
    // need to keep track of how many elements are actually in the group to be able to move
    // the 'current node' pointer in the target tree.
    hasGroupParent:boolean;

    constructor(element:string, children:Array<TreeNode|string>, parent:TreeNode, hasGroupParent:boolean=false) {
        this.element = element;
        this.children = children;
        this.parent = parent;
        this.hasGroupParent = hasGroupParent;
        this.className = '';
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
                return <p key={index} className={this.className}>{renderedChildren}</p>;
            case 'br':
                return <br key={index}/>;
            case 'b':
                return <b key={index} className={this.className}>{renderedChildren}</b>;
            case 'i':
                return <i key={index} className={this.className}>{renderedChildren}</i>;
            case 'u':
                return <u key={index} className={this.className}>{renderedChildren}</u>;
            case 'del':
                return <del key={index} className={this.className}>{renderedChildren}</del>;
            case 'sup':
                return <sup key={index} className={this.className}>{renderedChildren}</sup>;
            case 'sub':
                return <sub key={index} className={this.className}>{renderedChildren}</sub>;
            case 'mark':
                return <mark key={index} className={this.className}>{renderedChildren}</mark>;
            case 'div':
                return <div key={index} className={this.className}>{renderedChildren}</div>;
            case 'doc':
                return <div key={index} className={index === 0 ? this.className : `${this.className} document`}>{renderedChildren}</div>;
            case 'text':
                return <div key={index} className={index === 0 ? this.className : `${this.className} text`}>{renderedChildren}</div>;
            case 'span':
                return <span key={index} className={this.className}>{renderedChildren}</span>;
            case 'sentence':
                return <span key={index} className={`${this.className} sentence`}>{renderedChildren}</span>;
            default:
                console.warn(`Unknown element type, can not render: ${this.element}`);
                return <span key={index} className={this.className}>{renderedChildren}</span>;
        }
    }
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

type TargetFormattingElms = 'b'|'i'|'u'|'del'|'sup'|'sub'|'span';

interface TypefaceMap {
    bold:'b';
    italic:'i';
    underline:'u';
    overstrike:'del';
    superscript:'sup';
    subscript:'sub';
    default:'span';
}

type TypefaceElm = {
    attr:string;
    map:TypefaceMap;
}

function isTypefaceElm(v:any):v is TypefaceElm {
    return v instanceof Object && v['attr'] !== undefined && v['map'] !== undefined;
}

const typefaceMap:TypefaceMap = {
    bold: 'b',
    italic: 'i',
    underline: 'u',
    overstrike: 'del',
    superscript: 'sup',
    subscript: 'sub',
    default: 'span'
}

type NormalizedElements = 'p'|'noSpace'|'br'|'sentence'|'text'|'doc';

function getStructMapping(featureConf:FeatureConf):{[srcElm:string]:NormalizedElements|TypefaceElm} {
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
        rootNode.className = 'formatted-text';
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
                                if (isTypefaceElm(mappedTag)) {
                                    if (activeNode.parent && Dict.hasValue(activeNode.element, mappedTag.map)) {
                                        let trueActiveNode = activeNode;
                                        while (trueActiveNode.hasGroupParent) {
                                            trueActiveNode = trueActiveNode.parent;
                                        }
                                        return trueActiveNode.parent;
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
                            const mappedTag = structMapping[tagName];
                            let targetTags:Array<string>;
                            if (isTypefaceElm(mappedTag)) {
                                const re = new RegExp(`${mappedTag.attr}=([\\w\\s]+)`);
                                const attrSrch = re.exec(curr.str);
                                if (attrSrch) {
                                    targetTags = pipe(
                                        attrSrch[1].trim().split(/\s+/),
                                        List.map(attr => mappedTag.map[attr]),
                                        List.foldl(
                                            (acc, curr) => {
                                                acc.push(curr);
                                                return acc;
                                            },
                                            []
                                        )
                                    );

                                } else {
                                    console.warn(`Attr '${mappedTag.attr}' not found in '${curr.str}'. Using default element.`);
                                    targetTags = [mappedTag.map['default']];
                                }

                            } else {
                                targetTags = [mappedTag];
                            }
                            return pipe(
                                targetTags,
                                List.map((t, i) => tuple(t, i)),
                                List.foldl(
                                    (acc, [elm, i]) => {
                                        const isSelfClosing = elm === 'br' || elm === 'noSpace';
                                        const hasGroupParent = i > 0 && !isSelfClosing;
                                        const newChildNode = new TreeNode(elm, [], acc, hasGroupParent);
                                        acc.addChild(newChildNode);
                                        return isSelfClosing ? acc : newChildNode;
                                    },
                                    activeNode
                                )
                            );
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