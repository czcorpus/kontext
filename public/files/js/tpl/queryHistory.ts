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

/**
 * This module contains functionality related directly to the query_history.tmpl template
 *
 */

/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../types/ajaxResponses.d.ts" />

import * as $ from 'jquery';
import {PageModel} from './document';
import {MultiDict} from '../util';


class QueryHistoryPage {

    private layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private calcCurrNumberRows():number {
        return $('table.query-history tr.data-item').length;
    }

    private escapeHTML(html:string) {
        let elm = document.createElement('div');
        elm.appendChild(document.createTextNode(html));
        return elm.innerHTML;
    }

    /**
     * Cuts an end of a text. If a non-empty string is detected
     * at the end then additional characters up to the next whitespace
     * are removed.
     *
     * @param s
     * @param length
     */
    shortenText(s:string, length:number):string {
        let ans = s.substr(0, length);
        let items;

        if (ans.length > length && !/\s.|.\s/.exec(s.substr(length - 1, 2))) {
            items = ans.split(/\s+/);
            ans = items.slice(0, items.length - 1).join(' ');
        }
        if (ans.length < s.length) {
            ans += '...';
        }
        return ans;
    }

    private appendData(data:Array<AjaxResponse.QueryHistoryItem>) {
        data.forEach(item => {
            $('table.query-history .expand-line').before('<tr class="data-item">'
                + '<td class="query">'
                + this.escapeHTML(this.shortenText(item.query, this.layoutModel.getConf<number>('historyMaxQuerySize')))
                + '</td>'
                + `<td class="corpname">${item.humanCorpname}${item.subcorpname ? '+' + item.subcorpname : ''}</td>`
                + `<td>${item.query_type_translated}</td>`
                + `<td>${item.details}</td>`
                + `<td class="date">${item.created[1]}<strong>${item.created[0]}</strong></td>`
                + `<td><a href="${item.query_form_url}">${this.layoutModel.translate('global__use_query')}</a></td>`
                );
        });
    }

    private getAjaxParams():MultiDict {
        const params = [];

        const form = $('.query-history-filter');
        if (form.find('input[name=\'current_corpus\']:checked').length > 0) {
            params.push('current_corpus=1');
        }

        const queryType = form.find('select[name=\'query_type\']').val();
        if (queryType) {
            params.push(['query_type', encodeURIComponent(queryType)]);
        }
        params.push(['offset', this.calcCurrNumberRows()]);
        params.push(['limit', this.layoutModel.getConf<any>('page').page_append_records]); // TODO type
        return new MultiDict(params);
    }

    private dynamizeFormControls():void {
        const form = $('.query-history-filter');

        form.find('button[type=\'submit\']').remove();
        form.find('input[name=\'current_corpus\']').on('click', () => {
            form.submit();
        });
        form.find('select[name=\'query_type\']').on('change', () => {
            form.submit();
        });
    }

    /**
     * Appends an animated image symbolizing loading of data.
     *
     * @param elm
     * @param options
     * @return
     */
    appendLoader(elm:HTMLElement, options?:{domId:string; htmlClass:string}) {
        let jImage = $('<img />');

        options = options || {domId:null, htmlClass:null};
        jImage.attr('src', this.layoutModel.createStaticUrl('img/ajax-loader.gif'));
        if (options.domId) {
            jImage.addClass(options.domId);
        }
        if (options.htmlClass) {
            jImage.addClass(options.htmlClass);
        }
        $(elm).append(jImage);
        return jImage;
    }

    private addExpandLink() {
        $('table.query-history').append('<tr class="expand-line"><td colspan="7"><a class="expand-list">'
            + this.layoutModel.translate('global__load_more') + '</a></td></tr>');

        $('table.query-history').find('a.expand-list').on('click', () => {
            const actionCell = $('table.query-history .expand-line td');
            const linkElm = actionCell.find('a').detach();
            const loaderImg = this.appendLoader(actionCell.get(0));

            function cleanUpLoader(fn?:()=>void) {
                loaderImg.remove();
                if (typeof fn === 'function') {
                    fn();
                    window.setTimeout(function () {
                        actionCell.empty().append(linkElm);
                    }, 1000);

                } else {
                    actionCell.append(linkElm);
                }
            }

            this.layoutModel.ajax<any>(
                'GET',
                this.layoutModel.createActionUrl( 'user/ajax_query_history'),
                this.getAjaxParams()

            ).then(
                (data:AjaxResponse.QueryHistory) => {
                    if (data.contains_errors) {
                        cleanUpLoader();
                        this.layoutModel.showMessage('error', data.messages[0]);

                    } else {
                        if (data.data.length > 0) {
                            cleanUpLoader();

                        } else {
                            cleanUpLoader(function () {
                                actionCell.append(`[${this.layoutModel.translate('global__no_more_lines')}]`);
                            });
                        }
                        this.appendData(data.data);
                    }
                },
                (err) => {
                    cleanUpLoader();
                    this.layoutModel.showMessage('error', err);
                }
            );
        });
    }

    init():void {
        this.layoutModel.init().then(
            (data) => {
                this.addExpandLink();
                this.dynamizeFormControls();
            }
        );
    }

}

export function init(conf:Kontext.Conf):void {
    const model = new QueryHistoryPage(new PageModel(conf));
    model.init();
}
