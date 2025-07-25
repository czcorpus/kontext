/*
 * Copyright (c) 2015 Department of Linguistics
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

/*
 * Common types and functions used by plug-in objects
 */

import {CorplistItem} from '../corparch/common.js';

/**
 * Generalized corplist item which may refer to a single
 * corpus, subcorpus, corpus with aligned corpora.
 */
export interface CorplistItemUcnk extends CorplistItem {
    requestable: boolean;
}

export function corplistItemIsUcnk(item:CorplistItem):item is CorplistItemUcnk {
    return item['requestable'] !== undefined;
}



