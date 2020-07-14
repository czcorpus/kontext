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
import { map, tap } from 'rxjs/operators';
import { ajax, AjaxResponse as RxAjaxResponse } from 'rxjs/ajax';
import { IModel, IFullActionControl } from 'kombo';
import { pipe, List } from 'cnc-tskit';

import { Kontext } from '../../types/common';
import { MultiDict } from '../../multidict';
import { CorpusSwitchModel, ICorpusSwitchSerializable } from '../../models/common/corpusSwitch';
import { createHistory } from './history';
import { PageLeaveVoting, IPageLeaveVoter } from '../../models/common/pageLeave';
import { Actions, ActionName } from '../../models/common/actions';


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


export namespace SaveData {

    export enum Format {
        CSV = 'csv',
        TEXT = 'text',
        XML = 'xml',
        XLSX = 'xlsx'
    }

    export const formatToExt = (sf:Format):string => {
        switch (sf) {
            case Format.CSV:
                return 'csv';
            case Format.TEXT:
                return 'txt';
            case Format.XLSX:
                return 'xlsx';
            case Format.XML:
                return 'xml';
            default:
                throw new Error(`Unknown safe format ${sf}`);
        }
    }
}

/**
 *
 */
interface AjaxRequestProps {
    accept:string,
    contentType:string,
    responseType:string,
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

    private readonly corpusSwitchModel:CorpusSwitchModel;

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
    setLocationPost(path:string, args:Array<[string,string]>, blankWindow:boolean=false):void {
        const body = window.document.getElementsByTagName('body')[0];
        const form = window.document.createElement('form');
        form.setAttribute('method', 'post');
        form.setAttribute('action', path);
        if (blankWindow) {
            form.setAttribute('target', '_blank');
        }
        body.appendChild(form);
        (args || []).filter(v => !!v[1]).forEach(item => {
            const input = window.document.createElement('input');
            input.setAttribute('type', 'hidden');
            input.setAttribute('name', item[0]);
            input.setAttribute('value', item[1]);
            form.appendChild(input);
        });
        form.submit();
        window.onbeforeunload = () => {
            body.removeChild(form);
        };
    }

    /**
     *
     * @param params
     * @returns {string}
     */
    encodeURLParameters<T>(params:MultiDict<T>):string {
        function exportValue(v) {
            return v === null || v === undefined ? '' : encodeURIComponent(v);
        }
        return params.items().map((item) => {
            return encodeURIComponent(item[0]) + '=' + exportValue(item[1]);
        }).join('&');
    }

    /**
     * Create a URL for a static resource (e.g. img/close-icon.svg)
     */
    createStaticUrl(path):string {
        if (typeof path !== 'string') {
            throw new Error(`Cannot create static url. Invalid path: ${path}`);
        }
        return this.conf.getConf<string>('staticPath') + (path.indexOf('/') === 0 ? '' : '/') + path;
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
    createActionUrl<T>(path:string, args?:Array<[string, T]>|Kontext.IMultiDict<T>):string {
        if (typeof path !== 'string') {
            throw new Error(`Cannot create action url. Invalid path: ${path}`);
        }
        let urlArgs = '';
        if (args !== undefined) {
            const nArgs = Array.isArray(args) ? args : args.items();
            urlArgs = pipe(
                nArgs,
                List.filter(([, value]) => value !== null && value !== undefined),
                List.map(([key, value]) => encodeURIComponent(key + '') + '=' + encodeURIComponent(value + ''))
            ).join('&');
        }
        return this.conf.getConf('rootPath') +
                (path.indexOf('/') === 0 ? path.substr(1) : path) +
                (urlArgs ? '?' + urlArgs : '');
    }

    private prepareAjax(method:string, url:string, args:Kontext.AjaxArgs, options?:Kontext.AjaxOptions):AjaxRequestProps {
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
            return v === null || v === undefined ? '' : encodeURIComponent(v);
        }

        function encodeArgs(obj) {
            const ans = [];
            let p; // ES5 issue
            for (p in obj) {
                if (obj.hasOwnProperty(p)) {
                    const val = obj[p] !== null && obj[p] !== undefined ? obj[p] : '';
                    if (Object.prototype.toString.apply(val) === '[object Array]') {
                        val.forEach(item => {
                            ans.push(encodeURIComponent(p) + '=' + exportValue(item));
                        });

                    } else {
                        ans.push(encodeURIComponent(p) + '=' + exportValue(val));
                    }
                }
            }
            return ans.join('&');
        }

        let body;

        if (args instanceof MultiDict) {
            body = this.encodeURLParameters(args);

        } else if (typeof args === 'object') {
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

        if (method === 'GET') {
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
            method: method,
            requestBody: body,
            url: url
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
    ajax$<T>(method:string, url:string, args:Kontext.AjaxArgs, options?:Kontext.AjaxOptions):Observable<T> {
        const callArgs = this.prepareAjax(method, url, args, options);
        return ajax({
            url: callArgs.url,
            body: callArgs.requestBody,
            method: callArgs.method,
            responseType: callArgs.responseType,
            headers: {
                'Content-Type': callArgs.contentType
            }
        }).pipe(map<RxAjaxResponse, T>(v => v.response));
    }


    bgDownload(filename:string, url:string, method:string, args?:Kontext.AjaxArgs):Observable<boolean> {
        return this.ajax$<Blob>(
            method,
            url,
            args || {},
            {responseType: 'blob'}

        ).pipe(
            tap((data) => {
                const objectURL = window.URL.createObjectURL(data);
                const link = <HTMLAnchorElement>document.getElementById('download-link');
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

    /**
     * @param overwriteArgs a list of arguments whose values overwrite the current ones
     * @param appendArgs a list of arguments which will be appended to the existing ones
     */
    exportConcArgs(overwriteArgs:Kontext.MultiDictSrc, appendArgs?:Kontext.MultiDictSrc):string {
        const tmp = new MultiDict(this.conf.getConf<Kontext.ListOfPairs>('currentArgs'));

        function importArgs(args:Kontext.MultiDictSrc):Array<[string,string]> {
            if (!args) {
                return [];

            } else if (!Array.isArray(args)) {
                const impArgs:Array<[string, string]> = [];
                for (let p in args) {
                    if (args.hasOwnProperty(p)) {
                        impArgs.push([p, args[p]]);
                    }
                }
                return impArgs;

            } else {
                return <Array<[string,string]>>args;
            }
        }

        const overwriteArgs2 = importArgs(overwriteArgs);
        overwriteArgs2.forEach(item => {
            tmp.replace(item[0], []);
        });

        overwriteArgs2.concat(importArgs(appendArgs)).forEach(item => {
            tmp.add(item[0], item[1]);
        });
        return this.encodeURLParameters(tmp);
    }

    registerCorpusSwitchAwareModels(onDone:()=>void, ...models:Array<ICorpusSwitchSerializable<{}, {}>>):void {
        this.corpusSwitchModel.registerModels(onDone, ...models);
    }

    registerPageLeaveVoters(...models:Array<IPageLeaveVoter<{}>>):void {
        List.forEach(
            model => this.pageLeaveVoting.registerVotingModel(model),
            models
        );
    }
}