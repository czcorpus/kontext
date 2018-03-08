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

import {Kontext} from '../types/common';
import {PageModel} from '../app/main';
import * as corparch from 'plugins/corparch/init';

declare var require:any;
 // weback - ensure a style (even empty one) is created for the page
require('styles/corplist.less');

/**
 * Initializes a corplist.tmpl page model.
 */
export function init(conf:Kontext.Conf, corplistParams, corplistData):void {
    const layoutModel = new PageModel(conf);
    layoutModel.init().then(
        () => {
            const pagePlugin = corparch.initCorplistPageComponents(layoutModel.pluginApi());
            pagePlugin.setData(corplistData);
            layoutModel.renderReactComponent(
                pagePlugin.getForm(),
                <HTMLElement>document.getElementById('content').querySelector('form.filter'),
                corplistParams
            );

            corplistData['anonymousUser'] = layoutModel.getConf('anonymousUser'); // TODO not a very good solution
            layoutModel.renderReactComponent(
                pagePlugin.getList(),
                document.getElementById('corplist'),
                corplistData
            );
        }

    ).then(
        layoutModel.addUiTestingFlag

    ).catch(
        (err) => console.error(err)
    );
}
