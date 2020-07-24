/*
 * Copyright (c) 2016 Charles University, Faculty of Mathematics and Physics,
 *                    Institute of Formal and Applied Linguistics
 * Copyright (c) 2016 Charles University, Faculty of Arts,
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

import { Kontext } from '../../types/common';
import { IPluginApi } from '../../types/plugins';
import { Action, StatefulModel } from 'kombo';
import { forkJoin, Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { AjaxConcResponse } from '../../models/concordance/common';
import { List, HTTP } from 'cnc-tskit';
import { IUnregistrable } from '../../models/common/common';

export enum ParallelType {
    DEFAULT = 'default',
    COMPLEMENT = 'complement'
}

/**
 * A corplist node as returned by server
 * (i.e. with some string-encoded stuff like 'features')
 */
export interface CorplistNodeServer {
    ident:string;
    name:string;
    access:Array<string>;
    description:string;
    features:string;
    language:string; // TODO comma separated list of values?
    parallel:ParallelType;
    pmltq:string; // URL address
    repo:string;
    size:number;
    corplist?:Array<CorplistNodeServer>;
    permitted:boolean;
    tokenConnect:Array<string>;
}

/**
 * A helper interface used with ad hoc object when attaching
 * permitted flag to sorted corplist.
 */
interface CorplistWrapper {
    corplist:Array<CorplistNodeServer>;
}

/**
 * A TS type guard to distinguish between root corplist response
 * (which is kind of a root node of the tree),
 * actual tree nodes and ad-hoc corplist wrapper.
 */
function isCorplistNodeServer(n:CorplistNodeServer|CorplistNodeServerResponse|CorplistWrapper
        ):n is CorplistNodeServer {
    return (<CorplistNodeServerResponse>n).messages === undefined;
}

/**
 * A server response containing corplist data
 */
export interface CorplistNodeServerResponse extends AjaxConcResponse {
    corplist:Array<CorplistNodeServer>;
    // TODO this can be generated on client (=> 50% less data via network)
    sort_corplist:Array<CorplistNodeServer>;
}

/**
 * A response containing list of permitted corpora
 */
interface PermittedCorporaResponse extends AjaxConcResponse {
    permitted_corpora:{[corpusId:string]:string}; // corpus ID => corpus variant
}

export enum NodeAccess {
    ANONYMOUS = 'anonymous',
    AUTHENTICATED = 'authenticated'
}

/**
 * Corplist node as used by this model. It is derived from
 * CorplistNodeServer with additional data (e.g. permitted flag).
 */
export interface Node {
    ident?:string;
    name:string;
    size: number,
    description:string;
    access:Array<NodeAccess>; // TODO why array?
    active:boolean;
    repo:string;
    pmltq:string;
    level:string; // TODO where is this actually generated?
    language?:Array<string>;
    features:Array<string>;
    corplist:Array<Node>;
    permitted:boolean;
    tokenConnect:Array<string>;
}

/**
 *
 */
export class TreeWidgetModel extends StatefulModel<{}> implements IUnregistrable {

    protected readonly pluginApi:IPluginApi;

    private data:Node;

    private sortedCorplist?:Array<Node>;

    private widgetId:number;

    private corpusIdent:Kontext.FullCorpusIdent;

    private corpusClickHandler:(ident: string) => void;

    constructor(pluginApi:IPluginApi, corpusIdent:Kontext.FullCorpusIdent,
                corpusClickHandler:(ident: string) => void) {
        super(pluginApi.dispatcher(), {});
        this.pluginApi = pluginApi;
        this.corpusIdent = corpusIdent;
        this.corpusClickHandler = corpusClickHandler;
        this.data = {
            access: [NodeAccess.ANONYMOUS],
            active: true,
            name: '',
            description: '',
            size: 0,
            repo: null,
            pmltq: null,
            level: null,
            features: [],
            corplist: [],
            permitted: true,
            tokenConnect: [],
        };
        this.sortedCorplist = [];

        this.onAction((action:Action) => {
            switch (action.name) {
                case 'TREE_CORPARCH_SET_NODE_STATUS':
                    this.toggleNodeActiveStatus(action.payload['nodeId']);
                    this.emitChange();
                    break;
                case 'TREE_CORPARCH_EXPAND_ALL':
                    this.toggleAllNodesActiveStatus(true);
                    this.emitChange();
                    break;
                case 'TREE_CORPARCH_COLLAPSE_ALL':
                    this.toggleAllNodesActiveStatus(false);
                    this.emitChange();
                    break;
                case 'TREE_CORPARCH_GET_DATA':
                    this.loadData().subscribe(
                        (d) => this.emitChange(),
                        (err) => {
                            this.pluginApi.showMessage('error', err);
                            this.emitChange();
                        }
                    );
                    break;
                case 'TREE_CORPARCH_LEAF_NODE_CLICKED':
                    this.corpusClickHandler(action.payload['ident']);
                    break;
                case 'TREE_CORPARCH_SEARCH':
                    break;
            }
        });
    }

    getRegistrationId():string {
        return 'lindat-corparch-widget-1';
    }

    private toggleAllNodesActiveStatus(status:boolean):void {
        const srchRecursive = (nodePath:Array<Node>, status:boolean):void => {
            const curr = nodePath[nodePath.length - 1];
            if (curr.level === 'inner') {
                const nodePath = this.findNode([this.data], curr.ident);
                this.data = this.immutableUpdateTree(nodePath, (node) => {
                    node.active = status;
                });
            }
            for (let i = 0; i < curr.corplist.length; i +=1) {
                srchRecursive(List.concat([curr.corplist[i]], nodePath), status);
            }
        }

        srchRecursive([this.data], status);
    }

    private toggleNodeActiveStatus(nodeId:string):void {
        const nodePath = this.findNode([this.data], nodeId);
        this.data = this.immutableUpdateTree(nodePath, (node) => {
            node.active = !node.active;
        });
    }

    private copyNode(node:Node):Node {
        return {
            ident: node.ident,
            name: node.name,
            size: node.size,
            description: node.description,
            access: node.access,
            active: node.active,
            repo: node.repo,
            pmltq: node.pmltq,
            level: node.level,
            language: node.language,
            features: node.features,
            corplist: node.corplist,
            permitted: node.permitted,
            tokenConnect: node.tokenConnect,
        };
    }

    /**
     * Update last element in node path in an immutable way:
     * the node itself and all its parents change their instances.
     * This allows easy and consistent change detection in a respective
     * React component.
     */
    private immutableUpdateTree(nodePath:Array<Node>, mutationFn:(last:Node)=>void):Node {
        let last = this.copyNode(nodePath[nodePath.length - 1]);
        mutationFn(last);
        for (let i = nodePath.length - 2; i >= 0; i -= 1) {
            const curr = this.copyNode(nodePath[i]);
            const srchIdx = List.findIndex(v => v.ident === last.ident, curr.corplist);
            curr.corplist[srchIdx] = last;
            last = curr;
        }
        return last;
    }

    private findNode(nodePath:Array<Node>, ident:string):Array<Node>|null {

        const srchRecursive = (nodePath:Array<Node>, ident:string):Array<Node>|null => {
            const curr = nodePath[nodePath.length - 1];
            if (curr.ident === ident) {
                return nodePath;
            }
            for (let i = 0; i < curr.corplist.length; i +=1) {
                const srch = srchRecursive(List.concat([curr.corplist[i]], nodePath), ident);
                if (srch !== null) {
                    return srch;
                }
            }
            return null;
        }

        const ans = srchRecursive(nodePath, ident);
        if (Array.isArray(ans) && ans[ans.length - 1].ident === ident) {
            return ans;
        }
        return null;
    }

    private importTree(
        serverNode:CorplistNodeServer|CorplistNodeServerResponse,
        nodeId:string='a'
    ):Node {
        let node:Node;
        if (isCorplistNodeServer(serverNode)) {
            node = {
                ident: serverNode.ident,
                name: serverNode.name,
                description: serverNode.description,
                active: false,
                size: serverNode.size,
                repo: serverNode.repo,
                pmltq: serverNode.pmltq,
                level: nodeId.split('.').length <= 2 ? 'outer' : 'inner',
                language: (serverNode.language || '').split(','),
                access: (serverNode.access || ['anonymous']).map(x => x as NodeAccess),
                features: (serverNode.features || '').split(','),
                corplist: null,
                permitted: serverNode.permitted,
                tokenConnect: serverNode.tokenConnect,
            };

        } else {
            node = this.data;
            this.sortedCorplist = serverNode.sort_corplist ?
                List.map(c => this.importTree(c), serverNode.sort_corplist) :
                undefined
        }
        if (serverNode.corplist) {
            node.ident = nodeId;
            node.corplist = List.map((node, i) =>
                this.importTree(node, `${nodeId}.${i}`),
                serverNode.corplist
            )

        } else {
            node.corplist = [];
        }
        return node;
    }

    /**
     * Set the 'permitted' flag for Node instances so we don't have to
     * pass list of permitted corpora all around.
     */
    private attachPermittedFlag(corplistResp:CorplistNodeServerResponse, perm:Array<string>):void {
        const walkThru = (node:CorplistNodeServer|CorplistNodeServerResponse|CorplistWrapper) => {
            if (isCorplistNodeServer(node)) {
                if (node.corplist && node.corplist.length > 0) {
                    node.permitted = true; // groups are accessible no matter what

                } else {
                    node.permitted = perm.indexOf(node.ident) > -1;
                }

            }
            (node.corplist || []).forEach(c => walkThru(c));
        };
        walkThru(corplistResp);
        walkThru({corplist: corplistResp.sort_corplist});
    }

    /**
     * Just for debugging
     */
    dumpNode(rootNode:Node, indent=0): void {
        const indentSpc = [];
        for (let i = 0; i < indent; i += 1) {
            indentSpc.push(' ');
        }
        console.log(
            `${indentSpc.join('')}node[${rootNode.ident}]: ` +
            `active: ${rootNode.active}, name: ${rootNode.name}`
        );
        rootNode.corplist.forEach(v => this.dumpNode(v, indent + 4));
    }

    /**
     * Load corplist and permitted corpora from server
     */
    loadData():Observable<boolean> {
        return forkJoin(
            this.pluginApi.ajax$<CorplistNodeServerResponse>(
                HTTP.Method.GET,
                this.pluginApi.createActionUrl('corpora/ajax_get_corptree_data'),
                {}
            ),
            this.pluginApi.ajax$<PermittedCorporaResponse>(
                HTTP.Method.GET,
                this.pluginApi.createActionUrl('corpora/ajax_get_permitted_corpora'),
                {}
            )
        ).pipe(
            tap(([corptreeDataResp, permittedCorporaResp]) => {
                this.attachPermittedFlag(
                    corptreeDataResp,
                    Object.keys(permittedCorporaResp.permitted_corpora || {})
                );
                this.setData(corptreeDataResp);
            }),
            map(_ =>  true)
        );
    }

    setData(data:CorplistNodeServerResponse):void {
        this.data = this.importTree(data);
    }

    getData():Node {
        return this.data;
    }

    getSortedData():Array<Node> {
        return this.sortedCorplist;
    }

    getCorpusIdent():Kontext.FullCorpusIdent {
        return this.corpusIdent;
    }
}
