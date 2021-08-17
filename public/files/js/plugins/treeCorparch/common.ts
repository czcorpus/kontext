/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
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

import { Action } from 'kombo';
import { CorpusInfo } from '../../types/plugins/corparch';


export interface Corplist {
    ident:string;
    name:string;
    corplist:Array<Corplist|CorpusInfo>;
}

export function itemIsCorplist(item:Corplist|CorpusInfo):item is Corplist {
    return Array.isArray(item['corplist']);
}


export class Actions {

    static SetNodeStatus:Action<{
        nodeId:string;
    }> = {
        name: 'TREE_CORPARCH_SET_NODE_STATUS'
    };

    static Deactivate:Action<{
    }> = {
        name: 'TREE_CORPARCH_DEACTIVATE'
    };

    static GetData:Action<{
    }> = {
        name: 'TREE_CORPARCH_GET_DATA'
    };

    static GetDataDone:Action<{
        corplist:Corplist;
    }> = {
        name: 'TREE_CORPARCH_GET_DATA_DONE'
    };

    static LeafNodeClicked:Action<{
        ident:string;
    }> = {
        name: 'TREE_CORPARCH_LEAF_NODE_CLICKED'
    };

}