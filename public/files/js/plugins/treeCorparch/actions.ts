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
import { Node } from './init';


export enum ActionName {
    SetNodeStatus = 'TREE_CORPARCH_SET_NODE_STATUS',
    Deactivate = 'TREE_CORPARCH_DEACTIVATE',
    GetData = 'TREE_CORPARCH_GET_DATA',
    GetDataDone = 'TREE_CORPARCH_GET_DATA_DONE',
    LeafNodeClicked = 'TREE_CORPARCH_LEAF_NODE_CLICKED',
}


export namespace Actions {

    export interface SetNodeStatus extends Action<{
        nodeId:string;
    }> {
        name:ActionName.SetNodeStatus;
    }

    export interface Deactivate extends Action<{
    }> {
        name:ActionName.Deactivate;
    }

    export interface GetData extends Action<{
    }> {
        name:ActionName.GetData;
    }

    export interface GetDataDone extends Action<{
        node:Node;
        nodeActive:{[key:string]:boolean};
    }> {
        name:ActionName.GetDataDone;
    }

    export interface LeafNodeClicked extends Action<{
        ident:string;
    }> {
        name:ActionName.LeafNodeClicked;
    }

}