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

import * as Kontext from '../types/kontext';
import { KontextPage } from '../app/main';
import corparch from 'plugins/corparch/init';


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
            document.getElementById('content').querySelector('form.filter') as HTMLElement,
            {}
        );

        layoutModel.renderReactComponent(
            pagePlugin.getList(),
            document.getElementById('corplist-mount-point'),
            {
                anonymousUser:  layoutModel.getConf<boolean>('anonymousUser')
            }
        );
    });
}
