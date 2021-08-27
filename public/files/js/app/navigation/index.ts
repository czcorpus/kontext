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

import { Observable } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ajax, AjaxError, AjaxResponse as RxAjaxResponse } from 'rxjs/ajax';
import { IFullActionControl } from 'kombo';
import { pipe, List, HTTP, Dict, tuple, URL } from 'cnc-tskit';

import * as Kontext from '../../types/kontext';
import { CorpusSwitchModel } from '../../models/common/corpusSwitch';
import { createHistory } from './history';
import { PageLeaveVoting, IPageLeaveVoter } from '../../models/common/pageLeave';
import { IUnregistrable } from '../../models/common/common';


/**
 * ajaxErrorMapped is a custom operator for ajax operations allowing mapping of
 * misc. HTTP return codes to custom errors. In case the thrown error is not AjaxError
 * or in case its return code has no mapping, original error is rethrown.
 *
 * @param mapping mapping [HTTP status code] => [error message]
 */
export function ajaxErrorMapped<T>(mapping:{[status:number]:string}):(src:Observable<T>)=>Observable<T> {
    return (src:Observable<T>) => src.pipe(
        catchError(
            err => {
                if (err instanceof AjaxError && mapping[err.status]) {
                    throw new Error(mapping[err.status])

                } else {
                    throw err;
                }
            }
        )
    );
}

/**
 * Parse a URL args string (k1=v1&k2=v2&...&kN=vN) into
 * a list of pairs [[k1, v1], [k2, v2],...,[kN, vN]]
 */
export function parseUrlArgs(args:string):Array<[string, string]> {
    return args.split('&').map<[string, string]>(item => {
        const tmp = item.split('=', 2);
        return [decodeURIComponent(tmp[0]), decodeURIComponent(tmp[1])];
    });
}

/**
 *
 */
interface AjaxRequestProps {
    accept:string,
    contentType:string,
    responseType:XMLHttpRequestResponseType,
    method:string,
    requestBody:string,
    url:string
}

/**
 * AppNavigation handles all the URL generation, window navigation,
 * AJAX requests and handling of navigation history.
 */
export class AppNavigation implements Kontext.IURLHandler, Kontext.IAjaxHandler {

    private conf:Kontext.IConfHandler;

    private history:Kontext.IHistory;

    public readonly corpusSwitchModel:CorpusSwitchModel;

    private readonly pageLeaveVoting:PageLeaveVoting;

    constructor(conf:Kontext.IConfHandler, dispatcher:IFullActionControl) {
        this.conf = conf;
        this.history = createHistory(this);
        this.corpusSwitchModel = new CorpusSwitchModel(this, dispatcher, conf, this.history);
        this.pageLeaveVoting = new PageLeaveVoting(dispatcher);
    }

    /**
     * Creates a temporary form with passed args and submits it
     * via POST method.
     *
     * @param path
     * @param args
     */
    setLocationPost<T>(path:string, args:T, blankWindow:boolean=false):void {
        const body = window.document.getElementsByTagName('body')[0];
        const form = window.document.createElement('form');
        form.setAttribute('method', 'post');
        form.setAttribute('action', path);
        if (blankWindow) {
            form.setAttribute('target', '_blank');
        }
        body.appendChild(form);
        pipe(
            args || {},
            Dict.toEntries(),
            List.filter(([,v]) => !!v),
            List.forEach(item => {
                const input = window.document.createElement('input');
                input.setAttribute('type', 'hidden');
                input.setAttribute('name', item[0]);
                input.setAttribute('value', item[1]);
                form.appendChild(input);
            })
        );
        form.submit();
        window.onbeforeunload = () => {
            body.removeChild(form);
        };
    }

    /**
     * Create a URL for a static resource (e.g. img/close-icon.svg)
     */
    createStaticUrl(path):string {
        if (typeof path !== 'string') {
            throw new Error(`Cannot create static url. Invalid path: ${path}`);
        }
        return this.conf.getConf<string>('staticPath') +
            (path.indexOf('/') === 0 ? '' : '/') + path;
    }

    /**
     * Create an URL from path suffix. E.g. passing
     * subcorpus/list will produce http://installed.domain/subcorpus/list.
     *
     * @path path suffix
     * @args arguments to be appended to the URL as parameters.
     * Undefined/null/empty string values and their respective names
     * are left out.
     */
    createActionUrl<T>(path:string, args?:T):string {
        if (typeof path !== 'string') {
            throw new Error(`Cannot create action url. Invalid path: ${path}`);
        }
        let urlArgs = '';
        if (args !== undefined) {
            urlArgs = pipe(
                args,
                URL.valueToPairs(),
                List.map(([key, value]) => `${key}=${value}`)
            ).join('&');
        }
        return this.conf.getConf('rootPath') +
                (path.indexOf('/') === 0 ? path.substr(1) : path) +
                (urlArgs ? '?' + urlArgs : '');
    }

    private prepareAjax(
        method:string,
        url:string,
        args:Kontext.AjaxArgs,
        options?:Kontext.AjaxOptions
    ):AjaxRequestProps {

        if (options === undefined) {
            options = {};
        }
        if (!options.accept) {
            options.accept = 'application/json';
        }
        if (!options.contentType) {
            options.contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
        }
        if (!options.responseType) {
            options.responseType = 'json';
        }

        function exportValue(v) {
            if (v === null || v === undefined) {
                return '';

            } else if (typeof v === 'boolean') {
                return ~~v;

            } else {
                return encodeURIComponent(v);
            }
        }

        function encodeArgs(obj:{[k:string]:any}):string {
            return pipe(
                obj,
                Dict.toEntries(),
                List.filter(([,v]) => v !== undefined),
                List.map(([k, v]) => {
                    if (Array.isArray(v)) {
                        return List.map(v2 => tuple(k, v2), v);
                    }
                    return [tuple(k, v)];
                }),
                List.flatMap(v => v),
                List.map(([k, v]) => encodeURIComponent(k) + '=' + exportValue(v))
            ).join('&');
        }

        let body;

        if (typeof args === 'object') {
            if (options.contentType === 'application/json') {
                body = JSON.stringify(args);

            } else {
                body = encodeArgs(args);
            }

        } else if (typeof args === 'string') {
            body = args;

        } else {
            throw new Error('ajax() error: unsupported args type ' + (typeof args));
        }

        if (method === HTTP.Method.GET) {
            let elms = url.split('?');
            if (!elms[1]) {
                url += '?' + body;

            } else {
                url += '&' + body;
            }
        }

        return {
            accept: options.accept,
            contentType: options.contentType,
            responseType: options.responseType,
            method,
            requestBody: body,
            url
        }
    }

    /**
     *
     * Notes:
     * - default contentType is 'application/x-www-form-urlencoded; charset=UTF-8'
     * - default accept is 'application/json'
     *
     * @param method A HTTP method (GET, POST, PUT,...)
     * @param url A URL of the resource
     * @param args Parameters to be passed along with request
     * @param options Additional settings
     */
    ajax$<T>(
        method:HTTP.Method,
        url:string,
        args:Kontext.AjaxArgs,
        options?:Kontext.AjaxOptions
    ):Observable<T> {
        const callArgs = this.prepareAjax(method, url, args, options);
        return ajax<T>({
            url: callArgs.url,
            body: callArgs.requestBody,
            method: callArgs.method,
            responseType: callArgs.responseType,
            headers: {
                'Content-Type': callArgs.contentType
            }
        }).pipe(
            map<RxAjaxResponse<T>, T>(v => v.response)
        );
    }

    /**
     * Downloads a remote file using window.URL.
     */
    bgDownload<T=Kontext.AjaxArgs>(
        {filename, url, method, contentType, args}:
        {
            filename:string,
            url:string,
            method:HTTP.Method,
            contentType:string,
            args?:T
        }
    ):Observable<boolean> {
        return this.ajax$<Blob>(
            method,
            url,
            args || {},
            {
                responseType: 'blob',
                contentType
            }

        ).pipe(
            tap((data) => {
                const objectURL = window.URL.createObjectURL(data);
                const link = document.getElementById('download-link') as HTMLAnchorElement;
                link.href = objectURL;
                link.download = filename;
                link.click();
                window.setTimeout(() => window.URL.revokeObjectURL(objectURL), 2000);
            }),
            map(_ => true)
        );
    }

    /**
     *
     */
    reload():void {
        window.document.location.reload();
    }

    getHistory():Kontext.IHistory {
        return this.history;
    }

    registerCorpusSwitchAwareModels(
        onDone:()=>void,
        ...models:Array<IUnregistrable>
    ):void {
        this.corpusSwitchModel.registerModels(onDone, ...models);
    }

    registerPageLeaveVoters(...models:Array<IPageLeaveVoter<{}>>):void {
        List.forEach(
            model => this.pageLeaveVoting.registerVotingModel(model),
            models
        );
    }
}