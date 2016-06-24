/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../types/plugins/abstract.d.ts" />
/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />

import $ = require('jquery');
import RSVP = require('vendor/rsvp');
import toolbar = require('plugins/applicationBar/toolbar');
import {AppBarStore} from './store';

export function create(pluginApi:Kontext.PluginApi):RSVP.Promise<Kontext.Plugin> {
    return new RSVP.Promise((resolve:(ans:Kontext.Plugin)=>void, reject:(e:any)=>void) => {
        let appBarStore = new AppBarStore(
            pluginApi,
            pluginApi.dispatcher(),
            () => {
                toolbar.openLoginDialog();
            }
        );
        resolve(null); // TODO
    });
}



