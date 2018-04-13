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

import {Kontext} from '../../types/common';
import { StatefulModel } from '../../models/base';
import { IPluginApi } from '../../types/plugins';
import * as Immutable from 'immutable';
import { ActionPayload } from '../../app/dispatcher';
import RSVP from 'rsvp';

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
}

function isCorplistNodeServer(n:CorplistNodeServer|CorplistNodeServerResponse):n is CorplistNodeServer {
    return (<CorplistNodeServerResponse>n).messages === undefined;
}

export interface CorplistNodeServerResponse extends Kontext.AjaxConcResponse {
    corplist:Array<CorplistNodeServer>;
    sort_corplist:Array<CorplistNodeServer>; // TODO this can be generated on client (=> 50% less data via network)
}

export enum NodeAccess {
    ANONYMOUS = 'anonymous',
    AUTHENTICATED = 'authenticated'
}

/**
 * Corplist node as used by this model
 */
export interface Node {
    ident?:string;
    name:string;
    size: number,
    description:string;
    access:Immutable.List<NodeAccess>; // TODO why array?
    active:boolean;
    repo:string;
    pmltq:string;
    level:string; // TODO where is this actually generated?
    language?:Immutable.List<string>;
    features:Immutable.List<string>;
    corplist:Immutable.List<Node>;
}

/**
 *
 */
export class TreeWidgetModel extends StatefulModel {

    protected pluginApi:IPluginApi;

    private data:Node;

    private sortedCorplist?:Immutable.List<Node>;

    private permittedCorpora:Immutable.List<string>;

    private idMap:Immutable.Map<string, Node>;

    private widgetId:number;

    private corpusIdent:Kontext.FullCorpusIdent;

    private corpusClickHandler:(ident: string) => void;

    constructor(pluginApi:IPluginApi, corpusIdent:Kontext.FullCorpusIdent,
                corpusClickHandler:(ident: string) => void) {
        super(pluginApi.dispatcher());
        this.pluginApi = pluginApi;
        this.corpusIdent = corpusIdent;
        this.corpusClickHandler = corpusClickHandler;
        this.idMap = Immutable.Map<string, Node>();
        this.data = {
            access: Immutable.List<NodeAccess>([NodeAccess.ANONYMOUS]),
            active: true,
            name: '',
            description: '',
            size: 0,
            repo: null,
            pmltq: null,
            level: null,
            features: Immutable.List<string>(),
            corplist: Immutable.List<Node>(),
        };
        this.sortedCorplist = Immutable.List<Node>();
        this.permittedCorpora = Immutable.List<string>();

        this.dispatcher.register(
            (payload:ActionPayload) => {
                switch (payload.actionType) {
                    case 'TREE_CORPARCH_SET_NODE_STATUS':
                        const item = this.idMap.get(payload.props['nodeId']);
                        item.active = !item.active;
                        this.notifyChangeListeners();
                        break;
                    case 'TREE_CORPARCH_GET_DATA':
                        this.loadData().then(
                            (d) => this.notifyChangeListeners()

                        ).catch(
                            (err) => {
                                this.pluginApi.showMessage('error', err);
                                this.notifyChangeListeners();
                            }
                        );
                        break;
                    case 'TREE_CORPARCH_LEAF_NODE_CLICKED':
                        this.corpusClickHandler(payload.props['ident']);
                        break;
                    case 'TREE_CORPARCH_SEARCH':
                        break;
                }
            }
        );
    }

    private importTree(serverNode:CorplistNodeServer|CorplistNodeServerResponse, nodeId:string='a',
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
                level: 'outer',
                language: Immutable.List<string>((serverNode.language || '').split(',')),
                access: Immutable.List<NodeAccess>((serverNode.access || ['anonymous']).map(x => x as NodeAccess)),
                features: Immutable.List<string>((serverNode.features || '').split(',')),
                corplist: null
            };

        } else {
            node = this.data;
            this.sortedCorplist = serverNode.sort_corplist ? Immutable.List<Node>(
                        serverNode.sort_corplist.map(c => this.importTree(c))) : undefined
        }
        if (serverNode.corplist) {
            node.ident = nodeId;
            this.idMap = this.idMap.set(nodeId, node);
            node.corplist = Immutable.List(
                serverNode.corplist.map((node, i) => this.importTree(node, `${nodeId}.${i}`))
            );

        } else {
            node.corplist = Immutable.List();
        }
        return node;
    }

    dumpNode(rootNode: Node): void {
        if (rootNode['corplist']) {
            rootNode['corplist'].forEach((item) => this.dumpNode(item));
        }
    }

    loadData():RSVP.Promise<any> {
        return RSVP.all([
            this.pluginApi.ajax<CorplistNodeServerResponse>(
                'GET',
                this.pluginApi.createActionUrl('corpora/ajax_get_corptree_data'),
                {}
            ),
            this.pluginApi.ajax<any>(
                'GET',
                this.pluginApi.createActionUrl('corpora/ajax_get_permitted_corpora'),
                {}
            )
        ]).then(
            (data) => {
                const [corptreeData, permittedCorpora] = data;
                this.setData(corptreeData);
                this.permittedCorpora = Immutable.List<string>(
                        Object.keys(permittedCorpora['corpora'] || {}));
            },
            (error) => {
                this.pluginApi.showMessage('error', error);
            }
        );
    }

    setData(data:CorplistNodeServerResponse):void {
        this.data = this.importTree(data);
    }

    getData():Node {
        return this.data;
    }

    getSortedData():Immutable.List<Node> {
        return this.sortedCorplist;
    }

    getPermittedCorpora():Immutable.List<string> {
        return this.permittedCorpora;
    }

    getCorpusIdent():Kontext.FullCorpusIdent {
        return this.corpusIdent;
    }
}
