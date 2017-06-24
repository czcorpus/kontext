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
/// <reference path="../../types/plugins.d.ts" />
/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />

import * as $ from 'jquery';
import * as RSVP from 'vendor/rsvp';
import {extended as initPopupboxLib, Api as PopupBoxApi, TooltipBox} from '../../popupbox';
import {createGenerator} from './ucnkTreeView';


/**
 *
 */
class SyntaxTreeViewer {

    private pluginApi:Kontext.PluginApi;

    private popupBox:TooltipBox;

    private popupBoxApi:PopupBoxApi;

    private resizeHandler:()=>void;

    constructor(pluginApi:Kontext.PluginApi) {
        this.pluginApi = pluginApi;
        this.popupBoxApi = initPopupboxLib(this.pluginApi);
    }

    private createAjaxLoader():JQuery {
        const loader = $(window.document.createElement('div'));
        loader
            .addClass('ajax-loading-msg')
            .css({
                'bottom' : '50px',
                'position' : 'fixed',
                'left' : ($(window).width() / 2 - 50) + 'px'
            })
            .append('<span>' + this.pluginApi.translate('global__loading') + '</span>');
        return loader;
    }

    private createRenderFunction(tokenId:string, kwicLength:number,
            overlayElm:HTMLElement):(box:TooltipBox, finalize:()=>void)=>void {
        const renderTree = (box:TooltipBox, finalize:()=>void, data:any):void => {
            const parentElm = box.getContentElement();
            const treexFrame = window.document.createElement('div');
            $(treexFrame).css('width', '90%');

            parentElm.appendChild(treexFrame);
            finalize();
            box
                .setCss('left', '50%')
                .setCss('top', '50%');
            createGenerator(this.pluginApi.exportMixins()[0]).call(
                null,
                data,
                'cs',
                'default',
                treexFrame,
                {
                    width: null, // = auto
                    height: null, // = auto
                    paddingTop: 20,
                    paddingBottom: 50,
                    paddingLeft: 20,
                    paddingRight: 20,
                    onOverflow: (width:number, height:number) => {
                        $(overlayElm).css('position', 'absolute');
                        box
                            .setCss('maxHeight', 'none')
                            .setCss('transform', 'none')
                            .setCss('top', 0)
                            .setCss('left', 0);
                        return [width, height];
                    }
                }
            );
        }

        return (box:TooltipBox, finalize:()=>void) => {
            const ajaxAnim = this.createAjaxLoader();
            $('body').append(ajaxAnim);

            this.pluginApi.ajax(
                'GET',
                this.pluginApi.createActionUrl('get_syntax_data'),
                {
                    corpname: this.pluginApi.getConf('corpname'),
                    kwic_id: tokenId,
                    kwic_len: kwicLength
                },
                {contentType : 'application/x-www-form-urlencoded'}

            ).then(
                (data:any) => {
                    $(ajaxAnim).remove();
                    if (!data['contains_errors']) {
                        renderTree(box, finalize, data);

                    } else {
                        finalize();
                        box.close();
                        this.pluginApi.showMessage('error', data['error']);
                    }
                },
                (error) => {
                    $(ajaxAnim).remove();
                    finalize();
                    box.close();
                    this.pluginApi.showMessage('error', error);
                }
            );
        };
    }

    private createActionButton(tokenId:string, kwicLength:number):HTMLElement {
        const baseImg = this.pluginApi.createStaticUrl('js/plugins/defaultSyntaxViewer/syntax-tree-icon.svg');
        const overImg = this.pluginApi.createStaticUrl('js/plugins/defaultSyntaxViewer/syntax-tree-icon_s.svg');
        const button = window.document.createElement('img');
        const showSyntaxTree = () => {
            if (this.popupBox) {
                this.popupBox.close();
            }
            const overlay = window.document.createElement('div');
            $(overlay).attr('id', 'modal-overlay');
            $('body').append(overlay);

            this.popupBox = this.popupBoxApi.openAt(
                overlay,
                this.createRenderFunction(tokenId, kwicLength, overlay),
                {left: 0, top: 0},
                {
                    type: 'plain',
                    calculatePosition: false,
                    closeIcon: true,
                    timeout: null,
                    htmlClass: 'syntax-tree',
                    afterClose: () => {
                        $(overlay).remove();
                        window.removeEventListener('resize', this.resizeHandler);
                    }
                }
            );
            let timer = null;
            this.resizeHandler = () => {
                if (timer !== null) {
                    window.clearTimeout(timer);
                }
                timer = window.setTimeout(() => {
                    this.popupBox.close();
                    showSyntaxTree();

                }, 500);
            }
            window.addEventListener('resize', this.resizeHandler);
        }

        $(button)
            .attr('src', baseImg)
            .attr('title', this.pluginApi.translate('syntaxViewer__click_to_see_the_tree'))
            .on('mouseover', () => {
                $(button).attr('src', overImg);
            })
            .on('mouseout', () => {
                $(button).attr('src', baseImg);
            })
            .on('click', showSyntaxTree);
        return button;
    }

    init():void {
        let srch = $('#conclines').find('td.syntax-tree');
        srch
            .empty()
            .each((i, elm:HTMLElement) => {
                let trElm = $(elm).closest('tr');
                if (trElm.attr('data-toknum')) {
                    $(elm).append(this.createActionButton(trElm.attr('data-toknum'),
                            parseInt(trElm.attr('data-kwiclen')))).show();
                }
            });
    }
}

export default function create(pluginApi:Kontext.PluginApi):RSVP.Promise<PluginInterfaces.ISyntaxViewer> {
    return new RSVP.Promise<PluginInterfaces.ISyntaxViewer>((resolve:(val:PluginInterfaces.ISyntaxViewer)=>void, reject:(e:any)=>void) => {
        const viewer = new SyntaxTreeViewer(pluginApi);
        viewer.init();
        resolve(viewer);
    });
}