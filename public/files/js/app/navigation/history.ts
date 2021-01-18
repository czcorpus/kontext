/*
 * Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Kontext } from '../../types/common';


 /**
 * NullHistory is a fallback object to be used
 * in browsers where HTML5 history is not available.
 * (but the truth is, it won't help much anyway
 * as many different issues remain unsolved in
 * case of outdated browsers)
 */
export class NullHistory implements Kontext.IHistory {
    replaceState<T>(action:string, args:Kontext.IMultiDict<T>, stateData?:any, title?:string):void {}
    pushState<T>(action:string, args:Kontext.IMultiDict<T>, stateData?:any, title?:string):void {}
    setOnPopState(fn:(event:PopStateEvent)=>void):void {}
}



/**
 * A simple wrapper around window.history object
 * with more convenient API.
 */
export class History implements Kontext.IHistory {

    private h:Kontext.IURLHandler;

    constructor(urlHandler:Kontext.IURLHandler) {
        this.h = urlHandler;
    }

    /**
     * Replace the current state with the one specified by passed arguments.
     *
     * @param action action name (e.g. 'query', 'subcorpus/list')
     * @param args a multi-dict instance containing URL arguments to be used
     * @param stateData (just like in window.history.replaceState)
     * @param title (just like in window.history.replaceState), default is window.document.title
     */
    replaceState<T>(action:string, args:Kontext.IMultiDict<T>, stateData?:any, title?:string):void {
        if (/^https?:\/\//.exec(action)) {
            throw new Error('Invalid action specifier (cannot use URL here)');
        }
        window.history.replaceState(
            stateData || {},
            title || window.document.title,
            `${this.h.createActionUrl(action)}?${this.h.encodeURLParameters(args)}`
        );
    }

    /**
     * Push a new state
     *
     * @param action action name (e.g. 'query', 'subcorpus/list')
     * @param args a multi-dict instance containing URL arguments to be used
     * @param stateData (just like in window.history.replaceState)
     * @param title (just like in window.history.replaceState), default is window.document.title
     */
    pushState<T>(action:string, args:Kontext.IMultiDict<T>, stateData?:any, title?:string):void {
        if (/^https?:\/\//.exec(action)) {
            throw new Error('Invalid action specifier (cannot use URL here)');
        }
        window.history.pushState(
            stateData || {},
            title || window.document.title,
            `${this.h.createActionUrl(action)}?${this.h.encodeURLParameters(args)}`
        );
    }

    setOnPopState(fn:(event:PopStateEvent)=>void):void {
        window.onpopstate = fn;
    }
}


export function createHistory(urlHandler:Kontext.IURLHandler):Kontext.IHistory {
    if (window.history && 'pushState' in window.history) {
        return new History(urlHandler);

    } else {
        return new NullHistory();
    }
}