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
import corparch from 'plugins/corparch/init';
import { KontextPage } from '../app/main';

declare var require:any;
 // weback - ensure a style (even empty one) is created for the page
require('styles/corplist.less');

/**
 * Initializes a corplist.tmpl page model.
 */
export function init(conf:Kontext.Conf, corplistData:any):void {
    const layoutModel = new KontextPage(conf);
    layoutModel.init(true, [], () => {
        const pagePlugin = corparch(
            layoutModel.pluginApi()).initCorplistPageComponents(corplistData);
        layoutModel.renderReactComponent(
            pagePlugin.getForm(),
            <HTMLElement>document.getElementById('content').querySelector('form.filter'),
            {}
        );

        layoutModel.renderReactComponent(
            pagePlugin.getList(),
            document.getElementById('corplist'),
            {
                anonymousUser:  layoutModel.getConf<boolean>('anonymousUser')
            }
        );
    });
}
