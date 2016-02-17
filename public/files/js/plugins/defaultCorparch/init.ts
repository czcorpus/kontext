/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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

/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../../ts/declarations/typeahead.d.ts" />
/// <reference path="../../../ts/declarations/common.d.ts" />
/// <reference path="../../../ts/declarations/flux.d.ts" />
/// <reference path="../../common/plugins/corparch.ts" />

/// <amd-dependency path="vendor/typeahead" />
/// <amd-dependency path="vendor/bloodhound" name="Bloodhound" />
/// <amd-dependency path="./view" name="views" />
declare var views:any;

import $ = require('jquery');
import util = require('../../util');
import common = require('./common');
import widget = require('./widget');
import corplist = require('./corplist');

/**
 *
 * @param pluginApi
 * @returns {CorplistPage}
 */
export function initCorplistPageComponents(pluginApi:Kontext.PluginApi):Customized.CorplistPage {
    return new corplist.CorplistPage(pluginApi, views);
}

/**
 * Creates a corplist widget which is a box containing two tabs
 *  1) user's favorite items
 *  2) corpus search tool
 *
 * @param selectElm A HTML SELECT element for default (= non JS) corpus selection we want to be replaced by this widget
 * @param pluginApi
 * @param options A configuration for the widget
 */
export function create(selectElm:HTMLElement, pluginApi:Kontext.QueryPagePluginApi,
                       options:CorpusArchive.Options):CorpusArchive.Widget {
    var corplist:widget.Corplist,
        data:Array<common.CorplistItem>;

    data = widget.fetchDataFromSelect(selectElm);
    corplist = new widget.Corplist(options, data, pluginApi, $(selectElm).closest('form').get(0));
    corplist.bind(selectElm);
    return corplist;
}
