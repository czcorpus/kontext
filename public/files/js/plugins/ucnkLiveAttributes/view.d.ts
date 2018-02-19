/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
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

/// <reference path="../../types/plugins.d.ts" />
/// <reference path="../../types/common.d.ts" />
/// <reference path="../../vendor.d.ts/react.d.ts" />

export interface LiveAttributesViews {
    LiveAttrsView:any;
    LiveAttrsCustomTT:any;
}

export function init(
    dispatcher:Kontext.ActionDispatcher,
    componentHelpers:Kontext.ComponentHelpers,
    subcMixerComponent:React.ComponentClass,
    textTypesStore:Kontext.PageStore,
    liveAttrsStore:Kontext.PageStore
):LiveAttributesViews;

