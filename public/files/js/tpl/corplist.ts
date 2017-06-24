/*
 * Copyright (c) 2014 Institute of the Czech National Corpus
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

/// <reference path="../types/common.d.ts" />
/// <reference path="../types/plugins.d.ts" />

import $ = require('jquery');
import {PageModel} from './document';
import corparch = require('plugins/corparch/init');

/**
 * Initializes a corplist.tmpl page model.
 */
export function init(conf:Kontext.Conf, corplistParams, corplistData):void {
    let layoutModel = new PageModel(conf);
    layoutModel.init();
    let page = corparch.initCorplistPageComponents(layoutModel.pluginApi());
    page.createForm($('#content form.filter').get(0), corplistParams);
    page.createList($('#corplist').get(0), corplistData);
}
